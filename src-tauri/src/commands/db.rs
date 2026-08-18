//! `db:*` commands — local SQLite access (cache / annotations / progress / settings).

use crate::db::dao_annotations::{get as ann_get, soft_delete, upsert as ann_upsert};
use crate::db::dao_papers::{
    query_library, reading_progress_get, reading_progress_upsert, LibraryFilter,
};
use crate::db::dao_sync::{setting_get, setting_set, settings_all};
use crate::db::schema::{AnnotationRow, PaperRow, ReadingProgressRow, SettingRow};
use crate::error::AppResult;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct QueryLibraryArgs {
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub sort: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    50
}

#[tauri::command]
pub fn query_library(state: State<AppState>, args: QueryLibraryArgs) -> AppResult<Vec<PaperRow>> {
    let f = LibraryFilter {
        category: args.category,
        query: args.query,
        sort: args.sort,
        limit: args.limit.max(1).min(500),
        offset: args.offset.max(0),
    };
    query_library(state.db.conn(), &f)
}

#[tauri::command]
pub fn annotations_get(
    state: State<AppState>,
    paper_id: String,
    version: i64,
) -> AppResult<Vec<AnnotationRow>> {
    ann_get(state.db.conn(), &paper_id, version)
}

#[tauri::command]
pub fn annotations_upsert(
    state: State<AppState>,
    ann: AnnotationRow,
) -> AppResult<()> {
    ann_upsert(state.db.conn(), &ann)
}

#[tauri::command]
pub fn annotations_delete(state: State<AppState>, id: String) -> AppResult<()> {
    soft_delete(state.db.conn(), &id)
}

#[tauri::command]
pub fn reading_progress_get(
    state: State<AppState>,
    paper_id: String,
) -> AppResult<Option<ReadingProgressRow>> {
    reading_progress_get(state.db.conn(), &paper_id)
}

#[tauri::command]
pub fn reading_progress_upsert(
    state: State<AppState>,
    progress: ReadingProgressRow,
) -> AppResult<()> {
    reading_progress_upsert(state.db.conn(), &progress)
}

#[tauri::command]
pub fn settings_get(state: State<AppState>, key: String) -> AppResult<Option<String>> {
    setting_get(state.db.conn(), &key)
}

#[tauri::command]
pub fn settings_set(state: State<AppState>, key: String, value: String) -> AppResult<()> {
    setting_set(state.db.conn(), &key, &value)
}

#[tauri::command]
pub fn settings_all(state: State<AppState>) -> AppResult<Vec<SettingRow>> {
    settings_all(state.db.conn())
}
