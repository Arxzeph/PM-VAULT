-- ====================================================================
-- PM Vault V2.2 — Forward Migration: Envelope Protocol, Metadata Versions & Concurrency RPC
-- ====================================================================

-- 1. Ensure vault_metadata has versioning columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vault_metadata' AND column_name = 'dek_wrap_version'
    ) THEN
        ALTER TABLE public.vault_metadata ADD COLUMN dek_wrap_version INTEGER NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vault_metadata' AND column_name = 'key_generation'
    ) THEN
        ALTER TABLE public.vault_metadata ADD COLUMN key_generation INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- 2. Ensure vault_entries has proper constraints and indices
DO $$
BEGIN
    -- Backfill revision from version if revision was default 1 and version is higher
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vault_entries' AND column_name = 'version'
    ) THEN
        UPDATE public.vault_entries 
        SET revision = GREATEST(version, 1) 
        WHERE revision = 1 AND version > 1;
    END IF;
END $$;

-- Add check constraints safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_vault_entries_crypto_version'
    ) THEN
        ALTER TABLE public.vault_entries 
            ADD CONSTRAINT chk_vault_entries_crypto_version CHECK (crypto_version IN (1, 2));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_vault_entries_schema_version'
    ) THEN
        ALTER TABLE public.vault_entries 
            ADD CONSTRAINT chk_vault_entries_schema_version CHECK (payload_schema_version >= 1);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_vault_entries_revision'
    ) THEN
        ALTER TABLE public.vault_entries 
            ADD CONSTRAINT chk_vault_entries_revision CHECK (revision >= 1);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_revision 
    ON public.vault_entries (user_id, revision);

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_server_sync 
    ON public.vault_entries (user_id, server_updated_at);

-- 3. Stored Procedure for Optimistic Concurrency Upsert
CREATE OR REPLACE FUNCTION public.upsert_vault_envelope(
    p_id UUID,
    p_crypto_version INTEGER,
    p_payload_schema_version INTEGER,
    p_nonce TEXT,
    p_ciphertext TEXT,
    p_revision BIGINT,
    p_is_deleted BOOLEAN,
    p_client_updated_at TIMESTAMPTZ,
    p_expected_previous_revision BIGINT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    status TEXT,
    current_revision BIGINT,
    server_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_current_rev BIGINT;
    v_server_time TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Look up existing record for this user
    SELECT revision INTO v_current_rev
    FROM public.vault_entries
    WHERE id = p_id AND user_id = v_user_id;

    IF v_current_rev IS NOT NULL THEN
        -- If previous revision is specified, enforce optimistic concurrency
        IF p_expected_previous_revision IS NOT NULL AND v_current_rev != p_expected_previous_revision THEN
            RETURN QUERY SELECT false, 'stale_revision', v_current_rev, NOW();
            RETURN;
        END IF;

        -- Revisions must strictly advance
        IF p_revision <= v_current_rev THEN
            RETURN QUERY SELECT false, 'stale_revision', v_current_rev, NOW();
            RETURN;
        END IF;

        UPDATE public.vault_entries
        SET crypto_version = p_crypto_version,
            payload_schema_version = p_payload_schema_version,
            nonce = p_nonce,
            ciphertext = p_ciphertext,
            revision = p_revision,
            is_deleted = p_is_deleted,
            client_updated_at = p_client_updated_at,
            server_updated_at = NOW()
        WHERE id = p_id AND user_id = v_user_id
        RETURNING vault_entries.server_updated_at INTO v_server_time;

        RETURN QUERY SELECT true, 'updated', p_revision, v_server_time;
        RETURN;
    ELSE
        -- Insert new envelope
        INSERT INTO public.vault_entries (
            id, user_id, crypto_version, payload_schema_version,
            nonce, ciphertext, revision, is_deleted,
            client_updated_at, server_updated_at
        ) VALUES (
            p_id, v_user_id, p_crypto_version, p_payload_schema_version,
            p_nonce, p_ciphertext, p_revision, p_is_deleted,
            p_client_updated_at, NOW()
        )
        RETURNING vault_entries.server_updated_at INTO v_server_time;

        RETURN QUERY SELECT true, 'inserted', p_revision, v_server_time;
        RETURN;
    END IF;
END;
$$;

-- 4. Secure Recovery Function Permissions
-- Revoke execution from PUBLIC, anon, and authenticated users
REVOKE ALL ON FUNCTION public.verify_recovery_auth(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_recovery_auth(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_recovery_auth(TEXT, TEXT) FROM authenticated;

-- Grant execution strictly to service_role (used by Edge Function)
GRANT EXECUTE ON FUNCTION public.verify_recovery_auth(TEXT, TEXT) TO service_role;

-- 5. Durable Recovery Rate Limits
CREATE TABLE IF NOT EXISTS public.recovery_rate_limits (
    rate_key TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recovery_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_and_increment_recovery_rate_limit(
    p_key TEXT,
    p_max_attempts INTEGER DEFAULT 5,
    p_window_seconds INTEGER DEFAULT 3600
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_attempts INTEGER;
    v_first_at TIMESTAMPTZ;
BEGIN
    SELECT attempts, first_attempt_at
    INTO v_attempts, v_first_at
    FROM public.recovery_rate_limits
    WHERE rate_key = p_key;

    IF NOT FOUND THEN
        INSERT INTO public.recovery_rate_limits (rate_key, attempts, first_attempt_at, last_attempt_at)
        VALUES (p_key, 1, v_now, v_now);
        RETURN TRUE;
    END IF;

    -- If window has elapsed, reset bucket
    IF v_now - v_first_at > (p_window_seconds || ' seconds')::INTERVAL THEN
        UPDATE public.recovery_rate_limits
        SET attempts = 1, first_attempt_at = v_now, last_attempt_at = v_now
        WHERE rate_key = p_key;
        RETURN TRUE;
    END IF;

    -- If attempts exceed max, deny
    IF v_attempts >= p_max_attempts THEN
        RETURN FALSE;
    END IF;

    -- Otherwise increment
    UPDATE public.recovery_rate_limits
    SET attempts = attempts + 1, last_attempt_at = v_now
    WHERE rate_key = p_key;
    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_recovery_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_increment_recovery_rate_limit(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.check_and_increment_recovery_rate_limit(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_recovery_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

