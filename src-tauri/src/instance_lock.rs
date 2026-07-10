//! 单实例：在数据目录对 lock 文件独占打开；第二进程失败。
//! 开发版与安装版使用不同锁文件名，互不抢锁。

use std::fs::OpenOptions;
use std::path::PathBuf;
use std::sync::Mutex;

#[cfg(windows)]
use std::os::windows::fs::OpenOptionsExt;

use tauri::{AppHandle, Manager};

pub struct InstanceLockState {
    /// 持有打开的锁文件句柄，进程存活期间不释放
    _file: Mutex<Option<std::fs::File>>,
}

impl Default for InstanceLockState {
    fn default() -> Self {
        Self {
            _file: Mutex::new(None),
        }
    }
}

fn lock_file_name() -> &'static str {
    if cfg!(debug_assertions) {
        "dude-tax-dev.lock"
    } else {
        "dude-tax.lock"
    }
}

pub fn acquire_lock_for_app(app: &AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法解析应用配置目录: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("无法创建配置目录: {e}"))?;
    let lock_path: PathBuf = dir.join(lock_file_name());

    let mut opts = OpenOptions::new();
    opts.create(true).write(true).read(true).truncate(true);

    #[cfg(windows)]
    {
        // share_mode 0 = 不与其他进程共享 → 第二实例 Open 失败
        opts.share_mode(0);
    }

    let file = opts.open(&lock_path).map_err(|e| {
        let code = e.raw_os_error();
        // Windows ERROR_SHARING_VIOLATION = 32
        if code == Some(32)
            || e.kind() == std::io::ErrorKind::PermissionDenied
            || e.to_string().to_lowercase().contains("sharing")
            || e.to_string().to_lowercase().contains("being used")
        {
            "另一个 Dude Tax 实例已在运行".to_string()
        } else {
            format!("无法获取实例锁: {e}")
        }
    })?;

    use std::io::Write;
    let mut f = file;
    let _ = writeln!(
        f,
        "pid={} mode={}",
        std::process::id(),
        if cfg!(debug_assertions) { "dev" } else { "release" }
    );

    let state = app.state::<InstanceLockState>();
    let mut guard = state
        ._file
        .lock()
        .map_err(|_| "锁状态异常".to_string())?;
    *guard = Some(f);

    Ok(lock_path.to_string_lossy().to_string())
}

/// 前端可选二次确认（setup 已抢锁）
#[tauri::command]
pub fn try_acquire_instance_lock(app: AppHandle) -> Result<String, String> {
    let state = app.state::<InstanceLockState>();
    {
        let guard = state._file.lock().map_err(|_| "锁状态异常".to_string())?;
        if guard.is_some() {
            if let Ok(dir) = app.path().app_config_dir() {
                return Ok(dir.join(lock_file_name()).to_string_lossy().to_string());
            }
        }
    }
    acquire_lock_for_app(&app)
}
