# Build Plan: "PM" — Free Personal Password Manager

A zero-cost, zero-knowledge, local-first password manager that syncs across desktop (Linux, Windows, macOS) and mobile (Android, iOS) in real time using Tauri v2, Flutter, SQLCipher, and Supabase.

---

## Phase 0: Prerequisites & Cloud Setup

### Objective
Set up the Supabase backend project, define PostgreSQL schemas with Row-Level Security (RLS), configure real-time replication, and configure environment variables.

### Tasks
- [x] Create a free-tier Supabase project named `pm-vault` (Project URL: `https://fdavvijioofchmkgmihg.supabase.co`).
- [x] Disable Supabase email confirmation requirement for instant zero-friction signups.
- [x] Execute database migration script in Supabase SQL Editor:
  - Table `vault_metadata` (stores `master_salt`, `encrypted_dek`, `dek_nonce`).
  - Table `vault_entries` (stores `id`, `user_id`, `ciphertext`, `nonce`, `version`, `is_deleted`, `client_updated_at`, `server_updated_at`).
  - Strict RLS policies enforcing `auth.uid() = user_id`.
  - Trigger to auto-update `server_updated_at = NOW()`.
  - Enable Supabase Realtime publication on `vault_entries`.
- [x] Save API credentials in `.env` and `.env.example`.
- [x] Set up project root repository structure with Git.

### Files Created
- `/.env.example` — Environment template
- `/.gitignore` — Standard Rust/Node/Flutter ignores
- `/supabase/migrations/20260928000000_init_vault.sql` — Schema & RLS definitions

### Acceptance Criteria
1. Supabase SQL migration runs cleanly with 0 errors. (Passed)
2. Direct unauthenticated REST queries to `vault_entries` return `401 Unauthorized`. (Passed)
3. Authenticated queries cannot view or mutate another user's rows. (Passed)
4. Realtime is active on `public.vault_entries`. (Passed)

### Estimated Time
**2 hours** (Completed)

---

## Phase 1: Desktop Core (Tauri v2 + Rust + React/TS)

### Objective
Build the standalone offline desktop application with SQLCipher encrypted storage, Argon2id key derivation, XChaCha20-Poly1305 encryption/decryption, and full vault CRUD UI.

### Tasks
- [ ] Scaffold Tauri v2 project with React, TypeScript, Vite, and Tailwind CSS.
- [ ] Configure Rust backend dependencies:
  - `argon2` with Argon2id profile.
  - `chacha20poly1305` for XChaCha20-Poly1305.
  - `rusqlite` with `bundled-sqlcipher` feature for encrypted local storage.
  - `zeroize` for memory wiping of keys.
  - `rand_core` / `getrandom` for cryptographic nonce and salt generation.
- [ ] Implement Rust crypto module (`src-tauri/src/crypto/`):
  - `derive_master_key(master_password, salt) -> Zeroizing<[u8; 32]>`
  - `derive_auth_verifier(master_key, email) -> String`
  - `derive_sqlcipher_key(master_key, salt) -> String`
  - `generate_dek() -> Zeroizing<[u8; 32]>`
  - `encrypt_dek(dek, master_key) -> (Vec<u8>, [u8; 24])`
  - `decrypt_dek(enc_dek, nonce, master_key) -> Zeroizing<[u8; 32]>`
  - `encrypt_entry(plaintext_json, dek, entry_id) -> (Vec<u8>, [u8; 24])`
  - `decrypt_entry(ciphertext, nonce, dek, entry_id) -> Result<String>`
- [ ] Implement Rust database module (`src-tauri/src/db/`):
  - Initialize SQLCipher with `PRAGMA key = "x'...'";`.
  - Execute local table migrations: `local_meta`, `local_entries`.
  - Maintain cached decrypted entry attributes locally inside the encrypted database for sub-millisecond search and listing.
- [ ] Implement Tauri IPC command handlers:
  - `vault_exists()`
  - `init_vault(email, master_password)`
  - `unlock_vault(master_password)`
  - `lock_vault()`
  - `get_vault_state()`
  - `list_entries()`
  - `save_entry(entry)`
  - `delete_entry(entry_id)`
  - `generate_password(options)`
- [ ] Build React UI components:
  - Initial Setup & Master Password Onboarding view.
  - Unlock / Master Password prompt view.
  - Vault dashboard: sidebar (all items, favorites, trash), search bar, item list.
  - Entry detail / editor: title, username, password (with show/hide and copy), URL, notes, tags.
  - Built-in Password Generator popover with customizable length, symbols, numbers, and entropy calculation.

