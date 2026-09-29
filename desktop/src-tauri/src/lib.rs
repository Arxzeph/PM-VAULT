mod commands;
mod crypto;
mod db;
mod state;

use commands::*;
use rusqlite::Connection;
use state::AppState;
use std::fs;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Get local app data directory for storing the local database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;

            if !app_data_dir.exists() {
                fs::create_dir_all(&app_data_dir)
                    .map_err(|e| format!("Failed to create app data dir: {}", e))?;
            }

            let db_path = app_data_dir.join("pm_vault.db");
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open local database at {:?}: {}", db_path, e))?;

            db::init_tables(&conn)?;

            app.manage(AppState::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_vault_status,
            init_vault,
            unlock_vault,
            lock_vault,
            list_entries,
            save_entry,
            delete_entry,
            generate_password,
            import_remote_vault_meta,
            get_pending_sync,
            mark_entry_synced,
            apply_remote_entry,
            reset_vault,
            change_master_password,
            get_session_credentials,
            derive_auth_verifier_from_salt,
            setup_recovery_questions,
            get_recovery_questions,
            recover_vault_with_questions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
