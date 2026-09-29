use crate::crypto::{
    decrypt_dek, derive_auth_verifier, derive_master_key,
    derive_recovery_keys, encrypt_dek, encrypt_dek_recovery,
    format_recovery_code, generate_dek,
    generate_password as gen_pwd, generate_recovery_secret, generate_salt,
};
use crate::db::{self, EncryptedEntryRow, SecurityQuestion, VaultEntryDto};
use crate::state::{AppState, VaultSession};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
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
    pub recovery_code: String,
    pub recovery_auth_hash: String,
    pub recovery_wrapped_dek: String,
    pub recovery_nonce: String,
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
    #[serde(default)]
    pub security_questions: Vec<SecurityQuestion>,
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

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let owner_id = db::get_or_create_owner_id(&conn)?;

    // 5. Generate 32-Byte Offline Recovery Secret (CSPRNG)
    let recovery_secret = generate_recovery_secret();
    let recovery_code = format_recovery_code(&recovery_secret);
    let (rek, _auth_token, auth_hash) = derive_recovery_keys(&recovery_secret, &owner_id)?;
    let (rec_enc_dek, rec_nonce) = encrypt_dek_recovery(&dek, &rek, &owner_id, 1)?;
    let rec_enc_dek_b64 = BASE64.encode(&rec_enc_dek);
    let rec_nonce_b64 = BASE64.encode(rec_nonce);

    // 6. Save metadata to SQLite
    db::set_meta(&conn, "user_email", &email_clean)?;
    db::set_meta(&conn, "owner_id", &owner_id)?;
    db::set_meta(&conn, "master_salt", &salt_b64)?;
    db::set_meta(&conn, "encrypted_dek", &enc_dek_b64)?;
    db::set_meta(&conn, "dek_nonce", &dek_nonce_b64)?;
    db::set_meta(&conn, "recovery_auth_hash", &auth_hash)?;
    db::set_meta(&conn, "recovery_wrapped_dek", &rec_enc_dek_b64)?;
    db::set_meta(&conn, "recovery_nonce", &rec_nonce_b64)?;

    // 7. Save active session with clean in-memory cache
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Some(VaultSession {
        email: email_clean,
        owner_id,
        auth_verifier: auth_verifier.clone(),
        master_key,
        dek,
        decrypted_cache: Mutex::new(HashMap::new()),
    });

    Ok(InitVaultResponse {
        success: true,
        auth_verifier,
        master_salt: salt_b64,
        encrypted_dek: enc_dek_b64,
        dek_nonce: dek_nonce_b64,
        recovery_code,
        recovery_auth_hash: auth_hash,
        recovery_wrapped_dek: rec_enc_dek_b64,
        recovery_nonce: rec_nonce_b64,
    })
}