### Files to Create / Modify
- `/desktop/package.json`
- `/desktop/src-tauri/Cargo.toml`
- `/desktop/src-tauri/tauri.conf.json`
- `/desktop/src-tauri/src/main.rs`
- `/desktop/src-tauri/src/crypto/mod.rs`
- `/desktop/src-tauri/src/crypto/kdf.rs`
- `/desktop/src-tauri/src/crypto/cipher.rs`
- `/desktop/src-tauri/src/db/mod.rs`
- `/desktop/src-tauri/src/db/schema.rs`
- `/desktop/src-tauri/src/commands.rs`
- `/desktop/src/App.tsx`
- `/desktop/src/components/VaultList.tsx`
- `/desktop/src/components/EntryEditor.tsx`
- `/desktop/src/components/PasswordGenerator.tsx`
- `/desktop/src/components/UnlockScreen.tsx`

### Commands to Run
```bash
npm create tauri-app@latest desktop -- --template react-ts
cd desktop
npm install
npm install lucide-react clsx tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm run tauri dev
```

### Acceptance Criteria
1. App starts up offline with no internet access.
2. User can set up a new vault with email and master password.
3. SQLCipher database file created on disk is 100% unreadable with standard SQLite tools (`file is encrypted or is not a database`).
4. Creating, reading, updating, and deleting entries works instantly (<50ms).
5. Locking the vault drops database handles and zeroes the in-memory Master Key and DEK buffers.

### Estimated Time
**14 hours**

---

## Phase 2: Desktop Sync (Supabase Client + Realtime Sync Engine)

### Objective
Integrate Supabase Auth and Realtime sync engine on desktop. Ensure bidirectional sync, offline queuing, and last-write-wins (LWW) conflict resolution with latency <2s.

### Tasks
- [ ] Integrate Supabase client in desktop app:
  - Auth registration & login via derived `auth_verifier` (Supabase never receives Master Password or Master Key).
  - Sync initial `vault_metadata` (`master_salt`, `encrypted_dek`, `dek_nonce`) upon first vault creation.
  - Fetch `vault_metadata` during first unlock on an existing account.
- [ ] Implement Offline Write Queue:
  - When offline or disconnected, local entries record `sync_status = 'pending_insert' | 'pending_update' | 'pending_delete'`.
  - Reconnect listener automatically drains the offline queue in batch upserts to Supabase.
- [ ] Implement Realtime WebSocket Listener:
  - Subscribe to Supabase channel `postgres_changes` on `vault_entries` where `user_id = auth.uid()`.
  - Handle incoming `INSERT` / `UPDATE`:
    - Compare `incoming.client_updated_at` with `local.client_updated_at`.
    - If incoming is newer: decrypt ciphertext using local DEK, update SQLCipher DB, emit event to React UI.
    - If incoming has `is_deleted = true`: mark local entry deleted.
- [ ] Implement Push Sync:
  - On any local entry mutation (create/edit/delete), encrypt payload with DEK, update local DB, and fire background upsert to Supabase `vault_entries`.
- [ ] Build Sync Status UI indicator (Connected / Syncing / Offline / Sync Error) and "Force Sync" trigger.

### Files to Create / Modify
- `/desktop/src/services/supabase.ts`
- `/desktop/src/services/auth.ts`
- `/desktop/src/services/syncEngine.ts`
- `/desktop/src-tauri/src/commands.rs` (add sync dispatch hooks)
- `/desktop/src/components/SyncStatusBadge.tsx`

### Acceptance Criteria
1. Creating an entry on Desktop immediately uploads ciphertext and nonce to Supabase `vault_entries` table.
2. Inspecting Supabase PostgreSQL table via web dashboard reveals only random Base64 ciphertext, zero plaintext.
3. Editing an entry in two desktop windows resolves within <2 seconds via WebSocket without reloading the app.
4. Cutting internet connection, modifying 3 entries, restoring connection results in automatic sync flush to Supabase.

### Estimated Time
**10 hours**

---

## Phase 3: Mobile (Flutter for Android & iOS)

### Objective
Scaffold the Flutter mobile app using identical cryptographic primitives, identical SQLCipher local database schema, and identical Supabase Realtime sync protocol. Produce installable release APK and iOS IPA build configs.

