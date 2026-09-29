use crate::db::VaultEntryDto;
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::Mutex;
use zeroize::Zeroizing;

pub struct VaultSession {
    pub email: String,
    pub owner_id: String,
    pub auth_verifier: String,
    pub master_key: Zeroizing<[u8; 32]>,
    pub dek: Zeroizing<[u8; 32]>,
    pub decrypted_cache: Mutex<HashMap<String, VaultEntryDto>>,
}

impl Drop for VaultSession {
    fn drop(&mut self) {
        // VaultSession drop automatically zeroizes master_key and dek via Zeroizing.
        // Also explicitly clear and drop the in-memory decrypted cache!
        if let Ok(mut cache) = self.decrypted_cache.lock() {
            cache.clear();
        }
    }
}

pub struct AppState {
    pub db: Mutex<Connection>,
    pub session: Mutex<Option<VaultSession>>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        Self {
            db: Mutex::new(conn),
            session: Mutex::new(None),
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.session.lock().unwrap().is_some()
    }

    pub fn lock(&self) {
        let mut session = self.session.lock().unwrap();
        // Dropping VaultSession triggers Zeroize for master_key, dek, and clears decrypted_cache
        *session = None;
    }
}
