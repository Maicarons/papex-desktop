//! SQLite access layer (`papex_local.db`).
//!
//! Thin wrapper around `rusqlite` exposing the connection plus DAO modules.
//! The connection lives in Tauri app state (`AppState`).

pub mod dao_annotations;
pub mod dao_papers;
pub mod dao_sync;
pub mod migrations;
pub mod schema;

use rusqlite::Connection;
use std::path::PathBuf;

/// Local database handle.
pub struct Db {
    conn: Connection,
}

impl Db {
    /// Open (or create) the database inside the app cache directory and run
    /// migrations. `cache_dir` is the resolved `app_cache_dir()` path.
    pub fn open(cache_dir: PathBuf) -> crate::error::AppResult<Db> {
        let db_path = cache_dir.join("papex_local.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        migrations::run(&conn)?;
        Ok(Db { conn })
    }

    /// Access the underlying connection (DAO modules use this).
    pub fn conn(&self) -> &Connection {
        &self.conn
    }
}
