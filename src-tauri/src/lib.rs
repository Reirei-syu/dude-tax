mod instance_lock;

use instance_lock::{acquire_lock_for_app, try_acquire_instance_lock, InstanceLockState};
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .manage(InstanceLockState::default())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dude-tax.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![try_acquire_instance_lock])
        .setup(|app| {
            match acquire_lock_for_app(app.handle()) {
                Ok(path) => {
                    eprintln!("[dude-tax] instance lock ok: {path}");
                    Ok(())
                }
                Err(msg) => {
                    eprintln!("[dude-tax] instance lock failed: {msg}");
                    Err(msg.into())
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
