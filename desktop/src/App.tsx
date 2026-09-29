import { useState, useEffect, useCallback } from "react";
import { api } from "./services/api";
import { supabaseService, getSupabase } from "./services/supabase";
import { syncEngine, SyncStatusType } from "./services/syncEngine";
import { VaultStatus, VaultEntry, SaveEntryInput } from "./types";
import { UnlockScreen } from "./components/UnlockScreen";
import { VaultView } from "./components/VaultView";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { onClipboardWiped } from "./services/clipboard";
import "./App.css";

export function App() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>("synced");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const refreshEntries = useCallback(async () => {
    try {
      const list = await api.listEntries();
      setEntries(list);
    } catch (err) {
      console.error("Failed to list entries:", err);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.getVaultStatus();
      setStatus(s);
      if (s.is_unlocked) {
        await refreshEntries();
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.error("Failed to load vault status:", err);
    } finally {
      setLoading(false);
    }
  }, [refreshEntries]);

  // When vault becomes unlocked, initialize SyncEngine (WebSockets + Offline Queue)
  useEffect(() => {
    if (!status?.is_unlocked) {
      syncEngine.stop();
      return;
    }

    const initSyncEngine = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setSyncStatus("offline");
        return;
      }

      setSyncStatus("syncing");

      let userId: string | undefined;
      for (let i = 0; i < 6; i++) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData?.session?.user?.id;
        if (userId) break;
        await new Promise((r) => setTimeout(r, 250));
      }

      // If no active session, attempt immediate auto-heal from Rust session credentials
      if (!userId) {
        try {
          const creds = await api.getSessionCredentials();
          if (creds && creds.email && creds.auth_verifier) {
            console.log("[App] Attempting session auto-heal for:", creds.email);
            const authRes = await supabaseService.signUpOrSignIn(creds.email, creds.auth_verifier);
            if (authRes.user) {
              userId = authRes.user.id;
              await supabaseService.saveRemoteVaultMeta(
                authRes.user.id,
                creds.master_salt,
                creds.encrypted_dek,
                creds.dek_nonce
              );
            } else {
              console.warn("[App] Session auto-heal failed:", authRes.error);
            }
          }
        } catch (healErr) {
          console.error("[App] Auto-heal exception:", healErr);
        }
      }

      if (!userId) {
        setSyncStatus("offline");
        return;
      }

      syncEngine.start(
        userId,
        () => refreshEntries(),
        (st) => setSyncStatus(st)
      );
    };

    initSyncEngine();

    return () => {
      syncEngine.stop();
    };
  }, [status?.is_unlocked, refreshEntries]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleUnlocked = async () => {
    setLoading(true);
    await loadStatus();
  };

  const handleLock = async () => {
    try {
      await syncEngine.stop();
      await api.lockVault();
    } finally {
      setStatus((prev) => (prev ? { ...prev, is_unlocked: false } : null));
      setEntries([]); // Zero UI memory
    }
  };

  // Security Hardening: Auto-lock after 5 minutes of inactivity
  useEffect(() => {
    if (!status?.is_unlocked) return;

    let timer: ReturnType<typeof setTimeout>;

    const resetInactivity = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log("[Security] 5 minutes of inactivity reached. Auto-locking vault.");
        handleLock();
      }, 5 * 60 * 1000);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetInactivity, { passive: true }));
    resetInactivity();

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetInactivity));
    };
  }, [status?.is_unlocked]);

  // Security Hardening: Clipboard auto-wipe notification listener
  useEffect(() => {
    const unsub = onClipboardWiped(() => {
      setToastMessage("Clipboard auto-cleared for security (30s)");
      setTimeout(() => setToastMessage(null), 3500);
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to log out? This will reset the local cache on this device so another account can log in."
    );
    if (!confirmed) return;

    try {
      await syncEngine.stop();
      await api.resetVault();
    } finally {
      setStatus(null);
      setEntries([]);
      await loadStatus();
    }
  };

  const handleSaveEntry = async (input: SaveEntryInput) => {
    const saved = await api.saveEntry(input);
    await refreshEntries();

    // Push to Supabase via SyncEngine sweep or direct push
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (userId) {
        supabaseService.pushEntry(userId, saved).then((serverTime) => {
          if (serverTime) {
            api.markEntrySynced(saved.id, serverTime);
          }
        });
      }
    }
  };

  const handleDeleteEntry = async (id: string) => {
    await api.deleteEntry(id);
    await refreshEntries();

    // Push deletion to Supabase
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (userId) {
        const deletedEntry = entries.find((e) => e.id === id);
        if (deletedEntry) {
          deletedEntry.is_deleted = true;
          supabaseService.pushEntry(userId, deletedEntry);
        }
      }
    }
  };

  const handleTriggerSync = () => {
    syncEngine.syncFullSweep();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#09090b] flex items-center justify-center text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!status?.is_unlocked ? (
        <motion.div
          key="unlock-screen"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="h-screen w-screen overflow-hidden"
        >
          <UnlockScreen
            isInitialized={status?.is_initialized || false}
            savedEmail={status?.email}
            onUnlocked={handleUnlocked}
          />
        </motion.div>
      ) : (
        <motion.div
          key="vault-view"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="h-screen w-screen overflow-hidden"
        >
          <VaultView
            entries={entries}
            userEmail={status.email}
            onSaveEntry={handleSaveEntry}
            onDeleteEntry={handleDeleteEntry}
            onLock={handleLock}
            onLogout={handleLogout}
            syncStatus={syncStatus}
            onTriggerSync={handleTriggerSync}
          />
        </motion.div>
      )}

      {/* Security Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-5 right-5 z-50 px-3.5 py-2.5 bg-[#121316]/95 border border-white/[0.12] rounded-xl shadow-2xl text-xs text-zinc-200 flex items-center gap-2.5 backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}

export default App;
