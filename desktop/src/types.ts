export interface SecurityQuestion {
  question: string;
  answer: string;
}

export type SyncState = "pending_insert" | "pending_update" | "pending_delete" | "synced" | "conflict";

/// Wire & SQLite encrypted envelope model.
/// Never contains plaintext credentials.
export interface EncryptedEnvelope {
  id: string;
  owner_id: string;
  crypto_version: number;
  payload_schema_version: number;
  nonce: string;
  ciphertext: string;
  revision: number;
  is_deleted: boolean;
  client_updated_at: string;
  server_updated_at?: string | null;
  sync_state?: SyncState;
}

/// Decrypted in-memory UI/domain DTO.
export interface VaultEntry {
  id: string;
  title: string;
  username?: string | null;
  password?: string | null;
  url?: string | null;
  notes?: string | null;
  security_questions?: SecurityQuestion[];
  tags: string[];
  favorite: boolean;
  ciphertext: string;
  nonce: string;
  revision: number;
  version: number; // Backwards-compatible alias for UI components
  is_deleted: boolean;
  sync_status: string;
  client_updated_at: string;
  server_updated_at?: string | null;
}

export interface VaultLoadFailure {
  id: string;
  reason_code: string;
  crypto_version: number;
  revision: number;
  error_message: string;
}

export interface VaultLoadResult {
  entries: VaultEntry[];
  failures: VaultLoadFailure[];
}

export interface VaultStatus {
  is_initialized: boolean;
  is_unlocked: boolean;
  email?: string | null;
}

export interface SaveEntryInput {
  id?: string;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  security_questions?: SecurityQuestion[];
  tags: string[];
  favorite: boolean;
}

export interface InitVaultResponse {
  success: boolean;
  auth_verifier: string;
  master_salt: string;
  encrypted_dek: string;
  dek_nonce: string;
  recovery_code?: string;
  recovery_auth_hash?: string;
  recovery_wrapped_dek?: string;
  recovery_nonce?: string;
}

export interface UnlockVaultResponse {
  success: boolean;
  auth_verifier: string;
  email: string;
  master_salt: string;
  encrypted_dek: string;
  dek_nonce: string;
}

export interface SessionCredentials {
  email: string;
  auth_verifier: string;
  master_salt: string;
  encrypted_dek: string;
  dek_nonce: string;
  owner_id?: string;
}

export interface RemoteVaultMetadata {
  id: string;
  master_salt: string;
  encrypted_dek: string;
  dek_nonce: string;
  dek_wrap_version: number;
  key_generation: number;
  created_at: string;
  updated_at: string;
}
