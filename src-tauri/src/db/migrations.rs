//! Embedded SQLite migrations for `papex_local.db`.
//!
//! Migrations are applied in order on startup (idempotent via the
//! `schema_migrations` bookkeeping table). Schema follows the dev plan §4.4.

use rusqlite::Connection;

/// Run all pending migrations.
pub fn run(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER NOT NULL UNIQUE,
            applied_at INTEGER NOT NULL
        );",
    )?;

    let applied: Vec<i64> = conn
        .prepare("SELECT version FROM schema_migrations")?
        .query_map([], |r| r.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    for (version, sql) in MIGRATIONS.iter() {
        if applied.contains(version) {
            continue;
        }
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            (version, now()),
        )?;
        tx.commit()?;
    }
    Ok(())
}

fn now() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

const MIGRATIONS: &[(i64, &str)] = &[
    (
        1,
        r#"CREATE TABLE IF NOT EXISTS papers_cache (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            abstract TEXT,
            category TEXT,
            status TEXT,
            latest_version INTEGER,
            authors TEXT,
            fetched_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS versions_cache (
            paper_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            pdf_path_local TEXT,
            size INTEGER,
            fetched_at INTEGER,
            PRIMARY KEY (paper_id, version)
        );
        CREATE TABLE IF NOT EXISTS annotations (
            id TEXT PRIMARY KEY,
            paper_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            kind TEXT NOT NULL,
            page INTEGER NOT NULL,
            rect_json TEXT NOT NULL,
            color TEXT,
            content TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
            sync_state TEXT NOT NULL DEFAULT 'local'
        );
        CREATE TABLE IF NOT EXISTS reading_progress (
            paper_id TEXT PRIMARY KEY,
            version INTEGER NOT NULL DEFAULT 1,
            page INTEGER NOT NULL DEFAULT 1,
            percent REAL NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL,
            sync_state TEXT NOT NULL DEFAULT 'local'
        );
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT
        );
        CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            next_retry_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );"#,
    ),
    (
        2,
        r#"CREATE INDEX IF NOT EXISTS idx_annotations_paper
            ON annotations (paper_id, version);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_retry
            ON sync_queue (next_retry_at);
        CREATE INDEX IF NOT EXISTS idx_papers_category
            ON papers_cache (category);"#,
    ),
];
