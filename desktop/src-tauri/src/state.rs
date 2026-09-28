use rusqlite::Connection;
use std::sync::Mutex;
use zeroize::Zeroizing;

#[allow(dead_code)]
pub struct VaultSession {
    pub email: String,
    pub auth_verifier: String,
    pub master_key: Zeroizing<[u8; 32]>,
    pub dek: Zeroizing<[u8; 32]>,
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
        // Dropping VaultSession triggers Zeroize for master_key and dek
        *session = None;
    }
}
