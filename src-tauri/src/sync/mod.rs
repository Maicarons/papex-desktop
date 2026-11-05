//! Sync runtime: reconciles locally-changed rows (`sync_state = 'pending'`) and
//! the `sync_queue` (for note attachments) with the Papex backend, using
//! exponential backoff. Cloud endpoints are the source of truth.
//!
//! P0/P1: the replay step is TODO(backend) pending the notes/reading-progress
//! endpoints; until then items stay `pending` and the UI shows "syncing". The
//! queue mechanics (mark, retry, backoff) are fully wired.

use crate::db::dao_sync::{enqueue, mark_retry, pop_due, remove};
use crate::db::schema::SyncQueueRow;
use crate::error::{AppError, AppResult};
use crate::AppState;
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub pending: usize,
    pub last_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub processed: usize,
    pub failed: usize,
}

/// Count locally-pending items (annotations + progress + queue).
pub fn status(state: &AppState) -> AppResult<SyncStatus> {
    let conn = state.db.conn();
    let pending = count_pending(conn)?;
    Ok(SyncStatus {
        pending,
        last_error: None,
    })
}

fn count_pending(conn: &Connection) -> AppResult<usize> {
    let ann: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM annotations WHERE sync_state = 'pending'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let prog: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM reading_progress WHERE sync_state = 'pending'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let now = chrono::Utc::now().timestamp_millis();
    let due = pop_due(conn, now, 10_000)?;
    Ok((ann + prog + due.len() as i64) as usize)
}

/// Drain pending rows + queue. Each item is replayed; failures are rescheduled.
pub fn run(state: &AppState) -> AppResult<SyncResult> {
    let conn = state.db.conn();
    let mut processed = 0usize;
    let mut failed = 0usize;

    // 1) sync_queue (note attachments, etc.)
    let now = chrono::Utc::now().timestamp_millis();
    for item in pop_due(conn, now, 50)? {
        if replay(state, &item).is_ok() {
            remove(conn, &item.id)?;
            processed += 1;
        } else {
            mark_retry(conn, &item.id, item.retry_count + 1)?;
            failed += 1;
        }
    }

    // 2) pending annotations
    let ann_ids: Vec<String> = conn
        .prepare("SELECT id FROM annotations WHERE sync_state = 'pending'")?
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for id in ann_ids {
        if replay_annotation(state, &id).is_ok() {
            conn.execute(
                "UPDATE annotations SET sync_state = 'synced' WHERE id = ?1",
                [id],
            )?;
            processed += 1;
        } else {
            failed += 1;
        }
    }

    // 3) pending reading progress
    let pids: Vec<String> = conn
        .prepare("SELECT paper_id FROM reading_progress WHERE sync_state = 'pending'")?
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for pid in pids {
        if replay_progress(state, &pid).is_ok() {
            conn.execute(
                "UPDATE reading_progress SET sync_state = 'synced' WHERE paper_id = ?1",
                [pid],
            )?;
            processed += 1;
        } else {
            failed += 1;
        }
    }

    Ok(SyncResult { processed, failed })
}

/// Replay a single queued item against the backend.
/// TODO(backend): implement once /api/notes and /api/reading-progress are live.
fn replay(_state: &AppState, _item: &SyncQueueRow) -> AppResult<()> {
    Err(AppError::Upload(
        "sync replay pending backend endpoints".into(),
    ))
}

fn replay_annotation(_state: &AppState, _id: &str) -> AppResult<()> {
    // TODO(backend): GET the annotation payload, POST to /api/notes, on success
    // the row is marked synced (caller does this). Inject bearer from keyring.
    Err(AppError::Upload(
        "annotation sync pending backend endpoint".into(),
    ))
}

fn replay_progress(_state: &AppState, _paper_id: &str) -> AppResult<()> {
    // TODO(backend): PUT /api/reading-progress/[paperId].
    Err(AppError::Upload(
        "reading-progress sync pending backend endpoint".into(),
    ))
}

/// Enqueue a generic sync item (used by the frontend for note attachments).
pub fn enqueue_item(state: &AppState, item: &SyncQueueRow) -> AppResult<()> {
    enqueue(state.db.conn(), item)
}
