use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SecurityQuestion {
    pub question: String,
    pub answer: String,
}

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
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS local_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_entries (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            username TEXT,
            password TEXT,
            url TEXT,
            notes TEXT,
            security_questions TEXT NOT NULL DEFAULT '[]',
            tags TEXT NOT NULL DEFAULT '[]',
            favorite INTEGER NOT NULL DEFAULT 0,
            ciphertext TEXT NOT NULL,
            nonce TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            sync_status TEXT NOT NULL DEFAULT 'synced',
            client_updated_at TEXT NOT NULL,
            server_updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_entries_title ON local_entries(title);
        CREATE INDEX IF NOT EXISTS idx_entries_favorite ON local_entries(favorite);
        CREATE INDEX IF NOT EXISTS idx_entries_sync_status ON local_entries(sync_status);
        CREATE INDEX IF NOT EXISTS idx_entries_deleted ON local_entries(is_deleted);
        ",
    )
    .map_err(|e| format!("Database initialization failed: {}", e))?;

    // Safe migration for existing databases
    let _ = conn.execute(
        "ALTER TABLE local_entries ADD COLUMN security_questions TEXT NOT NULL DEFAULT '[]'",
        [],
    );

    Ok(())
}

pub fn get_meta(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM local_meta WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query(params![key])
        .map_err(|e| e.to_string())?;

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

pub fn list_active_entries(conn: &Connection) -> Result<Vec<VaultEntryDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, username, password, url, notes, tags, favorite,
                    ciphertext, nonce, version, is_deleted, sync_status,
                    client_updated_at, server_updated_at, security_questions
             FROM local_entries
             WHERE is_deleted = 0
             ORDER BY favorite DESC, title ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let tags_str: String = row.get(6)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let fav_int: i32 = row.get(7)?;
            let del_int: i32 = row.get(11)?;
            let sq_str: String = row.get(15).unwrap_or_else(|_| "[]".to_string());
            let security_questions: Vec<SecurityQuestion> = serde_json::from_str(&sq_str).unwrap_or_default();

            Ok(VaultEntryDto {
                id: row.get(0)?,
                title: row.get(1)?,
                username: row.get(2)?,
                password: row.get(3)?,
                url: row.get(4)?,
                notes: row.get(5)?,
                tags,
                favorite: fav_int != 0,
                ciphertext: row.get(8)?,
                nonce: row.get(9)?,
                version: row.get(10)?,
                is_deleted: del_int != 0,
                sync_status: row.get(12)?,
                client_updated_at: row.get(13)?,
                server_updated_at: row.get(14)?,
                security_questions,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for entry in rows {
        entries.push(entry.map_err(|e| e.to_string())?);
    }

    Ok(entries)
}

pub fn get_entry_by_id(conn: &Connection, id: &str) -> Result<Option<VaultEntryDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, username, password, url, notes, tags, favorite,
                    ciphertext, nonce, version, is_deleted, sync_status,
                    client_updated_at, server_updated_at, security_questions
             FROM local_entries
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query(params![id])
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let tags_str: String = row.get(6).map_err(|e| e.to_string())?;
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        let fav_int: i32 = row.get(7).map_err(|e| e.to_string())?;
        let del_int: i32 = row.get(11).map_err(|e| e.to_string())?;
        let sq_str: String = row.get(15).unwrap_or_else(|_| "[]".to_string());
        let security_questions: Vec<SecurityQuestion> = serde_json::from_str(&sq_str).unwrap_or_default();

        Ok(Some(VaultEntryDto {
            id: row.get(0).map_err(|e| e.to_string())?,
            title: row.get(1).map_err(|e| e.to_string())?,
            username: row.get(2).map_err(|e| e.to_string())?,
            password: row.get(3).map_err(|e| e.to_string())?,
            url: row.get(4).map_err(|e| e.to_string())?,
            notes: row.get(5).map_err(|e| e.to_string())?,
            tags,
            favorite: fav_int != 0,
            ciphertext: row.get(8).map_err(|e| e.to_string())?,
            nonce: row.get(9).map_err(|e| e.to_string())?,
            version: row.get(10).map_err(|e| e.to_string())?,
            is_deleted: del_int != 0,
            sync_status: row.get(12).map_err(|e| e.to_string())?,
            client_updated_at: row.get(13).map_err(|e| e.to_string())?,
            server_updated_at: row.get(14).map_err(|e| e.to_string())?,
            security_questions,
        }))
    } else {
        Ok(None)
    }
}