#[tauri::command]
pub fn unlock_vault(
    master_password: String,
    state: State<'_, AppState>,
) -> Result<UnlockVaultResponse, String> {
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    let salt_b64 = db::get_meta(&conn, "master_salt")?
        .ok_or_else(|| "Vault not initialized. Please create or import a vault.".to_string())?;
    let enc_dek_b64 = db::get_meta(&conn, "encrypted_dek")?
        .ok_or_else(|| "Corrupted vault: missing encrypted DEK".to_string())?;
    let dek_nonce_b64 = db::get_meta(&conn, "dek_nonce")?
        .ok_or_else(|| "Corrupted vault: missing DEK nonce".to_string())?;
    let email = db::get_meta(&conn, "user_email")?
        .unwrap_or_default();
    let owner_id = db::get_or_create_owner_id(&conn)?;

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

    // Blocking migration if legacy local_entries table exists
    if db::has_legacy_entries_table(&conn)? {
        let _ = db::migrate_legacy_to_encrypted(&mut conn, &dek, &owner_id)?;
    }

    // Pre-populate decrypted in-memory cache
    let mut cache = HashMap::new();
    let encrypted_rows = db::list_encrypted_rows(&conn)?;
    for row in encrypted_rows {
        if let Ok(dto) = db::decrypt_entry_row(&row, &dek) {
            cache.insert(dto.id.clone(), dto);
        }
    }

    // Set Session
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Some(VaultSession {
        email: email.clone(),
        owner_id,
        auth_verifier: auth_verifier.clone(),
        master_key,
        dek,
        decrypted_cache: Mutex::new(cache),
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
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard.as_ref().ok_or_else(|| "Vault is locked".to_string())?;

    let cache = session.decrypted_cache.lock().map_err(|e| e.to_string())?;
    let mut list: Vec<VaultEntryDto> = cache
        .values()
        .filter(|e| !e.is_deleted)
        .cloned()
        .collect();

    list.sort_by(|a, b| {
        if a.favorite != b.favorite {
            b.favorite.cmp(&a.favorite)
        } else {
            a.title.to_lowercase().cmp(&b.title.to_lowercase())
        }
    });

    Ok(list)
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

    let mut cache = session.decrypted_cache.lock().map_err(|e| e.to_string())?;
    let existing = cache.get(&entry_id);
    let revision = existing.map(|e| (e.version as u64) + 1).unwrap_or(1);

    let entry_dto = VaultEntryDto {
        id: entry_id.clone(),
        title: input.title,
        username: input.username,
        password: input.password,
        url: input.url,
        notes: input.notes,
        security_questions: input.security_questions,
        tags: input.tags,
        favorite: input.favorite,
        ciphertext: String::new(),
        nonce: String::new(),
        version: revision as i32,
        is_deleted: false,
        sync_status: "pending_update".to_string(),
        client_updated_at: now,
        server_updated_at: None,
    };

    // Encrypt into zero-plaintext row format using canonical JSON + domain AAD
    let enc_row = db::encrypt_entry_dto(&entry_dto, &session.dek, &session.owner_id, revision)?;

    let mut final_dto = entry_dto;
    final_dto.ciphertext = enc_row.ciphertext.clone();
    final_dto.nonce = enc_row.nonce.clone();

    // Persist to encrypted_entries table
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::upsert_encrypted_row(&conn, &enc_row)?;

    // Update in-memory decrypted cache
    cache.insert(entry_id, final_dto.clone());

    Ok(final_dto)
}

#[tauri::command]
pub fn delete_entry(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard.as_ref().ok_or_else(|| "Vault is locked".to_string())?;

    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::soft_delete_encrypted_row(&conn, &id, &now)?;

    let mut cache = session.decrypted_cache.lock().map_err(|e| e.to_string())?;
    if let Some(entry) = cache.get_mut(&id) {
        entry.is_deleted = true;
        entry.sync_status = "pending_delete".to_string();
        entry.client_updated_at = now;
    }

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

    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    let owner_id = db::get_or_create_owner_id(&conn)?;

    db::set_meta(&conn, "user_email", &email_clean)?;
    db::set_meta(&conn, "owner_id", &owner_id)?;
    db::set_meta(&conn, "master_salt", &master_salt)?;
    db::set_meta(&conn, "encrypted_dek", &encrypted_dek)?;
    db::set_meta(&conn, "dek_nonce", &dek_nonce)?;

    if db::has_legacy_entries_table(&conn)? {
        let _ = db::migrate_legacy_to_encrypted(&mut conn, &dek, &owner_id)?;
    }

    let mut cache = HashMap::new();
    let encrypted_rows = db::list_encrypted_rows(&conn)?;
    for row in encrypted_rows {
        if let Ok(dto) = db::decrypt_entry_row(&row, &dek) {
            cache.insert(dto.id.clone(), dto);
        }
    }

    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Some(VaultSession {
        email: email_clean.clone(),
        owner_id,
        auth_verifier: auth_verifier.clone(),
        master_key,
        dek,
        decrypted_cache: Mutex::new(cache),
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
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard.as_ref().ok_or_else(|| "Vault is locked".to_string())?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let envelopes = db::get_pending_sync_envelopes(&conn)?;

    let mut result = Vec::new();
    for env in envelopes {
        if let Ok(dto) = db::decrypt_entry_row(&env, &session.dek) {
            result.push(dto);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn mark_entry_synced(
    id: String,
    server_updated_at: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::mark_envelopes_synced(&conn, &[id.clone()], &server_updated_at)?;

    let session_guard = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(ref session) = *session_guard {
        if let Ok(mut cache) = session.decrypted_cache.lock() {
            if let Some(entry) = cache.get_mut(&id) {
                entry.sync_status = "synced".to_string();
                entry.server_updated_at = Some(server_updated_at);
            }
        }
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
    let existing = db::get_encrypted_row_by_id(&conn, &remote.id)?;

    if let Some(ref local) = existing {
        if local.client_updated_at >= remote.client_updated_at {
            return Ok(None);
        }
    }

    let enc_row = EncryptedEntryRow {
        id: remote.id.clone(),
        owner_id: session.owner_id.clone(),
        crypto_version: 2,
        payload_schema_version: 2,
        nonce: remote.nonce.clone(),
        ciphertext: remote.ciphertext.clone(),
        revision: remote.version as u64,
        is_deleted: remote.is_deleted,
        sync_state: "synced".to_string(),
        client_updated_at: remote.client_updated_at.clone(),
        server_updated_at: Some(remote.server_updated_at.clone()),
    };

    let dto = db::decrypt_entry_row(&enc_row, &session.dek)?;
    db::upsert_encrypted_row(&conn, &enc_row)?;

    let mut cache = session.decrypted_cache.lock().map_err(|e| e.to_string())?;
    cache.insert(remote.id, dto.clone());

    Ok(Some(dto))
}

#[tauri::command]
pub fn reset_vault(state: State<'_, AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM local_meta", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM encrypted_entries", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM conflict_envelopes", []).map_err(|e| e.to_string())?;
    let _ = conn.execute("DROP TABLE IF EXISTS local_entries", []);
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

    let old_mk = derive_master_key(&current_password, &old_salt)?;
    let dek = decrypt_dek(&enc_dek, &old_nonce, &old_mk)
        .map_err(|_| "Current master password is incorrect.".to_string())?;

    let new_salt = generate_salt();
    let new_mk = derive_master_key(&new_password, &new_salt)?;
    let (new_enc_dek, new_nonce) = encrypt_dek(&dek, &new_mk)?;
    let new_auth_verifier = derive_auth_verifier(&new_mk, &email)?;

    let new_salt_b64 = BASE64.encode(new_salt);
    let new_enc_dek_b64 = BASE64.encode(&new_enc_dek);
    let new_nonce_b64 = BASE64.encode(new_nonce);

    db::set_meta(&conn, "master_salt", &new_salt_b64)?;
    db::set_meta(&conn, "encrypted_dek", &new_enc_dek_b64)?;
    db::set_meta(&conn, "dek_nonce", &new_nonce_b64)?;

    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut s) = *session {
        s.master_key = new_mk;
        s.auth_verifier = new_auth_verifier.clone();
    }

    Ok(ChangePasswordResponse {
        success: true,
        auth_verifier: new_auth_verifier,
        master_salt: new_salt_b64,
        encrypted_dek: new_enc_dek_b64,
        dek_nonce: new_nonce_b64,
    })
}

#[tauri::command]
pub fn setup_recovery_questions(
    questions: Vec<String>,
    answers: Vec<String>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard.as_ref().ok_or_else(|| "Vault is locked".to_string())?;

    if questions.is_empty() || questions.len() != answers.len() {
        return Err("Please provide at least one security question and answer.".into());
    }

    let mut combined = String::new();
    for (q, a) in questions.iter().zip(answers.iter()) {
        let clean_a = a.trim().to_lowercase();
        if clean_a.is_empty() {
            return Err("All recovery answers must be filled in.".into());
        }
        combined.push_str(&format!("{}:{}|", q.trim().to_lowercase(), clean_a));
    }

    let recovery_salt = generate_salt();
    let recovery_mk = derive_master_key(&combined, &recovery_salt)?;
    let (rec_enc_dek, rec_nonce) = encrypt_dek(&session.dek, &recovery_mk)?;

    let questions_json = serde_json::to_string(&questions)
        .map_err(|e| format!("Failed to serialize recovery questions: {}", e))?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_meta(&conn, "recovery_questions", &questions_json)?;
    db::set_meta(&conn, "recovery_salt", &BASE64.encode(&recovery_salt))?;
    db::set_meta(&conn, "recovery_enc_dek", &BASE64.encode(&rec_enc_dek))?;
    db::set_meta(&conn, "recovery_nonce", &BASE64.encode(&rec_nonce))?;

    Ok(true)
}

#[tauri::command]
pub fn get_recovery_questions(state: State<'_, AppState>) -> Result<Option<Vec<String>>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let q_json = db::get_meta(&conn, "recovery_questions")?;
    match q_json {
        Some(s) => {
            let qs: Vec<String> = serde_json::from_str(&s).unwrap_or_default();
            if qs.is_empty() {
                Ok(None)
            } else {
                Ok(Some(qs))
            }
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn recover_vault_with_questions(
    answers: Vec<String>,
    new_master_password: String,
    state: State<'_, AppState>,
) -> Result<UnlockVaultResponse, String> {
    if new_master_password.len() < 8 {
        return Err("New master password must be at least 8 characters.".into());
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let q_json = db::get_meta(&conn, "recovery_questions")?
        .ok_or_else(|| "No recovery questions configured for this vault.".to_string())?;
    let rec_salt_b64 = db::get_meta(&conn, "recovery_salt")?
        .ok_or_else(|| "Corrupted recovery metadata.".to_string())?;
    let rec_enc_dek_b64 = db::get_meta(&conn, "recovery_enc_dek")?
        .ok_or_else(|| "Corrupted recovery metadata.".to_string())?;
    let rec_nonce_b64 = db::get_meta(&conn, "recovery_nonce")?
        .ok_or_else(|| "Corrupted recovery metadata.".to_string())?;
    let email = db::get_meta(&conn, "user_email")?.unwrap_or_default();
    let owner_id = db::get_or_create_owner_id(&conn)?;

    let questions: Vec<String> = serde_json::from_str(&q_json)
        .map_err(|e| format!("Invalid recovery questions data: {}", e))?;

    if questions.len() != answers.len() {
        return Err("Answers count does not match questions count.".into());
    }

    let mut combined = String::new();
    for (q, a) in questions.iter().zip(answers.iter()) {
        combined.push_str(&format!("{}:{}|", q.trim().to_lowercase(), a.trim().to_lowercase()));
    }

    let rec_salt = BASE64.decode(&rec_salt_b64).map_err(|e| e.to_string())?;
    let rec_enc_dek = BASE64.decode(&rec_enc_dek_b64).map_err(|e| e.to_string())?;
    let rec_nonce_vec = BASE64.decode(&rec_nonce_b64).map_err(|e| e.to_string())?;

    if rec_nonce_vec.len() != 24 {
        return Err("Invalid recovery nonce length".into());
    }
    let mut nonce_arr = [0u8; 24];
    nonce_arr.copy_from_slice(&rec_nonce_vec);

    let recovery_mk = derive_master_key(&combined, &rec_salt)?;
    let dek = decrypt_dek(&rec_enc_dek, &nonce_arr, &recovery_mk)
        .map_err(|_| "Security question answers are incorrect.".to_string())?;

    let new_salt = generate_salt();
    let new_mk = derive_master_key(&new_master_password, &new_salt)?;
    let (new_enc_dek, new_nonce) = encrypt_dek(&dek, &new_mk)?;
    let new_auth_verifier = derive_auth_verifier(&new_mk, &email)?;

    let new_salt_b64 = BASE64.encode(new_salt);
    let new_enc_dek_b64 = BASE64.encode(&new_enc_dek);
    let new_nonce_b64 = BASE64.encode(new_nonce);

    db::set_meta(&conn, "master_salt", &new_salt_b64)?;
    db::set_meta(&conn, "encrypted_dek", &new_enc_dek_b64)?;
    db::set_meta(&conn, "dek_nonce", &new_nonce_b64)?;

    let mut cache = HashMap::new();
    let encrypted_rows = db::list_encrypted_rows(&conn)?;
    for row in encrypted_rows {
        if let Ok(dto) = db::decrypt_entry_row(&row, &dek) {
            cache.insert(dto.id.clone(), dto);
        }
    }

    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    *session = Some(VaultSession {
        email: email.clone(),
        owner_id,
        auth_verifier: new_auth_verifier.clone(),
        master_key: new_mk,
        dek,
        decrypted_cache: Mutex::new(cache),
    });

    Ok(UnlockVaultResponse {
        success: true,
        auth_verifier: new_auth_verifier,
        email,
        master_salt: new_salt_b64,
        encrypted_dek: new_enc_dek_b64,
        dek_nonce: new_nonce_b64,
    })
}
