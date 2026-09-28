-- ====================================================================
-- PM: Personal Password Manager — Supabase Schema & Security Policies
-- ====================================================================

-- 1. Create Vault Metadata Table (Stores Salt and Encrypted DEK per user)
CREATE TABLE IF NOT EXISTS public.vault_metadata (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    master_salt TEXT NOT NULL,         -- Base64 16-byte salt for Argon2id
    encrypted_dek TEXT NOT NULL,       -- Base64 XChaCha20 ciphertext of the DEK
    dek_nonce TEXT NOT NULL,           -- Base64 24-byte nonce used to encrypt DEK
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for vault_metadata
ALTER TABLE public.vault_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read own vault metadata"
    ON public.vault_metadata FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own vault metadata"
    ON public.vault_metadata FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own vault metadata"
    ON public.vault_metadata FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. Create Vault Entries Table (Stores only encrypted payloads)
CREATE TABLE IF NOT EXISTS public.vault_entries (
    id UUID PRIMARY KEY,                                      -- Client-generated UUIDv4
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ciphertext TEXT NOT NULL,                                  -- Base64 encrypted payload
    nonce TEXT NOT NULL,                                       -- Base64 24-byte nonce
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,                 -- Tombstone flag
    client_updated_at TIMESTAMPTZ NOT NULL,                   -- Client timestamp for LWW
    server_updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL      -- Server ingestion timestamp
);

-- Indexes for sync performance
CREATE INDEX IF NOT EXISTS idx_vault_entries_user_sync 
    ON public.vault_entries (user_id, server_updated_at);

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_client_sync 
    ON public.vault_entries (user_id, client_updated_at);

-- Enable RLS for vault_entries
ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entries"
    ON public.vault_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
    ON public.vault_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
    ON public.vault_entries FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
    ON public.vault_entries FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Automatic server timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.server_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_server_updated_at ON public.vault_entries;
CREATE TRIGGER set_server_updated_at
    BEFORE UPDATE ON public.vault_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Supabase Realtime Replication for vault_entries
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_entries;
