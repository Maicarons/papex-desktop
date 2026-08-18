//! Unified error type for Rust commands.
//!
//! Errors are serialised to the frontend as `{ code, message, params? }` so the
//! web layer can map `code` to an i18n key (see `src/lib/api/errors.ts`).

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),

    #[error("pdf parse error: {0}")]
    Pdf(String),

    #[error("index error: {0}")]
    Index(String),

    #[error("upload error: {0}")]
    Upload(String),

    #[error("http error: {0}")]
    Http(String),

    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("validation failed: {0}")]
    Validation(String),

    #[error("unauthorized")]
    Unauthorized,
}

/// Wire-format returned to the frontend. `code` is an i18n key suffix.
#[derive(Serialize)]
pub struct AppErrorPayload {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let code = match self {
            AppError::Io(_) => "error.io",
            AppError::Db(_) => "error.db",
            AppError::Keyring(_) => "error.keyring",
            AppError::Pdf(_) => "error.pdf",
            AppError::Index(_) => "error.index",
            AppError::Upload(_) => "error.upload",
            AppError::Http(_) => "error.http",
            AppError::Serde(_) => "error.serde",
            AppError::NotFound(_) => "error.not_found",
            AppError::Validation(_) => "error.validation",
            AppError::Unauthorized => "error.unauthorized",
        };
        let payload = AppErrorPayload {
            code: code.to_string(),
            message: self.to_string(),
            params: None,
        };
        payload.serialize(s)
    }
}

/// Result alias used across commands.
pub type AppResult<T> = Result<T, AppError>;
