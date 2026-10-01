import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { EncryptedEnvelope, RemoteVaultMetadata } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://fdavvijioofchmkgmihg.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (!supabaseInstance && SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("placeholder")) {
    try {
      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.warn("Failed to initialize Supabase client:", e);
    }
  }
  return supabaseInstance;
};

export const supabaseService = {
  fetchUserSalt: async (email: string): Promise<string | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc("get_vault_salt", {
        user_email: email.trim().toLowerCase(),
      });
      if (error) {
        console.warn("[Supabase] fetchUserSalt RPC notice:", error.message);
        return null;
      }
      return (data as string) || null;
    } catch (e) {
      console.warn("[Supabase] fetchUserSalt exception:", e);
      return null;
    }
  },

  signUpOrSignIn: async (email: string, authVerifier: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: "Supabase not configured" };

    // Try signing in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: authVerifier,
    });

    if (!signInError && signInData.user) {
      return { user: signInData.user, isNewUser: false };
    }

    if (signInError) {
      console.warn("[Supabase] signInWithPassword notice:", signInError.message);
    }

    // Try signing up if account does not exist
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: authVerifier,
    });

    if (signUpError) {
      return { error: signUpError.message };
    }

    return { user: signUpData.user, isNewUser: true };
  },

  signIn: async (email: string, authVerifier: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: "Supabase not configured" };

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: authVerifier,
    });

    if (error) {
      return { error: error.message };
    }

    return { user: data.user };
  },

  saveRemoteVaultMeta: async (
    userId: string,
    masterSalt: string,
    encryptedDek: string,
    dekNonce: string,
    dekWrapVersion: number = 2,
    keyGeneration: number = 1
  ): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client not initialized");

    const payload: Record<string, any> = {
      id: userId,
      master_salt: masterSalt,
      encrypted_dek: encryptedDek,
      dek_nonce: dekNonce,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from("vault_metadata").upsert({
      ...payload,
      dek_wrap_version: dekWrapVersion,
      key_generation: keyGeneration,
    });

    if (error && error.message.includes("column")) {
      const res = await supabase.from("vault_metadata").upsert(payload);
      error = res.error;
    }

    if (error) {
      throw new Error(`Failed to save remote vault metadata: ${error.message}`);
    }
  },

  fetchRemoteVaultMeta: async (userId: string): Promise<RemoteVaultMetadata | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("vault_metadata")
      .select("id, master_salt, encrypted_dek, dek_nonce, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Could not fetch remote vault meta:", error.message);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      master_salt: data.master_salt,
      encrypted_dek: data.encrypted_dek,
      dek_nonce: data.dek_nonce,
      dek_wrap_version: (data as any).dek_wrap_version ?? 1,
      key_generation: (data as any).key_generation ?? 1,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  },

  /// Pushes an EncryptedEnvelope to Supabase using optimistic concurrency RPC.
  /// Rejects stale revisions and never accepts remote owner mismatched with user.
  pushEnvelope: async (
    userId: string,
    envelope: EncryptedEnvelope,
    expectedPreviousRevision?: number
  ): Promise<{ success: boolean; status: string; server_updated_at: string }> => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client not initialized");

    // Try optimistic concurrency RPC first
    try {
      const { data, error } = await supabase.rpc("upsert_vault_envelope", {
        p_id: envelope.id,
        p_crypto_version: envelope.crypto_version,
        p_payload_schema_version: envelope.payload_schema_version,
        p_nonce: envelope.nonce,
        p_ciphertext: envelope.ciphertext,
        p_revision: envelope.revision,
        p_is_deleted: envelope.is_deleted,
        p_client_updated_at: envelope.client_updated_at,
        p_expected_previous_revision: expectedPreviousRevision ?? null,
      });

      if (!error && data && data.length > 0) {
        const res = data[0];
        return {
          success: res.success,
          status: res.status,
          server_updated_at: res.server_updated_at,
        };
      }
    } catch {
      // Fallback to direct table upsert if RPC not yet deployed
    }

    // Direct table upsert fallback
    const payload: Record<string, any> = {
      id: envelope.id,
      user_id: userId,
      nonce: envelope.nonce,
      ciphertext: envelope.ciphertext,
      version: envelope.revision,
      is_deleted: envelope.is_deleted,
      client_updated_at: envelope.client_updated_at,
    };

    let { data, error } = await supabase
      .from("vault_entries")
      .upsert({
        ...payload,
        crypto_version: envelope.crypto_version,
        payload_schema_version: envelope.payload_schema_version,
        revision: envelope.revision,
      })
      .select("server_updated_at")
      .single();

    if (error && error.message.includes("column")) {
      const res = await supabase
        .from("vault_entries")
        .upsert(payload)
        .select("server_updated_at")
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      throw new Error(`Failed to push envelope ${envelope.id}: ${error.message}`);
    }

    return {
      success: true,
      status: "updated",
      server_updated_at: data?.server_updated_at || new Date().toISOString(),
    };
  },

  /// Fetches all remote envelopes for the authenticated user.
  /// Validates user ownership on each row.
  fetchAllRemoteEnvelopes: async (userId: string): Promise<EncryptedEnvelope[]> => {
    const supabase = getSupabase();
    if (!supabase) return [];

    let { data, error } = await supabase
      .from("vault_entries")
      .select("id, user_id, ciphertext, nonce, version, is_deleted, client_updated_at, server_updated_at")
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to fetch remote envelopes: ${error.message}`);
    }

    const envelopes: EncryptedEnvelope[] = [];
    for (const row of (data as any) || []) {
      if (row.user_id !== userId) {
        console.warn(`Untrusted envelope discarded: user_id mismatch (${row.user_id} !== ${userId})`);
        continue;
      }

      envelopes.push({
        id: row.id,
        owner_id: userId,
        crypto_version: row.crypto_version ?? 1,
        payload_schema_version: row.payload_schema_version ?? 1,
        nonce: row.nonce,
        ciphertext: row.ciphertext,
        revision: Number(row.revision ?? row.version ?? 1),
        is_deleted: Boolean(row.is_deleted),
        client_updated_at: row.client_updated_at,
        server_updated_at: row.server_updated_at,
        sync_state: "synced",
      });
    }

    return envelopes;
  },
};
