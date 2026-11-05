//! DAO: annotations (with `sync_state` lifecycle).

use crate::db::schema::AnnotationRow;
use crate::error::{AppError, AppResult};
use rusqlite::Connection;

pub fn get(conn: &Connection, paper_id: &str, version: i64) -> AppResult<Vec<AnnotationRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, paper_id, version, kind, page, rect_json, color, content, created_at, \
         updated_at, deleted_at, sync_state FROM annotations \
         WHERE paper_id = ?1 AND version = ?2 AND deleted_at IS NULL",
    )?;
    let rows = stmt.query_map(rusqlite::params![paper_id, version], |r| {
        Ok(AnnotationRow {
            id: r.get(0)?,
            paper_id: r.get(1)?,
            version: r.get(2)?,
            kind: r.get(3)?,
            page: r.get(4)?,
            rect_json: r.get(5)?,
            color: r.get(6)?,
            content: r.get(7)?,
            created_at: r.get(8)?,
            updated_at: r.get(9)?,
            deleted_at: r.get(10)?,
            sync_state: r.get(11)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Db)
}

/// Insert or update an annotation. New rows start as `local`; updates to
/// `synced` rows are bumped to `pending` so the sync queue can replay them.
pub fn upsert(conn: &Connection, a: &AnnotationRow) -> AppResult<()> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM annotations WHERE id = ?1",
            [a.id.clone()],
            |_| Ok(()),
        )
        .is_ok();

    let new_state = if exists && a.sync_state == "synced" {
        "pending"
    } else {
        &a.sync_state
    };

    conn.execute(
        "INSERT INTO annotations (id, paper_id, version, kind, page, rect_json, color, content, \
         created_at, updated_at, deleted_at, sync_state)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
         ON CONFLICT(id) DO UPDATE SET
           kind=excluded.kind, page=excluded.page, rect_json=excluded.rect_json,
           color=excluded.color, content=excluded.content, updated_at=excluded.updated_at,
           deleted_at=excluded.deleted_at, sync_state=?12",
        rusqlite::params![
            a.id,
            a.paper_id,
            a.version,
            a.kind,
            a.page,
            a.rect_json,
            a.color,
            a.content,
            a.created_at,
            a.updated_at,
            a.deleted_at,
            new_state
        ],
    )?;
    Ok(())
}

/// Soft-delete an annotation and mark it `pending` for cloud deletion.
pub fn soft_delete(conn: &Connection, id: &str) -> AppResult<()> {
    let ts = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE annotations SET deleted_at = ?1, updated_at = ?1, sync_state = 'pending' WHERE id = ?2",
        rusqlite::params![ts, id],
    )?;
    Ok(())
}