pub fn upsert_entry(conn: &Connection, entry: &VaultEntryDto) -> Result<(), String> {
    let tags_json = serde_json::to_string(&entry.tags).unwrap_or_else(|_| "[]".to_string());
    let sq_json = serde_json::to_string(&entry.security_questions).unwrap_or_else(|_| "[]".to_string());
    let fav_int = if entry.favorite { 1 } else { 0 };
    let del_int = if entry.is_deleted { 1 } else { 0 };

    conn.execute(
        "INSERT INTO local_entries (
            id, title, username, password, url, notes, tags, favorite,
            ciphertext, nonce, version, is_deleted, sync_status,
            client_updated_at, server_updated_at, security_questions
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            username = excluded.username,
            password = excluded.password,
            url = excluded.url,
            notes = excluded.notes,
            tags = excluded.tags,
            favorite = excluded.favorite,
            ciphertext = excluded.ciphertext,
            nonce = excluded.nonce,
            version = excluded.version,
            is_deleted = excluded.is_deleted,
            sync_status = excluded.sync_status,
            client_updated_at = excluded.client_updated_at,
            server_updated_at = excluded.server_updated_at,
            security_questions = excluded.security_questions",
        params![
            entry.id,
            entry.title,
            entry.username,
            entry.password,
            entry.url,
            entry.notes,
            tags_json,
            fav_int,
            entry.ciphertext,
            entry.nonce,
            entry.version,
            del_int,
            entry.sync_status,
            entry.client_updated_at,
            entry.server_updated_at,
            sq_json,
        ],
    )
    .map_err(|e| format!("Failed to save entry {}: {}", entry.id, e))?;

    Ok(())
}

pub fn soft_delete_entry(conn: &Connection, id: &str, timestamp: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE local_entries 
         SET is_deleted = 1, sync_status = 'pending_delete', client_updated_at = ?2
         WHERE id = ?1",
        params![id, timestamp],
    )
    .map_err(|e| format!("Failed to delete entry {}: {}", id, e))?;

    Ok(())
}

pub fn get_pending_sync(conn: &Connection) -> Result<Vec<VaultEntryDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, username, password, url, notes, tags, favorite,
                    ciphertext, nonce, version, is_deleted, sync_status,
                    client_updated_at, server_updated_at, security_questions
             FROM local_entries
             WHERE sync_status != 'synced'",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let tags_str: String = row.get(6)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let fav_int: i32 = row.get(7)?;
            let del_int: i32 = row.get(11)?;
            let sq_str: String = row.get(15).unwrap_or_else(|_| "[]".to_string());
            let security_questions: Vec<SecurityQuestion> = serde_json::from_str(&sq_str).unwrap_or_default();

            Ok(VaultEntryDto {
                id: row.get(0)?,
                title: row.get(1)?,
                username: row.get(2)?,
                password: row.get(3)?,
                url: row.get(4)?,
                notes: row.get(5)?,
                tags,
                favorite: fav_int != 0,
                ciphertext: row.get(8)?,
                nonce: row.get(9)?,
                version: row.get(10)?,
                is_deleted: del_int != 0,
                sync_status: row.get(12)?,
                client_updated_at: row.get(13)?,
                server_updated_at: row.get(14)?,
                security_questions,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for entry in rows {
        entries.push(entry.map_err(|e| e.to_string())?);
    }

    Ok(entries)
}