### Tasks
- [ ] Scaffold Flutter application in `/mobile`.
- [ ] Configure `pubspec.yaml` dependencies:
  - `sqflite_sqlcipher` for local encrypted SQLite.
  - `cryptography` (pure Dart, high-performance XChaCha20-Poly1305, HKDF, CSPRNG).
  - `dargon2` / `pointycastle` for Argon2id key derivation.
  - `supabase_flutter` for Supabase Auth, REST, and Realtime WebSocket subscriptions.
  - `flutter_secure_storage` for storing encrypted biometric keys.
  - `local_auth` for fingerprint / Face ID.
  - `flutter_riverpod` for reactive state management.
- [ ] Implement Dart crypto service (`lib/crypto/`):
  - Ensure exact byte-level parity with Rust implementation for Argon2id ($m=64\text{MiB}, t=3, p=4$), HKDF derivations, and XChaCha20-Poly1305 AAD construction.
  - Write test harness verifying cross-platform crypto compatibility (decrypting sample vectors generated by Rust in Dart).
- [ ] Implement Local Database (`lib/db/`):
  - SQLCipher open database with derived key.
  - Mirror desktop table structures and indexing.
- [ ] Implement Mobile Sync Engine (`lib/sync/`):
  - Supabase Realtime subscription.
  - Push/Pull sync routines with LWW conflict resolution.
- [ ] Implement Flutter UI:
  - Material 3 mobile interface.
  - Master Password unlock screen.
  - Vault item list with quick copy buttons.
  - Entry detail / edit sheet.
  - Password generator bottom sheet.
- [ ] Configure build scripts:
  - Android: `keystore` configuration, ProGuard rules for SQLCipher/Argon2.
  - iOS: Xcode workspace configuration, entitlements.

### Acceptance Criteria
1. An entry created on Desktop appears on Mobile within <2 seconds when both are online.
2. An entry created on Mobile appears on Desktop within <2 seconds.
3. Mobile works completely offline: cached entries can be viewed, searched, and updated without network.
4. Crypto test suite passes identically on both Dart and Rust using fixed test vectors.
5. `app-release.apk` builds successfully and installs on Android device without crashes.

### Estimated Time
**16 hours**

---

## Phase 4: Hardening & Security

### Tasks
- [ ] Memory Zeroization:
  - Rust: Wrap Master Key and DEK buffers with `zeroize::ZeroizeOnDrop`.
  - Dart: Clear memory byte arrays on lock and when app is backgrounded.
- [ ] Auto-Lock Timers:
  - Desktop: Detect user inactivity via idle timer (default: 5 min) and window focus lost; wipe memory and revert UI to Unlock screen.
  - Mobile: AppLifecycleListener locks vault when app enters `AppLifecycleState.paused` or `detached`.
- [ ] Clipboard Clearing:
  - Desktop: Implement timed clipboard clear (wipes clipboard after 30 seconds if it still holds the copied password).
  - Mobile: Mark clipboard content as sensitive (`ClipDescription.classification = 'secret'`) and auto-clear after 30 seconds.
- [ ] Biometric Unlock:
  - Mobile: Use `local_auth` to authenticate with Fingerprint / Face ID; decrypt local Master Key or DEK stored in hardware-backed Android Keystore / iOS Keychain.
  - Desktop: System keychain integration (Windows Credential Manager / macOS Keychain / Secret Service).
- [ ] Master Password Change Flow:
  - User supplies old password and new password.
  - Derive new Master Key from new password and newly generated salt.
  - Re-encrypt the existing 32-byte DEK under the new Master Key.
  - Update `vault_metadata` (`master_salt`, `encrypted_dek`, `dek_nonce`) locally and remotely.
  - **No vault entries need re-encryption**, guaranteeing instant password change without network saturation or risk of corruption.

### Acceptance Criteria
1. Leaving the app idle for the configured timeout immediately locks the vault.
2. Copying a password sets the clipboard, and after 30 seconds, clipboard is verified blank/cleared.
3. Memory dump inspection confirms no plaintext passwords or raw master keys persist after lock.
4. Changing Master Password takes <1 second and syncs to other devices; old master password fails, new master password unlocks vault seamlessly.

### Estimated Time
**8 hours**

---

## Phase 5: Polish & Distribution Builds

### Tasks
- [ ] Search & Filters:
  - Instant local search across title, username, URL, and notes using SQLCipher indices.
  - Filter by Favorites, Categories, and Tags.
- [ ] Import / Export:
  - Import parser supporting CSV format from Bitwarden, 1Password, LastPass, and Google Chrome.
  - Export to encrypted JSON backup file (encrypted with Master Key) and unencrypted CSV (with security warning confirmation).
