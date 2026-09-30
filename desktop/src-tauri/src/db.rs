use crate::crypto::{
    build_entry_aad, canonicalize_json, decrypt_entry_payload, encrypt_entry_payload,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SecurityQuestion {
    pub question: String,
    pub answer: String,
}

/// In-memory & UI representation of a decrypted vault entry.
/// This struct is NEVER persisted to SQLite plaintext columns.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntryDto {
    pub id: String,
    pub title: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub security_questions: Vec<SecurityQuestion>,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub ciphertext: String,
    pub nonce: String,
    pub version: i32,
    pub is_deleted: bool,
    pub sync_status: String, // 'synced', 'pending_insert', 'pending_update', 'pending_delete'
    pub client_updated_at: String,
    pub server_updated_at: Option<String>,
}

/// Zero-plaintext SQLite row structure for table `encrypted_entries`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedEntryRow {
    pub id: String,
    pub owner_id: String,
    pub crypto_version: u32,
    pub payload_schema_version: u32,
    pub nonce: String,
    pub ciphertext: String,
    pub revision: u64,
    pub is_deleted: bool,
    pub sync_state: String,
    pub client_updated_at: String,
    pub server_updated_at: Option<String>,
}

/// Structure for table `conflict_envelopes`.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictEnvelopeRow {
    pub original_id: String,
    pub owner_id: String,
    pub crypto_version: u32,
    pub payload_schema_version: u32,
    pub nonce: String,
    pub ciphertext: String,
    pub revision: u64,
    pub is_deleted: bool,
    pub client_updated_at: Option<String>,
    pub server_updated_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultLoadFailure {
    pub id: String,
    pub reason_code: String,
    pub crypto_version: u32,
    pub revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultLoadResult {
    pub entries: Vec<VaultEntryDto>,
    pub failures: Vec<VaultLoadFailure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryPayload {
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

pub fn init_tables(conn: &Connection) -> Result<(), String> {
    let version: i32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap_or(0);

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS local_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS encrypted_entries (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            crypto_version INTEGER NOT NULL DEFAULT 2,
            payload_schema_version INTEGER NOT NULL DEFAULT 2,
            nonce TEXT NOT NULL,
            ciphertext TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            sync_state TEXT NOT NULL DEFAULT 'synced',
            client_updated_at TEXT NOT NULL,
            server_updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_enc_sync_state ON encrypted_entries(sync_state);
        CREATE INDEX IF NOT EXISTS idx_enc_deleted ON encrypted_entries(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_enc_owner ON encrypted_entries(owner_id);

        CREATE TABLE IF NOT EXISTS conflict_envelopes (
            original_id TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            crypto_version INTEGER NOT NULL DEFAULT 2,
            payload_schema_version INTEGER NOT NULL DEFAULT 2,
            nonce TEXT NOT NULL,
            ciphertext TEXT NOT NULL,
            revision INTEGER NOT NULL,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            client_updated_at TEXT,
            server_updated_at TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_conflict_original ON conflict_envelopes(original_id);
        ",
    )
    .map_err(|e| format!("Database initialization failed: {}", e))?;

    if version < 3 {
        conn.execute("PRAGMA user_version = 3", [])
            .map_err(|e| format!("Failed to set user_version: {}", e))?;
    }

    Ok(())
}

pub fn get_meta(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM local_meta WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let val: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

pub fn set_meta(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO local_meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| format!("Failed to set metadata key {}: {}", key, e))?;

    Ok(())
}

pub fn get_or_create_owner_id(conn: &Connection) -> Result<String, String> {
    if let Some(owner_id) = get_meta(conn, "owner_id")? {
        if !owner_id.is_empty() {
            return Ok(owner_id);
        }
    }
    let new_id = uuid::Uuid::new_v4().to_string();
    set_meta(conn, "owner_id", &new_id)?;
    Ok(new_id)
}

pub fn has_legacy_entries_table(conn: &Connection) -> Result<bool, String> {
    let mut stmt = conn
        .prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='local_entries'")
        .map_err(|e| e.to_string())?;
    let count: i64 = stmt
        .query_row([], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

pub fn execute_wal_checkpoint_and_vacuum(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        PRAGMA wal_checkpoint(TRUNCATE);
        VACUUM;
        ",
    )
    .map_err(|e| format!("WAL checkpoint / vacuum failed: {}", e))?;
    Ok(())
}

// -----------------------------------------------------------------------------
// Encrypted Entries Table Operations
// -----------------------------------------------------------------------------

pub fn list_encrypted_rows(conn: &Connection) -> Result<Vec<EncryptedEntryRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, owner_id, crypto_version, payload_schema_version,
                    nonce, ciphertext, revision, is_deleted, sync_state,
                    client_updated_at, server_updated_at
             FROM encrypted_entries
             WHERE is_deleted = 0",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let del_int: i32 = row.get(7)?;
            Ok(EncryptedEntryRow {
                id: row.get(0)?,
                owner_id: row.get(1)?,
                crypto_version: row.get(2)?,
                payload_schema_version: row.get(3)?,
                nonce: row.get(4)?,
                ciphertext: row.get(5)?,
                revision: row.get(6)?,
                is_deleted: del_int != 0,
                sync_state: row.get(8)?,
                client_updated_at: row.get(9)?,
                server_updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

pub fn get_encrypted_row_by_id(
    conn: &Connection,
    id: &str,
) -> Result<Option<EncryptedEntryRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, owner_id, crypto_version, payload_schema_version,
                    nonce, ciphertext, revision, is_deleted, sync_state,
                    client_updated_at, server_updated_at
             FROM encrypted_entries
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query(params![id]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let del_int: i32 = row.get(7).map_err(|e| e.to_string())?;
        Ok(Some(EncryptedEntryRow {
            id: row.get(0).map_err(|e| e.to_string())?,
            owner_id: row.get(1).map_err(|e| e.to_string())?,
            crypto_version: row.get(2).map_err(|e| e.to_string())?,
            payload_schema_version: row.get(3).map_err(|e| e.to_string())?,
            nonce: row.get(4).map_err(|e| e.to_string())?,
            ciphertext: row.get(5).map_err(|e| e.to_string())?,
            revision: row.get(6).map_err(|e| e.to_string())?,
            is_deleted: del_int != 0,
            sync_state: row.get(8).map_err(|e| e.to_string())?,
            client_updated_at: row.get(9).map_err(|e| e.to_string())?,
            server_updated_at: row.get(10).map_err(|e| e.to_string())?,
        }))
    } else {
        Ok(None)
    }
}

pub fn upsert_encrypted_row(conn: &Connection, row: &EncryptedEntryRow) -> Result<(), String> {
    let del_int = if row.is_deleted { 1 } else { 0 };

    conn.execute(
        "INSERT INTO encrypted_entries (
            id, owner_id, crypto_version, payload_schema_version,
            nonce, ciphertext, revision, is_deleted, sync_state,
            client_updated_at, server_updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(id) DO UPDATE SET
            owner_id = excluded.owner_id,
            crypto_version = excluded.crypto_version,
            payload_schema_version = excluded.payload_schema_version,
            nonce = excluded.nonce,
            ciphertext = excluded.ciphertext,
            revision = excluded.revision,
            is_deleted = excluded.is_deleted,
            sync_state = excluded.sync_state,
            client_updated_at = excluded.client_updated_at,
            server_updated_at = excluded.server_updated_at",
        params![
            row.id,
            row.owner_id,
            row.crypto_version,
            row.payload_schema_version,
            row.nonce,
            row.ciphertext,
            row.revision,
            del_int,
            row.sync_state,
            row.client_updated_at,
            row.server_updated_at,
        ],
    )
    .map_err(|e| format!("Failed to upsert encrypted entry {}: {}", row.id, e))?;

    Ok(())
}

pub fn parse_nonce(nonce_b64: &str) -> Result<[u8; 24], String> {
    let bytes = BASE64
        .decode(nonce_b64)
        .map_err(|e| format!("Invalid nonce base64: {}", e))?;
    if bytes.len() != 24 {
        return Err(format!("Nonce must be 24 bytes (got {})", bytes.len()));
    }
    let mut arr = [0u8; 24];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

pub fn crypto_soft_delete_entry(
    conn: &Connection,
    id: &str,
    dek: &[u8; 32],
    owner_id: &str,
) -> Result<(), String> {
    let existing = get_encrypted_row_by_id(conn, id)?
        .ok_or_else(|| format!("Entry {} not found for deletion", id))?;

    // 1. Verify/decrypt using old metadata
    let old_aad = build_entry_aad(
        existing.crypto_version,
        existing.payload_schema_version,
        &existing.owner_id,
        &existing.id,
        existing.revision,
        existing.is_deleted,
    );
    let old_ct = BASE64
        .decode(&existing.ciphertext)
        .map_err(|e| e.to_string())?;
    let old_nonce = parse_nonce(&existing.nonce)?;
    let _ = decrypt_entry_payload(&old_ct, &old_nonce, dek, &old_aad)?;

    // 2. Increment revision & minimal tombstone payload
    let new_revision = existing.revision + 1;
    let tombstone_json = "{\"deleted\":true,\"schema_version\":2}";

    // 3. Re-encrypt with deleted=1 in AAD
    let new_aad = build_entry_aad(2, 2, owner_id, id, new_revision, true);
    let (ct_bytes, nonce_bytes) = encrypt_entry_payload(tombstone_json, dek, &new_aad)?;

    // 4. Immediate canary decrypt verification
    let verified = decrypt_entry_payload(&ct_bytes, &nonce_bytes, dek, &new_aad)?;
    if verified != tombstone_json {
        return Err("Canary decrypt failed for tombstone".into());
    }

    // 5. Persist with pending_delete
    let now = chrono::Utc::now().to_rfc3339();
    let enc_b64 = BASE64.encode(&ct_bytes);
    let nonce_b64 = BASE64.encode(nonce_bytes);

    conn.execute(
        "UPDATE encrypted_entries
         SET crypto_version = 2,
             payload_schema_version = 2,
             nonce = ?2,
             ciphertext = ?3,
             revision = ?4,
             is_deleted = 1,
             sync_state = 'pending_delete',
             client_updated_at = ?5
         WHERE id = ?1",
        params![id, nonce_b64, enc_b64, new_revision, now],
    )
    .map_err(|e| format!("Failed to tombstone entry {}: {}", id, e))?;

    Ok(())
}

pub fn get_pending_sync_envelopes(conn: &Connection) -> Result<Vec<EncryptedEntryRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, owner_id, crypto_version, payload_schema_version,
                    nonce, ciphertext, revision, is_deleted, sync_state,
                    client_updated_at, server_updated_at
             FROM encrypted_entries
             WHERE sync_state != 'synced'",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let del_int: i32 = row.get(7)?;
            Ok(EncryptedEntryRow {
                id: row.get(0)?,
                owner_id: row.get(1)?,
                crypto_version: row.get(2)?,
                payload_schema_version: row.get(3)?,
                nonce: row.get(4)?,
                ciphertext: row.get(5)?,
                revision: row.get(6)?,
                is_deleted: del_int != 0,
                sync_state: row.get(8)?,
                client_updated_at: row.get(9)?,
                server_updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

pub fn mark_envelope_synced(
    conn: &Connection,
    id: &str,
    revision: u64,
    server_timestamp: &str,
) -> Result<(), String> {
    conn.execute(
        "UPDATE encrypted_entries
         SET sync_state = 'synced', server_updated_at = ?2
         WHERE id = ?1 AND revision = ?3",
        params![id, server_timestamp, revision],
    )
    .map_err(|e| format!("Failed to mark entry synced {}: {}", id, e))?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn record_conflict_envelope(
    conn: &Connection,
    original_id: &str,
    owner_id: &str,
    crypto_version: u32,
    payload_schema_version: u32,
    nonce: &str,
    ciphertext: &str,
    revision: u64,
    is_deleted: bool,
    client_updated_at: Option<&str>,
    server_updated_at: Option<&str>,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO conflict_envelopes (
            original_id, owner_id, crypto_version, payload_schema_version,
            nonce, ciphertext, revision, is_deleted,
            client_updated_at, server_updated_at, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            original_id,
            owner_id,
            crypto_version,
            payload_schema_version,
            nonce,
            ciphertext,
            revision,
            if is_deleted { 1 } else { 0 },
            client_updated_at,
            server_updated_at,
            now,
        ],
    )
    .map_err(|e| format!("Failed to record conflict envelope {}: {}", original_id, e))?;
    Ok(())
}

pub fn migrate_owner_id(
    conn: &mut Connection,
    old_owner_id: &str,
    new_owner_id: &str,
    dek: &[u8; 32],
    master_key: &[u8; 32],
    key_generation: u32,
) -> Result<(), String> {
    if old_owner_id == new_owner_id {
        return Ok(());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    {
        let mut stmt = tx
            .prepare(
                "SELECT id, crypto_version, payload_schema_version, nonce, ciphertext, revision, is_deleted
                 FROM encrypted_entries",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let del_int: i32 = row.get(6)?;
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, u32>(1)?,
                    row.get::<_, u32>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, u64>(5)?,
                    del_int != 0,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut entries_to_update = Vec::new();
        for r in rows {
            entries_to_update.push(r.map_err(|e| e.to_string())?);
        }

        for (id, crypto_ver, schema_ver, old_nonce, old_ct, old_rev, is_deleted) in
            entries_to_update
        {
            let old_aad = build_entry_aad(
                crypto_ver,
                schema_ver,
                old_owner_id,
                &id,
                old_rev,
                is_deleted,
            );

            let old_ct_bytes = BASE64.decode(&old_ct).map_err(|e| e.to_string())?;
            let old_nonce_arr = parse_nonce(&old_nonce)?;

            let plaintext = decrypt_entry_payload(&old_ct_bytes, &old_nonce_arr, dek, &old_aad)?;

            let new_rev = old_rev + 1;
            let new_aad = build_entry_aad(2, 2, new_owner_id, &id, new_rev, is_deleted);

            let (new_ct_bytes, new_nonce_arr) = encrypt_entry_payload(&plaintext, dek, &new_aad)?;
            let canary = decrypt_entry_payload(&new_ct_bytes, &new_nonce_arr, dek, &new_aad)?;
            if canary != plaintext {
                return Err(format!(
                    "Canary verification failed for owner migration on entry {}",
                    id
                ));
            }

            let now = chrono::Utc::now().to_rfc3339();
            tx.execute(
                "UPDATE encrypted_entries
                 SET owner_id = ?2,
                     crypto_version = 2,
                     payload_schema_version = 2,
                     nonce = ?3,
                     ciphertext = ?4,
                     revision = ?5,
                     sync_state = 'pending_update',
                     client_updated_at = ?6
                 WHERE id = ?1",
                params![
                    id,
                    new_owner_id,
                    BASE64.encode(new_nonce_arr),
                    BASE64.encode(&new_ct_bytes),
                    new_rev,
                    now,
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        // Rewrap DEK with new owner AAD
        let (enc_dek, dek_nonce) =
            crate::crypto::encrypt_dek_master(dek, master_key, new_owner_id, key_generation)?;

        tx.execute(
            "INSERT INTO local_meta (key, value) VALUES ('owner_id', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![new_owner_id],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO local_meta (key, value) VALUES ('encrypted_dek', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![BASE64.encode(&enc_dek)],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO local_meta (key, value) VALUES ('dek_nonce', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![BASE64.encode(dek_nonce)],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO local_meta (key, value) VALUES ('dek_wrap_version', '2')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_active_entries(
    conn: &Connection,
    dek: &[u8; 32],
    _owner_id: &str,
) -> Result<VaultLoadResult, String> {
    let rows = list_encrypted_rows(conn)?;
    let mut entries = Vec::new();
    let mut failures = Vec::new();

    for row in rows {
        match decrypt_entry_row(&row, dek) {
            Ok(dto) => entries.push(dto),
            Err(_) => failures.push(VaultLoadFailure {
                id: row.id,
                reason_code: "DECRYPT_FAILED".to_string(),
                crypto_version: row.crypto_version,
                revision: row.revision,
            }),
        }
    }

    entries.sort_by(|a, b| {
        if a.favorite != b.favorite {
            b.favorite.cmp(&a.favorite)
        } else {
            a.title.to_lowercase().cmp(&b.title.to_lowercase())
        }
    });

    Ok(VaultLoadResult { entries, failures })
}

// -----------------------------------------------------------------------------
// In-Memory Decryption & Serialization Helpers
// -----------------------------------------------------------------------------

pub fn decrypt_entry_row(row: &EncryptedEntryRow, dek: &[u8; 32]) -> Result<VaultEntryDto, String> {
    let aad = build_entry_aad(
        row.crypto_version,
        row.payload_schema_version,
        &row.owner_id,
        &row.id,
        row.revision,
        row.is_deleted,
    );

    let ct_bytes = BASE64
        .decode(&row.ciphertext)
        .map_err(|e| format!("Invalid base64 ciphertext: {}", e))?;
    let nonce_bytes = BASE64
        .decode(&row.nonce)
        .map_err(|e| format!("Invalid base64 nonce: {}", e))?;
    if nonce_bytes.len() != 24 {
        return Err("Invalid nonce length for entry".into());
    }
    let mut nonce_arr = [0u8; 24];
    nonce_arr.copy_from_slice(&nonce_bytes);

    let decrypted_json = decrypt_entry_payload(&ct_bytes, &nonce_arr, dek, &aad)?;
    let payload: EntryPayload = serde_json::from_str(&decrypted_json)
        .map_err(|e| format!("Failed to parse decrypted entry JSON: {}", e))?;

    Ok(VaultEntryDto {
        id: row.id.clone(),
        title: payload.title,
        username: payload.username,
        password: payload.password,
        url: payload.url,
        notes: payload.notes,
        security_questions: payload.security_questions,
        tags: payload.tags,
        favorite: payload.favorite,
        ciphertext: row.ciphertext.clone(),
        nonce: row.nonce.clone(),
        version: row.revision as i32,
        is_deleted: row.is_deleted,
        sync_status: row.sync_state.clone(),
        client_updated_at: row.client_updated_at.clone(),
        server_updated_at: row.server_updated_at.clone(),
    })
}

pub fn encrypt_entry_dto(
    dto: &VaultEntryDto,
    dek: &[u8; 32],
    owner_id: &str,
    revision: u64,
) -> Result<EncryptedEntryRow, String> {
    let aad = build_entry_aad(2, 2, owner_id, &dto.id, revision, dto.is_deleted);

    let payload_val = serde_json::json!({
        "favorite": dto.favorite,
        "notes": dto.notes,
        "password": dto.password,
        "schema_version": 2,
        "security_questions": dto.security_questions.iter().map(|q| {
            serde_json::json!({
                "answer": q.answer,
                "question": q.question
            })
        }).collect::<Vec<_>>(),
        "tags": dto.tags,
        "title": dto.title,
        "url": dto.url,
        "username": dto.username,
    });

    let canonical_json = canonicalize_json(&payload_val);
    let (ct_bytes, nonce_arr) = encrypt_entry_payload(&canonical_json, dek, &aad)?;

    Ok(EncryptedEntryRow {
        id: dto.id.clone(),
        owner_id: owner_id.to_string(),
        crypto_version: 2,
        payload_schema_version: 2,
        nonce: BASE64.encode(nonce_arr),
        ciphertext: BASE64.encode(&ct_bytes),
        revision,
        is_deleted: dto.is_deleted,
        sync_state: dto.sync_status.clone(),
        client_updated_at: dto.client_updated_at.clone(),
        server_updated_at: dto.server_updated_at.clone(),
    })
}

// -----------------------------------------------------------------------------
// Blocking Transactional Migration Engine (Milestone 6.4)
// -----------------------------------------------------------------------------

pub fn migrate_legacy_to_encrypted(
    conn: &mut Connection,
    dek: &[u8; 32],
    owner_id: &str,
) -> Result<usize, String> {
    if !has_legacy_entries_table(conn)? {
        return Ok(0);
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Fetch all rows from legacy local_entries
    let mut stmt = tx
        .prepare(
            "SELECT id, title, username, password, url, notes, tags, favorite,
                    version, is_deleted, sync_status, client_updated_at,
                    server_updated_at, security_questions
             FROM local_entries",
        )
        .map_err(|e| e.to_string())?;

    struct LegacyRow {
        id: String,
        title: String,
        username: Option<String>,
        password: Option<String>,
        url: Option<String>,
        notes: Option<String>,
        tags: Vec<String>,
        favorite: bool,
        version: i32,
        is_deleted: bool,
        sync_status: String,
        client_updated_at: String,
        server_updated_at: Option<String>,
        security_questions: Vec<SecurityQuestion>,
    }

    let rows = stmt
        .query_map([], |row| {
            let tags_str: String = row.get(6)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let fav_int: i32 = row.get(7)?;
            let del_int: i32 = row.get(9)?;
            let sq_str: String = row.get(13).unwrap_or_else(|_| "[]".to_string());
            let security_questions: Vec<SecurityQuestion> =
                serde_json::from_str(&sq_str).unwrap_or_default();

            Ok(LegacyRow {
                id: row.get(0)?,
                title: row.get(1)?,
                username: row.get(2)?,
                password: row.get(3)?,
                url: row.get(4)?,
                notes: row.get(5)?,
                tags,
                favorite: fav_int != 0,
                version: row.get(8)?,
                is_deleted: del_int != 0,
                sync_status: row.get(10)?,
                client_updated_at: row.get(11)?,
                server_updated_at: row.get(12)?,
                security_questions,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut legacy_entries = Vec::new();
    for r in rows {
        legacy_entries.push(r.map_err(|e| e.to_string())?);
    }
    drop(stmt);

    let count = legacy_entries.len();

    // 2. Encrypt each entry and insert into encrypted_entries
    for entry in &legacy_entries {
        let revision = if entry.version > 0 {
            entry.version as u64
        } else {
            1u64
        };

        let aad = build_entry_aad(2, 2, owner_id, &entry.id, revision, entry.is_deleted);

        let payload_val = serde_json::json!({
            "favorite": entry.favorite,
            "notes": entry.notes,
            "password": entry.password,
            "schema_version": 2,
            "security_questions": entry.security_questions.iter().map(|q| {
                serde_json::json!({
                    "answer": q.answer,
                    "question": q.question
                })
            }).collect::<Vec<_>>(),
            "tags": entry.tags,
            "title": entry.title,
            "url": entry.url,
            "username": entry.username,
        });

        let canonical_str = canonicalize_json(&payload_val);
        let (ct_bytes, nonce_arr) = encrypt_entry_payload(&canonical_str, dek, &aad)?;

        // In-flight canary verification
        let canary_decrypted = decrypt_entry_payload(&ct_bytes, &nonce_arr, dek, &aad)
            .map_err(|e| format!("Migration canary decryption failed for {}: {}", entry.id, e))?;
        if canary_decrypted != canonical_str {
            return Err(format!(
                "Migration verification mismatch for entry ID {}",
                entry.id
            ));
        }

        let ct_b64 = BASE64.encode(&ct_bytes);
        let nonce_b64 = BASE64.encode(nonce_arr);
        let del_int = if entry.is_deleted { 1 } else { 0 };

        tx.execute(
            "INSERT INTO encrypted_entries (
                id, owner_id, crypto_version, payload_schema_version,
                nonce, ciphertext, revision, is_deleted, sync_state,
                client_updated_at, server_updated_at
            ) VALUES (?1, ?2, 2, 2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
                owner_id = excluded.owner_id,
                nonce = excluded.nonce,
                ciphertext = excluded.ciphertext,
                revision = excluded.revision,
                is_deleted = excluded.is_deleted,
                sync_state = excluded.sync_state,
                client_updated_at = excluded.client_updated_at,
                server_updated_at = excluded.server_updated_at",
            params![
                entry.id,
                owner_id,
                nonce_b64,
                ct_b64,
                revision,
                del_int,
                entry.sync_status,
                entry.client_updated_at,
                entry.server_updated_at,
            ],
        )
        .map_err(|e| format!("Failed to insert migrated entry {}: {}", entry.id, e))?;
    }

    // 3. Drop the legacy table completely
    tx.execute_batch("DROP TABLE local_entries;")
        .map_err(|e| format!("Failed to drop legacy table: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;

    // 4. Force WAL truncate and vacuum to obliterate plaintext traces
    execute_wal_checkpoint_and_vacuum(conn)?;

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::generate_dek;

    #[test]
    fn test_init_and_crud_encrypted_entries() {
        let conn = Connection::open_in_memory().unwrap();
        init_tables(&conn).unwrap();

        let dek = generate_dek();
        let owner_id = "test-owner-uuid-1234";

        let entry = VaultEntryDto {
            id: "entry-1".into(),
            title: "SuperSecretSite".into(),
            username: Some("PMV_CANARY_USER_superadmin".into()),
            password: Some("PMV_CANARY_PASSWORD_alpha_928174".into()),
            url: Some("https://bank.example.com".into()),
            notes: Some("PMV_CANARY_NOTE_secret_vault_canary_39102".into()),
            security_questions: vec![SecurityQuestion {
                question: "First dog?".into(),
                answer: "Rover".into(),
            }],
            tags: vec!["finance".into()],
            favorite: true,
            ciphertext: "".into(),
            nonce: "".into(),
            version: 1,
            is_deleted: false,
            sync_status: "pending_insert".into(),
            client_updated_at: "2026-09-29T00:00:00Z".into(),
            server_updated_at: None,
        };

        // Encrypt and upsert
        let enc_row = encrypt_entry_dto(&entry, &dek, owner_id, 1).unwrap();
        upsert_encrypted_row(&conn, &enc_row).unwrap();

        // Verify in DB that no plaintext column exists
        let mut stmt = conn
            .prepare("SELECT ciphertext, nonce FROM encrypted_entries WHERE id = 'entry-1'")
            .unwrap();
        let (ct, _nonce): (String, String) = stmt
            .query_row([], |r| Ok((r.get(0).unwrap(), r.get(1).unwrap())))
            .unwrap();
        assert!(!ct.contains("PMV_CANARY_PASSWORD"));
        assert!(!ct.contains("SuperSecretSite"));

        let _conflict = ConflictEnvelopeRow {
            original_id: "entry-1".into(),
            owner_id: owner_id.into(),
            crypto_version: 2,
            payload_schema_version: 2,
            nonce: "test_nonce".into(),
            ciphertext: "test_ct".into(),
            revision: 1,
            is_deleted: false,
            client_updated_at: Some("2026-09-29T00:00:00Z".into()),
            server_updated_at: None,
            created_at: "2026-09-29T00:00:00Z".into(),
        };

        // Read and decrypt row
        let fetched = get_encrypted_row_by_id(&conn, "entry-1").unwrap().unwrap();
        let decrypted = decrypt_entry_row(&fetched, &dek).unwrap();
        assert_eq!(decrypted.title, "SuperSecretSite");
        assert_eq!(
            decrypted.password.as_deref(),
            Some("PMV_CANARY_PASSWORD_alpha_928174")
        );
        assert_eq!(
            decrypted.notes.as_deref(),
            Some("PMV_CANARY_NOTE_secret_vault_canary_39102")
        );
        assert_eq!(decrypted.security_questions.len(), 1);
    }

    #[test]
    fn test_legacy_migration() {
        let mut conn = Connection::open_in_memory().unwrap();
        init_tables(&conn).unwrap();

        // Create legacy table with plaintext columns
        conn.execute_batch(
            "CREATE TABLE local_entries (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                username TEXT,
                password TEXT,
                url TEXT,
                notes TEXT,
                security_questions TEXT NOT NULL DEFAULT '[]',
                tags TEXT NOT NULL DEFAULT '[]',
                favorite INTEGER NOT NULL DEFAULT 0,
                ciphertext TEXT NOT NULL DEFAULT '',
                nonce TEXT NOT NULL DEFAULT '',
                version INTEGER NOT NULL DEFAULT 1,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                sync_status TEXT NOT NULL DEFAULT 'synced',
                client_updated_at TEXT NOT NULL DEFAULT '2026-09-29T00:00:00Z',
                server_updated_at TEXT
            );
            INSERT INTO local_entries (id, title, username, password, notes)
            VALUES ('legacy-1', 'LegacyBank', 'canary_user', 'PMV_CANARY_PASSWORD_legacy_99', 'PMV_CANARY_NOTE_legacy_88');
            ",
        )
        .unwrap();

        assert!(has_legacy_entries_table(&conn).unwrap());

        let dek = generate_dek();
        let owner_id = "test-owner-uuid-legacy";

        // Perform migration
        let count = migrate_legacy_to_encrypted(&mut conn, &dek, owner_id).unwrap();
        assert_eq!(count, 1);

        // Legacy table is gone
        assert!(!has_legacy_entries_table(&conn).unwrap());

        // Encrypted entries has it
        let fetched = get_encrypted_row_by_id(&conn, "legacy-1").unwrap().unwrap();
        let decrypted = decrypt_entry_row(&fetched, &dek).unwrap();
        assert_eq!(decrypted.title, "LegacyBank");
        assert_eq!(
            decrypted.password.as_deref(),
            Some("PMV_CANARY_PASSWORD_legacy_99")
        );
        assert_eq!(
            decrypted.notes.as_deref(),
            Some("PMV_CANARY_NOTE_legacy_88")
        );
    }

    #[test]
    fn test_storage_audit_zero_canary_leak() {
        let temp_dir =
            std::env::temp_dir().join(format!("pm_vault_leak_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let db_path = temp_dir.join("test_audit.db");

        let canary_password = "PMV_CANARY_PASSWORD_storage_leak_test_771829";
        let canary_note = "PMV_CANARY_NOTE_super_secret_audit_991823";

        {
            let conn = Connection::open(&db_path).unwrap();
            init_tables(&conn).unwrap();
            let dek = generate_dek();
            let owner_id = "test-owner-uuid-audit";

            let entry = VaultEntryDto {
                id: "audit-entry-1".into(),
                title: "BankOfZeroKnowledge".into(),
                username: Some("admin_user".into()),
                password: Some(canary_password.into()),
                url: Some("https://zero.vault.example".into()),
                notes: Some(canary_note.into()),
                security_questions: vec![],
                tags: vec!["audit".into()],
                favorite: true,
                ciphertext: "".into(),
                nonce: "".into(),
                version: 1,
                is_deleted: false,
                sync_status: "synced".into(),
                client_updated_at: "2026-09-29T00:00:00Z".into(),
                server_updated_at: None,
            };

            let enc_row = encrypt_entry_dto(&entry, &dek, owner_id, 1).unwrap();
            upsert_encrypted_row(&conn, &enc_row).unwrap();
            execute_wal_checkpoint_and_vacuum(&conn).unwrap();
        } // Connection closed, simulating locked state

        // Storage Audit: Read all bytes of the SQLite file and any WAL / SHM files
        let files = std::fs::read_dir(&temp_dir).unwrap();
        for entry in files {
            let path = entry.unwrap().path();
            let bytes = std::fs::read(&path).unwrap();
            let content_lossy = String::from_utf8_lossy(&bytes);

            assert!(
                !content_lossy.contains(canary_password),
                "STORAGE AUDIT FAILED: Plaintext canary password found in file {:?}!",
                path
            );
            assert!(
                !content_lossy.contains(canary_note),
                "STORAGE AUDIT FAILED: Plaintext canary note found in file {:?}!",
                path
            );
        }

        // Clean up
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
