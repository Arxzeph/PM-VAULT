use crate::crypto::{
    decrypt_dek, decrypt_entry, derive_auth_verifier, derive_master_key, encrypt_dek,
    encrypt_entry, generate_dek, generate_password as gen_pwd, generate_salt,
};
use crate::db::{self, EntryPayload, VaultEntryDto};
use crate::state::{AppState, VaultSession};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Serialize)]
pub struct VaultStatus {
    pub is_initialized: bool,
    pub is_unlocked: bool,
    pub email: Option<String>,
}

#[derive(Serialize)]
pub struct InitVaultResponse {
    pub success: bool,
    pub auth_verifier: String,
    pub master_salt: String,
    pub encrypted_dek: String,
    pub dek_nonce: String,
}

#[derive(Serialize)]
pub struct UnlockVaultResponse {
    pub success: bool,
    pub auth_verifier: String,
    pub email: String,
    pub master_salt: String,
    pub encrypted_dek: String,
    pub dek_nonce: String,
}

#[derive(Deserialize)]
pub struct SaveEntryInput {
    pub id: Option<String>,
    pub title: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub favorite: bool,
}

#[tauri::command]
pub fn get_vault_status(state: State<'_, AppState>) -> Result<VaultStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let salt = db::get_meta(&conn, "master_salt")?;
    let email = db::get_meta(&conn, "user_email")?;
    let is_unlocked = state.is_unlocked();

    Ok(VaultStatus {
        is_initialized: salt.is_some(),
        is_unlocked,
        email,
    })
}

#[derive(Serialize)]
pub struct SessionCredentials {
    pub email: String,
    pub auth_verifier: String,
    pub master_salt: String,
    pub encrypted_dek: String,
    pub dek_nonce: String,
}

