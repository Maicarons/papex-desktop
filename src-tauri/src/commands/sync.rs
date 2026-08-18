//! `sync:*` commands — drain and inspect the local sync queue.

use crate::error::AppResult;
use crate::sync::{run, status};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn sync_run(state: State<AppState>) -> AppResult<crate::sync::SyncResult> {
    run(&state)
}

#[tauri::command]
pub fn sync_status(state: State<AppState>) -> AppResult<crate::sync::SyncStatus> {
    status(&state)
}
