export interface SecurityQuestion {
  question: string;
  answer: string;
}

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
  version: number;
  is_deleted: boolean;
  sync_status: string;
  client_updated_at: string;
  server_updated_at?: string | null;
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
}

export interface UnlockVaultResponse {
  success: boolean;
  auth_verifier: string;
  email: string;
  master_salt: string;
  encrypted_dek: string;
  dek_nonce: string;
}