#[tauri::command]
pub fn get_session_credentials(state: State<'_, AppState>) -> Result<Option<SessionCredentials>, String> {
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(ref session) = *session_guard {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let salt = db::get_meta(&conn, "master_salt")?.unwrap_or_default();
        let enc_dek = db::get_meta(&conn, "encrypted_dek")?.unwrap_or_default();
        let dek_nonce = db::get_meta(&conn, "dek_nonce")?.unwrap_or_default();

        Ok(Some(SessionCredentials {
            email: session.email.clone(),
            auth_verifier: session.auth_verifier.clone(),
            master_salt: salt,
            encrypted_dek: enc_dek,
            dek_nonce,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn init_vault(
    email: String,
    master_password: String,
    state: State<'_, AppState>,
) -> Result<InitVaultResponse, String> {
    let email_clean = email.trim().to_lowercase();
    if email_clean.is_empty() {
        return Err("Email cannot be empty".into());
    }
    if master_password.len() < 8 {
        return Err("Master password must be at least 8 characters".into());
    }

    // 1. Generate salt and derive Master Key
    let salt = generate_salt();
    let master_key = derive_master_key(&master_password, &salt)?;

    // 2. Generate random 32-byte DEK
    let dek = generate_dek();

    // 3. Encrypt DEK with Master Key
    let (enc_dek, dek_nonce) = encrypt_dek(&dek, &master_key)?;

    // 4. Derive Auth Verifier for Supabase
    let auth_verifier = derive_auth_verifier(&master_key, &email_clean)?;

    let salt_b64 = BASE64.encode(salt);
    let enc_dek_b64 = BASE64.encode(&enc_dek);
    let dek_nonce_b64 = BASE64.encode(dek_nonce);

    // 5. Save to local metadata database
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_meta(&conn, "user_email", &email_clean)?;
    db::set_meta(&conn, "master_salt", &salt_b64)?;
    db::set_meta(&conn, "encrypted_dek", &enc_dek_b64)?;
    db::set_meta(&conn, "dek_nonce", &dek_nonce_b64)?;

    // 6. Save active session
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Some(VaultSession {
        email: email_clean,
        auth_verifier: auth_verifier.clone(),
        master_key,
        dek,
    });

    Ok(InitVaultResponse {
        success: true,
        auth_verifier,
        master_salt: salt_b64,
        encrypted_dek: enc_dek_b64,
        dek_nonce: dek_nonce_b64,
    })
}

#[tauri::command]
pub fn unlock_vault(
    master_password: String,
    state: State<'_, AppState>,
) -> Result<UnlockVaultResponse, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let salt_b64 = db::get_meta(&conn, "master_salt")?
        .ok_or_else(|| "Vault not initialized. Please create or import a vault.".to_string())?;
    let enc_dek_b64 = db::get_meta(&conn, "encrypted_dek")?
        .ok_or_else(|| "Corrupted vault: missing encrypted DEK".to_string())?;
    let dek_nonce_b64 = db::get_meta(&conn, "dek_nonce")?
        .ok_or_else(|| "Corrupted vault: missing DEK nonce".to_string())?;
    let email = db::get_meta(&conn, "user_email")?
        .unwrap_or_default();

    let salt = BASE64.decode(&salt_b64).map_err(|e| e.to_string())?;
    let enc_dek = BASE64.decode(&enc_dek_b64).map_err(|e| e.to_string())?;
    let dek_nonce_vec = BASE64.decode(&dek_nonce_b64).map_err(|e| e.to_string())?;

    if dek_nonce_vec.len() != 24 {
        return Err("Invalid DEK nonce length".into());
    }
    let mut dek_nonce = [0u8; 24];
    dek_nonce.copy_from_slice(&dek_nonce_vec);

    // Derive Master Key
    let master_key = derive_master_key(&master_password, &salt)?;

    // Decrypt DEK
    let dek = decrypt_dek(&enc_dek, &dek_nonce, &master_key)?;

    // Derive Auth Verifier
    let auth_verifier = derive_auth_verifier(&master_key, &email)?;

    // Set Session
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Some(VaultSession {
        email: email.clone(),
        auth_verifier: auth_verifier.clone(),
        master_key,
        dek,
    });

    Ok(UnlockVaultResponse {
        success: true,
        auth_verifier,
        email,
        master_salt: salt_b64,
        encrypted_dek: enc_dek_b64,
        dek_nonce: dek_nonce_b64,
    })
}

#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<bool, String> {
    state.lock();
    Ok(true)
}

#[tauri::command]
pub fn list_entries(state: State<'_, AppState>) -> Result<Vec<VaultEntryDto>, String> {
    if !state.is_unlocked() {
        return Err("Vault is locked".into());
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::list_active_entries(&conn)
}

#[tauri::command]
pub fn save_entry(
    input: SaveEntryInput,
    state: State<'_, AppState>,
) -> Result<VaultEntryDto, String> {
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard.as_ref().ok_or_else(|| "Vault is locked".to_string())?;

    let entry_id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = Utc::now().to_rfc3339();

    // Prepare JSON payload for encryption
    let payload = EntryPayload {
        title: input.title.clone(),
        username: input.username.clone(),
        password: input.password.clone(),
        url: input.url.clone(),
        notes: input.notes.clone(),
        tags: input.tags.clone(),
        favorite: input.favorite,
    };
    let payload_json = serde_json::to_string(&payload)
        .map_err(|e| format!("Failed to serialize entry payload: {}", e))?;

    // Encrypt entry payload with DEK using entry_id as AAD
    let (ciphertext, nonce) = encrypt_entry(&payload_json, &session.dek, &entry_id)?;
    let ct_b64 = BASE64.encode(&ciphertext);
    let nonce_b64 = BASE64.encode(nonce);

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let existing = db::get_entry_by_id(&conn, &entry_id)?;
    let version = existing.map(|e| e.version + 1).unwrap_or(1);

    let entry = VaultEntryDto {
        id: entry_id,
        title: input.title,
        username: input.username,
        password: input.password,
        url: input.url,
        notes: input.notes,
        tags: input.tags,
        favorite: input.favorite,
        ciphertext: ct_b64,
        nonce: nonce_b64,
        version,
        is_deleted: false,
        sync_status: "pending_update".to_string(),
        client_updated_at: now,
        server_updated_at: None,
    };

    db::upsert_entry(&conn, &entry)?;
    Ok(entry)
}

#[tauri::command]
pub fn delete_entry(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    if !state.is_unlocked() {
        return Err("Vault is locked".into());
    }
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::soft_delete_entry(&conn, &id, &now)?;
    Ok(true)
}

#[tauri::command]
pub fn generate_password(
    length: Option<usize>,
    uppercase: Option<bool>,
    lowercase: Option<bool>,
    numbers: Option<bool>,
    symbols: Option<bool>,
) -> String {
    gen_pwd(
        length.unwrap_or(20),
        uppercase.unwrap_or(true),
        lowercase.unwrap_or(true),
        numbers.unwrap_or(true),
        symbols.unwrap_or(true),
    )
}

#[tauri::command]
pub fn import_remote_vault_meta(
    email: String,
    master_password: String,
    master_salt: String,
    encrypted_dek: String,
    dek_nonce: String,
    state: State<'_, AppState>,
) -> Result<UnlockVaultResponse, String> {
    let email_clean = email.trim().to_lowercase();
    let salt = BASE64.decode(&master_salt).map_err(|e| e.to_string())?;
    let enc_dek = BASE64.decode(&encrypted_dek).map_err(|e| e.to_string())?;
    let dek_nonce_vec = BASE64.decode(&dek_nonce).map_err(|e| e.to_string())?;

    if dek_nonce_vec.len() != 24 {
        return Err("Invalid DEK nonce length".into());
    }
    let mut nonce_arr = [0u8; 24];
    nonce_arr.copy_from_slice(&dek_nonce_vec);

    let master_key = derive_master_key(&master_password, &salt)?;
    let dek = decrypt_dek(&enc_dek, &nonce_arr, &master_key)?;
    let auth_verifier = derive_auth_verifier(&master_key, &email_clean)?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_meta(&conn, "user_email", &email_clean)?;
    db::set_meta(&conn, "master_salt", &master_salt)?;
    db::set_meta(&conn, "encrypted_dek", &encrypted_dek)?;
    db::set_meta(&conn, "dek_nonce", &dek_nonce)?;

    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Some(VaultSession {
        email: email_clean.clone(),
        auth_verifier: auth_verifier.clone(),
        master_key,
        dek,
    });

    Ok(UnlockVaultResponse {
        success: true,
        auth_verifier,
        email: email_clean,
        master_salt,
        encrypted_dek,
        dek_nonce,
    })
}

#[tauri::command]
pub fn derive_auth_verifier_from_salt(
    email: String,
    master_password: String,
    master_salt: String,
) -> Result<String, String> {
    let email_clean = email.trim().to_lowercase();
    let salt = BASE64.decode(&master_salt).map_err(|e| e.to_string())?;
    let master_key = derive_master_key(&master_password, &salt)?;
    derive_auth_verifier(&master_key, &email_clean)
}

#[tauri::command]
pub fn get_pending_sync(state: State<'_, AppState>) -> Result<Vec<VaultEntryDto>, String> {
    if !state.is_unlocked() {
        return Err("Vault is locked".into());
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_pending_sync(&conn)
}

#[tauri::command]
pub fn mark_entry_synced(
    id: String,
    server_updated_at: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(mut entry) = db::get_entry_by_id(&conn, &id)? {
        entry.sync_status = "synced".to_string();
        entry.server_updated_at = Some(server_updated_at);
        db::upsert_entry(&conn, &entry)?;
    }
    Ok(true)
}

#[derive(Deserialize)]
pub struct RemoteEntryPayload {
    pub id: String,
    pub ciphertext: String,
    pub nonce: String,
    pub version: i32,
    pub is_deleted: bool,
    pub client_updated_at: String,
    pub server_updated_at: String,
}

#[tauri::command]
pub fn apply_remote_entry(
    remote: RemoteEntryPayload,
    state: State<'_, AppState>,
) -> Result<Option<VaultEntryDto>, String> {
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard.as_ref().ok_or_else(|| "Vault is locked".to_string())?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let existing = db::get_entry_by_id(&conn, &remote.id)?;

    // Last-Write-Wins (LWW) conflict resolution:
    if let Some(ref local) = existing {
        if local.client_updated_at >= remote.client_updated_at {
            // Local is newer or equal, ignore remote
            return Ok(None);
        }
    }

    // Decrypt remote ciphertext using DEK
    let ct = BASE64.decode(&remote.ciphertext).map_err(|e| e.to_string())?;
    let nonce_vec = BASE64.decode(&remote.nonce).map_err(|e| e.to_string())?;
    if nonce_vec.len() != 24 {
        return Err("Invalid nonce length from remote".into());
    }
    let mut nonce_arr = [0u8; 24];
    nonce_arr.copy_from_slice(&nonce_vec);

    let decrypted_json = decrypt_entry(&ct, &nonce_arr, &session.dek, &remote.id)?;
    let payload: EntryPayload = serde_json::from_str(&decrypted_json)
        .map_err(|e| format!("Failed to parse decrypted remote payload: {}", e))?;

    let entry = VaultEntryDto {
        id: remote.id,
        title: payload.title,
        username: payload.username,
        password: payload.password,
        url: payload.url,
        notes: payload.notes,
        tags: payload.tags,
        favorite: payload.favorite,
        ciphertext: remote.ciphertext,
        nonce: remote.nonce,
        version: remote.version,
        is_deleted: remote.is_deleted,
        sync_status: "synced".to_string(),
        client_updated_at: remote.client_updated_at,
        server_updated_at: Some(remote.server_updated_at),
    };

    db::upsert_entry(&conn, &entry)?;
    Ok(Some(entry))
}

#[tauri::command]
pub fn reset_vault(state: State<'_, AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM local_meta", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM local_entries", []).map_err(|e| e.to_string())?;
    state.lock();
    Ok(true)
}

#[derive(Serialize)]
pub struct ChangePasswordResponse {
    pub success: bool,
    pub auth_verifier: String,
    pub master_salt: String,
    pub encrypted_dek: String,
    pub dek_nonce: String,
}

#[tauri::command]
pub fn change_master_password(
    current_password: String,
    new_password: String,
    state: State<'_, AppState>,
) -> Result<ChangePasswordResponse, String> {
    if new_password.len() < 8 {
        return Err("New master password must be at least 8 characters long.".into());
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let salt_b64 = db::get_meta(&conn, "master_salt")?
        .ok_or_else(|| "Vault not initialized.".to_string())?;
    let enc_dek_b64 = db::get_meta(&conn, "encrypted_dek")?
        .ok_or_else(|| "Corrupted vault: missing encrypted DEK".to_string())?;
    let dek_nonce_b64 = db::get_meta(&conn, "dek_nonce")?
        .ok_or_else(|| "Corrupted vault: missing DEK nonce".to_string())?;
    let email = db::get_meta(&conn, "user_email")?
        .unwrap_or_default();

    let old_salt = BASE64.decode(&salt_b64).map_err(|e| e.to_string())?;
    let enc_dek = BASE64.decode(&enc_dek_b64).map_err(|e| e.to_string())?;
    let dek_nonce_vec = BASE64.decode(&dek_nonce_b64).map_err(|e| e.to_string())?;

    if dek_nonce_vec.len() != 24 {
        return Err("Invalid DEK nonce length".into());
    }
    let mut old_nonce = [0u8; 24];
    old_nonce.copy_from_slice(&dek_nonce_vec);

    // 1. Verify current password by decrypting the existing DEK
    let old_mk = derive_master_key(&current_password, &old_salt)?;
    let dek = decrypt_dek(&enc_dek, &old_nonce, &old_mk)
        .map_err(|_| "Current master password is incorrect.".to_string())?;

    // 2. Generate brand new salt and derive new MK
    let new_salt = generate_salt();
    let new_mk = derive_master_key(&new_password, &new_salt)?;

    // 3. Re-encrypt the existing DEK under the new MK
    let (new_enc_dek, new_nonce) = encrypt_dek(&dek, &new_mk)?;
    let new_auth_verifier = derive_auth_verifier(&new_mk, &email)?;

    let new_salt_b64 = BASE64.encode(new_salt);
    let new_enc_dek_b64 = BASE64.encode(&new_enc_dek);
    let new_nonce_b64 = BASE64.encode(new_nonce);

    // 4. Update local_meta
    db::set_meta(&conn, "master_salt", &new_salt_b64)?;
    db::set_meta(&conn, "encrypted_dek", &new_enc_dek_b64)?;
    db::set_meta(&conn, "dek_nonce", &new_nonce_b64)?;

    // 5. Update session in memory
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Some(VaultSession {
        email: email.clone(),
        auth_verifier: new_auth_verifier.clone(),
        master_key: new_mk,
        dek,
    });

    Ok(ChangePasswordResponse {
        success: true,
        auth_verifier: new_auth_verifier,
        master_salt: new_salt_b64,
        encrypted_dek: new_enc_dek_b64,
        dek_nonce: new_nonce_b64,
    })
}
