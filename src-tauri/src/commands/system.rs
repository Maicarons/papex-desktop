//! `system:*` commands — app paths and OS interactions.

use crate::error::{AppError, AppResult};
use crate::AppState;
use serde::Serialize;
use tauri::Manager;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub cache_dir: String,
    pub config_dir: String,
    pub data_dir: String,
}

#[tauri::command]
pub fn app_paths(state: State<AppState>, app: tauri::AppHandle) -> AppResult<AppPaths> {
    let p = app.path();
    Ok(AppPaths {
        cache_dir: p
            .app_cache_dir()
            .map_err(AppError::Io)?
            .to_string_lossy()
            .into_owned(),
        config_dir: p
            .app_config_dir()
            .map_err(AppError::Io)?
            .to_string_lossy()
            .into_owned(),
        data_dir: p
            .app_data_dir()
            .map_err(AppError::Io)?
            .to_string_lossy()
            .into_owned(),
    })
}

#[tauri::command]
pub fn open_path(_state: State<AppState>, app: tauri::AppHandle, path: String) -> AppResult<()> {
    // Open a file/URL with the OS default handler. Requires the
    // `shell:allow-open` capability (see capabilities/default.json).
    use tauri_plugin_shell::ShellExt;
    app.shell()
        .open(path, None)
        .map_err(|e| AppError::Http(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn check_update(
    _state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> AppResult<Option<crate::sync::UpdateInfo>> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| AppError::Http(e.to_string()))?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(crate::sync::UpdateInfo {
            version: update.version,
            current_version: update.current_version,
            date: update.date.map(|d| d.to_string()),
        })),
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(AppError::Http(e.to_string())),
    }
}
