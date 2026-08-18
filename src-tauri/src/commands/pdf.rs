//! `pdf:*` commands — extract metadata/text from a local PDF via pdfium.
//!
//! Used by the "local PDF import" flow: the frontend passes an already-validated
//! path inside the app cache dir (or a user-picked temp path), Rust parses it,
//! and returns structured metadata for the user to confirm before upload.

use crate::error::{AppError, AppResult};
use crate::AppState;
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct ParseArgs {
    /// Absolute path to the PDF. Must be inside the app cache dir or a path the
    /// user explicitly opened via the file dialog (Tauri fs scope enforces this).
    pub path: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseResult {
    pub title: Option<String>,
    pub authors: Option<String>,
    pub pages: u32,
    pub text_preview: Option<String>,
    pub size: u64,
}

#[tauri::command]
pub fn parse_pdf(state: State<AppState>, args: ParseArgs) -> AppResult<ParseResult> {
    use pdfium_render::prelude::*;

    let path = std::path::Path::new(&args.path);
    if !path.exists() {
        return Err(AppError::NotFound(args.path));
    }
    let size = std::fs::metadata(path).map_err(AppError::Io)?.len();

    let pdfium = Pdfium::new(PdfiumLibraryBindings::new(
        Pdfium::pdfium_platform_library_name_at_path("./"),
    )?);

    let doc = pdfium
        .load_pdf_from_file(path, None)
        .map_err(|e| AppError::Pdf(e.to_string()))?;

    let pages = doc.pages().len() as u32;

    // Best-effort metadata extraction.
    let title = doc
        .metadata()
        .and_then(|m| m.title())
        .ok()
        .filter(|s| !s.trim().is_empty());
    let authors = doc
        .metadata()
        .and_then(|m| m.author())
        .ok()
        .filter(|s| !s.trim().is_empty());

    // Preview: first page text, capped.
    let text_preview = doc
        .pages()
        .first()
        .and_then(|p| p.text().ok())
        .map(|t| {
            let t = t.trim().to_string();
            if t.chars().count() > 600 {
                t.chars().take(600).collect::<String>()
            } else {
                t
            }
        })
        .filter(|s| !s.is_empty());

    let _ = state; // db handle not needed for parse, kept for symmetry
    Ok(ParseResult {
        title,
        authors,
        pages,
        text_preview,
        size,
    })
}
