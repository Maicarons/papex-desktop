//! Local full-text index (tantivy, P2).
//!
//! Offline millisecond search over cached paper titles/abstracts/full text.
//! The schema is intentionally small; full-text page indexing is a later
//! refinement. Index lives under the OS cache dir so it is rebuilt if needed.

use crate::commands::index::Hit;
use crate::error::{AppError, AppResult};
use std::path::PathBuf;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{Schema, STORED, TEXT};
use tantivy::Index;

fn index_dir() -> PathBuf {
    dirs::cache_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("./cache"))
        .join("papex-desktop")
        .join("index")
}

fn build_schema() -> Schema {
    let mut s = Schema::builder();
    s.add_text_field("paper_id", STORED);
    s.add_text_field("title", TEXT | STORED);
    s.add_text_field("body", TEXT);
    s.build()
}

fn open_index() -> AppResult<Index> {
    let dir = index_dir();
    std::fs::create_dir_all(&dir).map_err(AppError::Io)?;
    match Index::open_in_dir(&dir) {
        Ok(idx) => Ok(idx),
        Err(_) => Ok(Index::create_in_dir(&dir, build_schema()).map_err(AppError::Index)?),
    }
}

/// Index (or replace) a document for a paper.
pub fn upsert(_db: &crate::db::Db, paper_id: &str, title: &str, body: &str) -> AppResult<()> {
    let index = open_index()?;
    let schema = index.schema();
    let pid = schema.get_field("paper_id").map_err(AppError::Index)?;
    let t = schema.get_field("title").map_err(AppError::Index)?;
    let b = schema.get_field("body").map_err(AppError::Index)?;

    let mut writer = index.writer(15_000_000).map_err(AppError::Index)?;
    // Naively delete existing doc for this paper_id before re-inserting.
    let qp = QueryParser::for_index(&index, vec![pid]);
    if let Ok(q) = qp.parse_query(paper_id) {
        writer.delete_query(q).map_err(AppError::Index)?;
    }
    writer
        .add_document(tantivy::doc!(
            pid => paper_id.to_string(),
            t => title.to_string(),
            b => body.to_string(),
        ))
        .map_err(AppError::Index)?;
    writer.commit().map_err(AppError::Index)?;
    Ok(())
}

/// Search the local index. Returns empty if the index is empty (online search
/// is the fallback in the frontend).
pub fn search(_db: &crate::db::Db, q: &str, limit: usize) -> AppResult<Vec<Hit>> {
    if q.trim().is_empty() {
        return Ok(Vec::new());
    }
    let index = open_index()?;
    let schema = index.schema();
    let pid = schema.get_field("paper_id").map_err(AppError::Index)?;
    let t = schema.get_field("title").map_err(AppError::Index)?;
    let reader = index.reader().map_err(AppError::Index)?;
    let searcher = reader.searcher();
    let qp = QueryParser::for_index(&index, vec![t]);
    let query = match qp.parse_query(q) {
        Ok(q) => q,
        Err(_) => return Ok(Vec::new()),
    };
    let docs = searcher
        .search(&query, &TopDocs::with_limit(limit))
        .map_err(AppError::Index)?;
    let mut hits = Vec::new();
    for (score, addr) in docs {
        if let Ok(ret) = searcher.doc(addr) {
            let paper_id = ret
                .get_first(pid)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();
            let title = ret
                .get_first(t)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();
            hits.push(Hit {
                paper_id,
                title,
                score,
            });
        }
    }
    Ok(hits)
}
