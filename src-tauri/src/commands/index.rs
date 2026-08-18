//! `indexer:*` commands — local full-text search (tantivy, P2).
//!
//! Stubbed for P0: the API exists and is wired from the frontend so the UI can
//! call it, but the index is built lazily. The full tantivy build/query lives
//! in `../indexer`.

use crate::error::AppResult;
use crate::AppState;
use serde::Deserialize;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct SearchArgs {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: usize,
}
fn default_limit() -> usize {
    20
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    pub paper_id: String,
    pub title: String,
    pub score: f32,
}

#[tauri::command]
pub fn index_search(state: State<AppState>, args: SearchArgs) -> AppResult<Vec<Hit>> {
    // P2: delegate to the tantivy indexer. Until the index is populated the
    // offline index returns nothing; online search is the fallback.
    let hits = crate::indexer::search(&state.db, &args.q, args.limit)?;
    Ok(hits)
}

#[tauri::command]
pub fn index_upsert(
    state: State<AppState>,
    paper_id: String,
    title: String,
    abstract_text: String,
) -> AppResult<()> {
    crate::indexer::upsert(&state.db, &paper_id, &title, &abstract_text)?;
    Ok(())
}
