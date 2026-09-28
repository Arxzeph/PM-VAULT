import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { VaultEntry } from "../types";

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
      console.log("[Supabase] Signed in successfully:", signInData.user.id);
      return { user: signInData.user, isNewUser: false };
    }

    if (signInError) {
      console.warn("[Supabase] signInWithPassword notice:", signInError.message);
    }

    // If sign in failed, try signing up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: authVerifier,
    });

    if (signUpError) {
      console.error("[Supabase] signUp error:", signUpError.message, signUpError);
      return { error: signUpError.message };
    }

    if (signUpData.user) {
      console.log("[Supabase] Signed up successfully:", signUpData.user.id);
      return { user: signUpData.user, isNewUser: true };
    }

    return { error: "No user returned from Supabase auth" };
  },

  saveRemoteVaultMeta: async (
    userId: string,
    masterSalt: string,
    encryptedDek: string,
    dekNonce: string
  ) => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { error } = await supabase.from("vault_metadata").upsert({
      id: userId,
      master_salt: masterSalt,
      encrypted_dek: encryptedDek,
      dek_nonce: dekNonce,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to save remote vault metadata:", error);
    }
  },

  fetchRemoteVaultMeta: async (userId: string) => {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("vault_metadata")
      .select("master_salt, encrypted_dek, dek_nonce")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("Could not fetch remote vault meta:", error.message);
      return null;
    }
    return data;
  },

  pushEntry: async (userId: string, entry: VaultEntry) => {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from("vault_entries").upsert({
      id: entry.id,
      user_id: userId,
      ciphertext: entry.ciphertext,
      nonce: entry.nonce,
      version: entry.version,
      is_deleted: entry.is_deleted,
      client_updated_at: entry.client_updated_at,
    }).select("server_updated_at").single();

    if (error) {
      console.error("[Supabase] Failed to push entry to Supabase:", error.message, error);
      return null;
    }

    console.log("[Supabase] Successfully pushed entry:", entry.id);
    return data?.server_updated_at as string | null;
  },

  fetchAllRemoteEntries: async (userId: string) => {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("vault_entries")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to fetch remote entries:", error);
      return [];
    }

    return data || [];
  },
};
