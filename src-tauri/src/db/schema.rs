//! SQLite schema row types for `papex_local.db`.
//!
//! Mirrors the development plan (§4.4). All rows are `serde`-serialisable with
//! `camelCase` keys so they deserialize directly into the frontend bridge
//! types (see `src/lib/tauri/bridge.ts`). `abstract` is renamed explicitly
//! because it is a Rust reserved word.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperRow {
    pub id: String,
    pub title: String,
    #[serde(rename = "abstract", skip_serializing_if = "Option::is_none")]
    pub abstract_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_version: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authors: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fetched_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationRow {
    pub id: String,
    pub paper_id: String,
    pub version: i64,
    pub kind: String, // "highlight" | "note"
    pub page: i64,
    pub rect_json: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<i64>,
    pub sync_state: String, // local | pending | synced | conflict
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingProgressRow {
    pub paper_id: String,
    pub version: i64,
    pub page: i64,
    pub percent: f64,
    pub updated_at: i64,
    pub sync_state: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionRow {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncQueueRow {
    pub id: String,
    pub kind: String,
    pub payload_json: String,
    pub retry_count: i64,
    pub next_retry_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingRow {
    pub key: String,
    pub value: String,
}
