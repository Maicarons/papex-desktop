//! DAO: sync_queue + settings + device-bound token persistence metadata.

use crate::db::schema::{SettingRow, SyncQueueRow};
use crate::error::{AppError, AppResult};
use rusqlite::Connection;

/// Enqueue a sync item. `kind` is the server endpoint family
/// (e.g. "annotation", "reading_progress"). `next_retry_at` uses exponential
/// backoff computed by the caller.
pub fn enqueue(conn: &Connection, item: &SyncQueueRow) -> AppResult<()> {
    conn.execute(
        "INSERT INTO sync_queue (id, kind, payload_json, retry_count, next_retry_at)
         VALUES (?1,?2,?3,?4,?5)",
        rusqlite::params![
            item.id,
            item.kind,
            item.payload_json,
            item.retry_count,
            item.next_retry_at
        ],
    )?;
    Ok(())
}

/// Pop the next due item (oldest due, limited to `limit`), used by the sync
/// runner to process the queue.
pub fn pop_due(conn: &Connection, now_ms: i64, limit: i64) -> AppResult<Vec<SyncQueueRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, kind, payload_json, retry_count, next_retry_at FROM sync_queue \
         WHERE next_retry_at <= ?1 ORDER BY next_retry_at ASC LIMIT ?2",
    )?;
    let rows = stmt.query_map(rusqlite::params![now_ms, limit], |r| {
        Ok(SyncQueueRow {
            id: r.get(0)?,
            kind: r.get(1)?,
            payload_json: r.get(2)?,
            retry_count: r.get(3)?,
            next_retry_at: r.get(4)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Db)
}

/// Remove a completed item from the queue.
pub fn remove(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM sync_queue WHERE id = ?1", [id])?;
    Ok(())
}

/// Bump retry count and schedule the next attempt with exponential backoff
/// (base 2s, cap 10 min) + jitter.
pub fn mark_retry(conn: &Connection, id: &str, attempt: i64) -> AppResult<()> {
    let base: i64 = 2000;
    let cap: i64 = 600_000;
    let backoff = (base * 2i64.saturating_pow(attempt as u32)).min(cap);
    let jitter = (backoff / 10).min(1);
    let next = chrono::Utc::now().timestamp_millis() + backoff + jitter;
    conn.execute(
        "UPDATE sync_queue SET retry_count = ?1, next_retry_at = ?2 WHERE id = ?3",
        rusqlite::params![attempt, next, id],
    )?;
    Ok(())
}

pub fn setting_get(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    let r = conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| {
        r.get::<_, String>(0)
    });
    match r {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Db(e)),
    }
}

pub fn setting_set(conn: &Connection, key: &str, value: &str) -> AppResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [key, value],
    )?;
    Ok(())
}

/// Read all settings (used to seed the settings store).
pub fn settings_all(conn: &Connection) -> AppResult<Vec<SettingRow>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |r| {
        Ok(SettingRow {
            key: r.get(0)?,
            value: r.get(1)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Db)
}
