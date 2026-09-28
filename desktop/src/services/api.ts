import { invoke } from "@tauri-apps/api/core";
import {
  VaultEntry,
  VaultStatus,
  SaveEntryInput,
  InitVaultResponse,
  UnlockVaultResponse,
} from "../types";

export const api = {
  getVaultStatus: async (): Promise<VaultStatus> => {
    return await invoke<VaultStatus>("get_vault_status");
  },

  initVault: async (
    email: string,
    masterPassword: string
  ): Promise<InitVaultResponse> => {
    return await invoke<InitVaultResponse>("init_vault", {
      email,
      masterPassword,
    });
  },

  unlockVault: async (masterPassword: string): Promise<UnlockVaultResponse> => {
    return await invoke<UnlockVaultResponse>("unlock_vault", {
      masterPassword,
    });
  },

  lockVault: async (): Promise<boolean> => {
    return await invoke<boolean>("lock_vault");
  },

  listEntries: async (): Promise<VaultEntry[]> => {
    return await invoke<VaultEntry[]>("list_entries");
  },

  saveEntry: async (input: SaveEntryInput): Promise<VaultEntry> => {
    return await invoke<VaultEntry>("save_entry", { input });
  },

  deleteEntry: async (id: string): Promise<boolean> => {
    return await invoke<boolean>("delete_entry", { id });
  },

  generatePassword: async (options?: {
    length?: number;
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  }): Promise<string> => {
    return await invoke<string>("generate_password", options || {});
  },

  getPendingSync: async (): Promise<VaultEntry[]> => {
    return await invoke<VaultEntry[]>("get_pending_sync");
  },

  markEntrySynced: async (
    id: string,
    serverUpdatedAt: string
  ): Promise<boolean> => {
    return await invoke<boolean>("mark_entry_synced", {
      id,
      serverUpdatedAt,
    });
  },

  applyRemoteEntry: async (remote: {
    id: string;
    ciphertext: string;
    nonce: string;
    version: number;
    is_deleted: boolean;
    client_updated_at: string;
    server_updated_at: string;
  }): Promise<VaultEntry | null> => {
    return await invoke<VaultEntry | null>("apply_remote_entry", { remote });
  },

  resetVault: async (): Promise<boolean> => {
    return await invoke<boolean>("reset_vault");
  },

  changeMasterPassword: async (
    currentPassword: string,
    newPassword: string
  ): Promise<{
    success: boolean;
    auth_verifier: string;
    master_salt: string;
    encrypted_dek: string;
    dek_nonce: string;
  }> => {
    return await invoke("change_master_password", {
      currentPassword,
      newPassword,
    });
  },

  getSessionCredentials: async (): Promise<{
    email: string;
    auth_verifier: string;
    master_salt: string;
    encrypted_dek: string;
    dek_nonce: string;
  } | null> => {
    return await invoke("get_session_credentials");
  },

  deriveAuthVerifierFromSalt: async (
    email: string,
    masterPassword: string,
    masterSalt: string
  ): Promise<string> => {
    return await invoke<string>("derive_auth_verifier_from_salt", {
      email,
      masterPassword,
      masterSalt,
    });
  },

  importRemoteVaultMeta: async (
    email: string,
    masterPassword: string,
    masterSalt: string,
    encryptedDek: string,
    dekNonce: string
  ): Promise<UnlockVaultResponse> => {
    return await invoke<UnlockVaultResponse>("import_remote_vault_meta", {
      email,
      masterPassword,
      masterSalt,
      encryptedDek,
      dekNonce,
    });
  },
};