- [ ] UI / UX Polish:
  - Dark mode and light mode matching OS preference.
  - Visual password strength meter (entropy estimation).
  - Compact view / Expanded view toggle.
- [ ] Packaging & Release Scripts:
  - Desktop: Configure `tauri build` to output `.msi` (Windows), `.deb` / `.AppImage` (Linux), and `.dmg` (macOS).
  - Mobile: Script to produce release `.apk` (Android) and export Xcode archive for iOS.

### Acceptance Criteria
1. Importing a standard 500-item Bitwarden CSV completes in <2 seconds, encrypts all entries, and syncs reliably.
2. Search returns filtered results on every keystroke with 0 lag.
3. Windows installer (`.msi` or `.exe`) installs and runs smoothly on target Windows PC.
4. Linux (`.AppImage` / `.deb`) runs smoothly on Ubuntu/Debian.
5. Android `.apk` installs on phone, logs in with same credentials, and shows all imported passwords immediately.

### Estimated Time
**8 hours**

---

## Summary of Estimated Time
| Phase | Focus Area | Estimated Time |
|---|---|---|
| **Phase 0** | Prerequisites & Supabase Cloud Setup | 2 hours |
| **Phase 1** | Desktop Core (Tauri v2 + Rust + React/TS) | 14 hours |
| **Phase 2** | Desktop Sync (Supabase Client + Realtime) | 10 hours |
| **Phase 3** | Mobile (Flutter + SQLCipher + Cross-Platform Crypto) | 16 hours |
| **Phase 4** | Hardening (Biometrics, Auto-Lock, Zeroize, Rekeying) | 8 hours |
| **Phase 5** | Polish, Import/Export & Distribution Builds | 8 hours |
| **Total** | | **58 hours** |

---

## Appendix: Crypto Constants

All platforms **must** use these identical parameters:

```yaml
Argon2id (Master Key Derivation):
  Variant: Argon2id
  Version: 0x13 (19)
  Memory ($m$): 65536 KiB (64 MiB)
  Iterations ($t$): 3
  Parallelism ($p$): 4
  Salt Length: 16 bytes (CSPRNG generated)
  Output Key Length: 32 bytes (256 bits)

Auth Verifier Derivation (Sent to Supabase Auth as password):
  Algorithm: HKDF-SHA256
  Input Key Material (IKM): Master Key (32 bytes)
  Salt: Lowercase trimmed user email bytes
  Info: "pm:auth:supabase_password"
  Output: 32 bytes -> Encoded as 64-char lowercase hex string

Local SQLCipher DB Key:
  Algorithm: HKDF-SHA256
  Input Key Material (IKM): Master Key (32 bytes)
  Salt: Stored local device salt (16 bytes)
  Info: "pm:local_storage:sqlcipher"
  Output: 32 bytes -> Passed as hex to PRAGMA key = "x'...'";

Data Encryption Key (DEK):
  Generation: 32 bytes CSPRNG
  Encryption Cipher: XChaCha20-Poly1305
  DEK Nonce Length: 24 bytes (CSPRNG generated)
  DEK AAD: "pm:dek:v1"

Entry Encryption:
  Cipher: XChaCha20-Poly1305
  Key: DEK (32 bytes)
  Nonce Length: 24 bytes (CSPRNG generated per encryption)
  Tag Length: 16 bytes
  Additional Authenticated Data (AAD): entry_id (UUIDv4 string bytes)
  Plaintext Format: UTF-8 JSON string {"title":"...","username":"...","password":"...","url":"...","notes":"...","tags":[],"custom_fields":{}}
  Stored Format: Base64-encoded ciphertext (including 16-byte Poly1305 tag)
```

---

## Appendix: Supabase Schema (SQL)

```sql
-- 1. Create Vault Metadata Table
CREATE TABLE IF NOT EXISTS public.vault_metadata (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    master_salt TEXT NOT NULL,
    encrypted_dek TEXT NOT NULL,
    dek_nonce TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

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

-- 2. Create Vault Entries Table
CREATE TABLE IF NOT EXISTS public.vault_entries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    client_updated_at TIMESTAMPTZ NOT NULL,
    server_updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_sync 
    ON public.vault_entries (user_id, server_updated_at);

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_client_sync 
    ON public.vault_entries (user_id, client_updated_at);

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

-- 4. Enable Supabase Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_entries;
```

---

## Appendix: .env.example

```ini
# Supabase Configuration
VITE_SUPABASE_URL=https://fdavvijioofchmkgmihg.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key-here
```
