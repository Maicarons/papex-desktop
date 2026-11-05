//! `upload:*` commands — pre-flight validation for file/image uploads.
//!
//! The actual multipart transfer to the Papex backend is performed by the
//! frontend (`features/upload/upload.ts`) via a direct `fetch` to keep Rust
//! thin; Rust only validates size/type/MIME and resolves the cached path so the
//! frontend never handles raw filesystem paths outside the app cache dir.

use crate::error::{AppError, AppResult};
use crate::AppState;
use serde::Deserialize;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct ValidateArgs {
    /// Path to the picked/imported file (inside app cache dir or fs scope).
    pub path: String,
    /// Upload kind, maps to server endpoint + limits (see `UPLOAD_LIMITS`).
    pub kind: UploadKind,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UploadKind {
    /// PDF submission / version (`POST /api/papers`). ≤ 200 MB.
    PaperPdf,
    /// Local PDF import (`POST /api/papers/import`). ≤ 200 MB.
    ImportPdf,
    /// Avatar (`POST /api/me/avatar`). ≤ 5 MB, png/jpg/webp.
    Avatar,
    /// Paper cover (`POST /api/papers/[id]/cover`). ≤ 10 MB.
    Cover,
    /// Note attachment (P2, `POST /api/notes/[id]/attachment`). ≤ 20 MB.
    NoteAttachment,
}

struct Limit {
    max_bytes: u64,
    mime: &'static [&'static str],
}

impl UploadKind {
    fn limit(&self) -> Limit {
        match self {
            UploadKind::PaperPdf | UploadKind::ImportPdf => Limit {
                max_bytes: 200 * 1024 * 1024,
                mime: &["application/pdf"],
            },
            UploadKind::Avatar => Limit {
                max_bytes: 5 * 1024 * 1024,
                mime: &["image/png", "image/jpeg", "image/webp"],
            },
            UploadKind::Cover => Limit {
                max_bytes: 10 * 1024 * 1024,
                mime: &["image/png", "image/jpeg", "image/webp"],
            },
            UploadKind::NoteAttachment => Limit {
                max_bytes: 20 * 1024 * 1024,
                mime: &["image/png", "image/jpeg", "image/webp", "application/pdf"],
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateResult {
    pub ok: bool,
    pub size: u64,
    pub mime: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command]
pub fn upload_validate(state: State<AppState>, args: ValidateArgs) -> AppResult<ValidateResult> {
    let path = std::path::Path::new(&args.path);
    let meta = std::fs::metadata(path).map_err(AppError::Io)?;
    let size = meta.len();

    // MIME sniff via extension (cheap; full magic sniffing is unnecessary here).
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    let mime = match ext.as_deref() {
        Some("pdf") => "application/pdf",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    }
    .to_string();

    let lim = args.kind.limit();
    let (ok, error) = if size > lim.max_bytes {
        (
            false,
            Some(format!("file too large: {size} > {} bytes", lim.max_bytes)),
        )
    } else if !lim.mime.contains(&mime.as_str()) {
        (
            false,
            Some(format!("unsupported mime {mime} for {:?}", args.kind)),
        )
    } else {
        (true, None)
    };

    let _ = state;
    Ok(ValidateResult {
        ok,
        size,
        mime,
        error,
    })
}
