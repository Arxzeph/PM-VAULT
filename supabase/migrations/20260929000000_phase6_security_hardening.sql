-- ====================================================================
-- PM Vault V2.2 — Phase 6 Security Hardening Migration
-- Zero-Knowledge Split Recovery Architecture & Concurrency Revisions
-- ====================================================================

-- 1. Create Vault Recovery Table (Domain-separated split secret recovery)
CREATE TABLE IF NOT EXISTS public.vault_recovery (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    recovery_code_id UUID NOT NULL,
    recovery_generation INTEGER NOT NULL DEFAULT 1,
    recovery_auth_hash TEXT NOT NULL,          -- Hex-encoded SHA-256(RecoveryAuthToken)
    recovery_wrapped_dek TEXT NOT NULL,        -- Base64 XChaCha20-Poly1305(REK, DEK)
    recovery_nonce TEXT NOT NULL,              -- Base64 24-byte nonce
    recovery_aad_version INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    revoked_at TIMESTAMPTZ
);

ALTER TABLE public.vault_recovery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recovery blob"
    ON public.vault_recovery FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Extend vault_entries table for V2 Cryptographic Envelopes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vault_entries' AND column_name = 'crypto_version'
    ) THEN
        ALTER TABLE public.vault_entries ADD COLUMN crypto_version INTEGER NOT NULL DEFAULT 2;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vault_entries' AND column_name = 'payload_schema_version'
    ) THEN
        ALTER TABLE public.vault_entries ADD COLUMN payload_schema_version INTEGER NOT NULL DEFAULT 2;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vault_entries' AND column_name = 'revision'
    ) THEN
        ALTER TABLE public.vault_entries ADD COLUMN revision BIGINT NOT NULL DEFAULT 1;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vault_entries_concurrency 
    ON public.vault_entries (id, revision);

-- 3. Stored Procedure for Edge Function Recovery Authentication
CREATE OR REPLACE FUNCTION public.verify_recovery_auth(
    p_email TEXT,
    p_auth_hash TEXT
)
RETURNS TABLE (
    user_id UUID,
    recovery_wrapped_dek TEXT,
    recovery_nonce TEXT,
    recovery_generation INTEGER,
    recovery_aad_version INTEGER
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = LOWER(TRIM(p_email));
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        vr.user_id,
        vr.recovery_wrapped_dek,
        vr.recovery_nonce,
        vr.recovery_generation,
        vr.recovery_aad_version
    FROM public.vault_recovery vr
    WHERE vr.user_id = v_user_id
      AND vr.recovery_auth_hash = p_auth_hash
      AND vr.revoked_at IS NULL;
END;
$$;
