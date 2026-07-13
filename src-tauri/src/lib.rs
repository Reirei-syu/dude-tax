mod instance_lock;

use instance_lock::{acquire_lock_for_app, try_acquire_instance_lock, InstanceLockState};
use tauri::AppHandle;
use tauri_plugin_sql::{Migration, MigrationKind};

/// 前端落盘后强制退出（避免 onCloseRequested + destroy 在 dev 下卡死）
#[tauri::command]
fn force_quit(app: AppHandle) {
    app.exit(0);
}

fn make_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

/// 开发版与安装版不同库文件，避免数据互相覆盖
fn sqlite_urls() -> (&'static str, &'static str) {
    ("sqlite:dude-tax.db", "sqlite:dude-tax-dev.db")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (prod_url, dev_url) = sqlite_urls();

    tauri::Builder::default()
        .manage(InstanceLockState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                // 安装包 / release
                .add_migrations(prod_url, make_migrations())
                // tauri dev
                .add_migrations(dev_url, make_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            try_acquire_instance_lock,
            force_quit
        ])
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
