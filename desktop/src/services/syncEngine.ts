import { getSupabase, supabaseService } from "./supabase";
import { api } from "./api";
import { RealtimeChannel } from "@supabase/supabase-js";

export type SyncStatusType = "synced" | "syncing" | "offline" | "error";

type EntriesUpdatedCallback = () => void;
type StatusChangedCallback = (status: SyncStatusType) => void;

class SyncEngine {
  private channel: RealtimeChannel | null = null;
  private isSyncing = false;
  private currentUserId: string | null = null;
  private onEntriesUpdated: EntriesUpdatedCallback | null = null;
  private onStatusChanged: StatusChangedCallback | null = null;
  private onlineListener: (() => void) | null = null;

  public async start(
    userId: string,
    onEntriesUpdated: EntriesUpdatedCallback,
    onStatusChanged: StatusChangedCallback
  ) {
    this.currentUserId = userId;
    this.onEntriesUpdated = onEntriesUpdated;
    this.onStatusChanged = onStatusChanged;

    // Perform initial sync sweep (push local pending items, pull remote items)
    await this.syncFullSweep();

    // Setup Supabase Realtime WebSocket Listener
    this.setupRealtimeSubscription(userId);

    // Setup Online Reconnect Listener
    this.setupNetworkListeners();
  }

  public async stop() {
    if (this.channel) {
      const supabase = getSupabase();
      if (supabase) {
        supabase.removeChannel(this.channel);
      }
      this.channel = null;
    }

    if (this.onlineListener) {
      window.removeEventListener("online", this.onlineListener);
      this.onlineListener = null;
    }

    this.currentUserId = null;
    this.onEntriesUpdated = null;
    this.onStatusChanged = null;
  }

  public async syncFullSweep() {
    if (this.isSyncing) return;

    const supabase = getSupabase();
    if (!supabase) {
      this.onStatusChanged?.("offline");
      return;
    }

    // Auto-heal session if currentUserId is not set
    if (!this.currentUserId) {
      try {
        const creds = await api.getSessionCredentials();
        if (creds && creds.email && creds.auth_verifier) {
          const authRes = await supabaseService.signUpOrSignIn(creds.email, creds.auth_verifier);
          if (authRes.user) {
            this.currentUserId = authRes.user.id;
            await supabaseService.saveRemoteVaultMeta(
              authRes.user.id,
              creds.master_salt,
              creds.encrypted_dek,
              creds.dek_nonce
            );
            this.setupRealtimeSubscription(authRes.user.id);
          }
        }
      } catch (e) {
        console.warn("[SyncEngine] Auto-heal auth failed:", e);
      }
    }

    if (!this.currentUserId) {
      this.onStatusChanged?.("offline");
      return;
    }

    this.isSyncing = true;
    this.onStatusChanged?.("syncing");

    try {
      // 0. Ensure remote vault metadata (salt, encrypted DEK) is backed up
      try {
        const creds = await api.getSessionCredentials();
        if (creds && creds.master_salt && creds.encrypted_dek && creds.dek_nonce) {
          await supabaseService.saveRemoteVaultMeta(
            this.currentUserId,
            creds.master_salt,
            creds.encrypted_dek,
            creds.dek_nonce
          );
        }
      } catch (metaErr) {
        console.warn("[SyncEngine] Vault meta sync note:", metaErr);
      }

      // 1. Drain local offline queue (push items modified while offline)
      const pendingItems = await api.getPendingSync();
      for (const item of pendingItems) {
        const res = await supabaseService.pushEnvelope(this.currentUserId, item);
        if (res && res.success) {
          await api.markEntrySynced(item.id, item.revision, res.server_updated_at);
        }
      }

      // 2. Fetch all remote envelopes from Supabase
      const remoteEnvelopes = await supabaseService.fetchAllRemoteEnvelopes(this.currentUserId);
      let hasNewData = false;

      for (const remote of remoteEnvelopes) {
        const applied = await api.applyRemoteEnvelope(remote);
        if (applied) {
          hasNewData = true;
        }
      }

      if (hasNewData || pendingItems.length > 0) {
        this.onEntriesUpdated?.();
      }

      this.onStatusChanged?.("synced");
    } catch (err) {
      console.warn("[SyncEngine] Sweep error:", err);
      this.onStatusChanged?.("offline");
    } finally {
      this.isSyncing = false;
    }
  }

  private setupRealtimeSubscription(userId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    if (this.channel) {
      supabase.removeChannel(this.channel);
    }

    this.channel = supabase
      .channel(`public:vault_entries:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vault_entries",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const remoteRow = payload.new as any;

          if (remoteRow && remoteRow.id && remoteRow.ciphertext && remoteRow.nonce) {
            try {
              const updated = await api.applyRemoteEnvelope({
                id: remoteRow.id,
                owner_id: userId,
                crypto_version: remoteRow.crypto_version ?? 2,
                payload_schema_version: remoteRow.payload_schema_version ?? 2,
                nonce: remoteRow.nonce,
                ciphertext: remoteRow.ciphertext,
                revision: Number(remoteRow.revision ?? 1),
                is_deleted: Boolean(remoteRow.is_deleted),
                client_updated_at: remoteRow.client_updated_at || new Date().toISOString(),
                server_updated_at: remoteRow.server_updated_at || new Date().toISOString(),
                sync_state: "synced",
              });

              if (updated) {
                this.onEntriesUpdated?.();
                this.onStatusChanged?.("synced");
              }
            } catch (err) {
              console.error("[SyncEngine] Failed to apply incoming WebSocket payload:", err);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.onStatusChanged?.("synced");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          this.onStatusChanged?.("offline");
        }
      });
  }

  private setupNetworkListeners() {
    this.onlineListener = () => {
      if (this.currentUserId) {
        this.syncFullSweep();
      }
    };
    window.addEventListener("online", this.onlineListener);
  }
}

export const syncEngine = new SyncEngine();
