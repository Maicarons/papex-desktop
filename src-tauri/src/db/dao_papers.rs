//! DAO: papers_cache / versions_cache / reading_progress / collections.

use crate::db::schema::{CollectionRow, PaperRow, ReadingProgressRow};
use crate::error::{AppError, AppResult};
use rusqlite::Connection;

#[derive(Debug, Default, serde::Serialize)]
pub struct LibraryFilter {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<String>, // "recent" | "title" | "version"
    pub limit: i64,
    pub offset: i64,
}

pub fn query_library(conn: &Connection, f: &LibraryFilter) -> AppResult<Vec<PaperRow>> {
    let mut sql = String::from(
        "SELECT id, title, abstract, category, status, latest_version, authors, fetched_at \
         FROM papers_cache WHERE 1=1",
    );
    let mut args: Vec<(String, rusqlite::types::Value)> = Vec::new();

    if let Some(cat) = &f.category {
        sql.push_str(" AND category = :category");
        args.push((":category".into(), cat.clone().into()));
    }
    if let Some(q) = &f.query {
        sql.push_str(" AND (title LIKE :q OR abstract LIKE :q OR authors LIKE :q)");
        args.push((":q".into(), format!("%{q}%").into()));
    }
    match f.sort.as_deref() {
        Some("title") => sql.push_str(" ORDER BY title COLLATE NOCASE ASC"),
        Some("version") => sql.push_str(" ORDER BY latest_version DESC"),
        _ => sql.push_str(" ORDER BY fetched_at DESC"),
    }
    sql.push_str(" LIMIT :limit OFFSET :offset");
    args.push((":limit".into(), f.limit.into()));
    args.push((":offset".into(), f.offset.into()));

    let mut stmt = conn.prepare(&sql)?;
    let params: Vec<&dyn rusqlite::ToSql> = args
        .iter()
        .map(|(_, v)| v as &dyn rusqlite::ToSql)
        .collect();
    let rows = stmt.query_map(rusqlite::params_from_iter(params), |r| {
        Ok(PaperRow {
            id: r.get(0)?,
            title: r.get(1)?,
            abstract_text: r.get(2)?,
            category: r.get(3)?,
            status: r.get(4)?,
            latest_version: r.get(5)?,
            authors: r.get(6)?,
            fetched_at: r.get(7)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Db)
}

pub fn upsert_paper(conn: &Connection, p: &PaperRow) -> AppResult<()> {
    conn.execute(
        "INSERT INTO papers_cache (id, title, abstract, category, status, latest_version, authors, fetched_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, abstract=excluded.abstract, category=excluded.category,
           status=excluded.status, latest_version=excluded.latest_version,
           authors=excluded.authors, fetched_at=excluded.fetched_at",
        rusqlite::params![
            p.id, p.title, p.abstract_text, p.category, p.status, p.latest_version, p.authors,
            p.fetched_at
        ],
    )?;
    Ok(())
}

pub fn reading_progress_get(
    conn: &Connection,
    paper_id: &str,
) -> AppResult<Option<ReadingProgressRow>> {
    let mut stmt = conn.prepare(
        "SELECT paper_id, version, page, percent, updated_at, sync_state FROM reading_progress WHERE paper_id = ?1",
    )?;
    let row = stmt.query_row(rusqlite::params![paper_id], |r| {
        Ok(ReadingProgressRow {
            paper_id: r.get(0)?,
            version: r.get(1)?,
            page: r.get(2)?,
            percent: r.get(3)?,
            updated_at: r.get(4)?,
            sync_state: r.get(5)?,
        })
    });
    match row {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Db(e)),
    }
}

pub fn reading_progress_upsert(conn: &Connection, p: &ReadingProgressRow) -> AppResult<()> {
    conn.execute(
        "INSERT INTO reading_progress (paper_id, version, page, percent, updated_at, sync_state)
         VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(paper_id) DO UPDATE SET
           version=excluded.version, page=excluded.page, percent=excluded.percent,
           updated_at=excluded.updated_at, sync_state=excluded.sync_state",
        rusqlite::params![
            p.paper_id,
            p.version,
            p.page,
            p.percent,
            p.updated_at,
            p.sync_state
        ],
    )?;
    Ok(())
}

pub fn list_collections(conn: &Connection) -> AppResult<Vec<CollectionRow>> {
    let mut stmt = conn.prepare("SELECT id, name, parent_id FROM collections")?;
    let rows = stmt.query_map([], |r| {
        Ok(CollectionRow {
            id: r.get(0)?,
            name: r.get(1)?,
            parent_id: r.get(2)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::Db)
}
