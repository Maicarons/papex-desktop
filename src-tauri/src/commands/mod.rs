//! Tauri `invoke` commands — the only native surface exposed to the frontend.
//!
//! Each command validates its inputs (serde), operates on local native
//! capabilities, and returns serialisable results or an `AppError`. Paths are
//! always rooted at `app_cache_dir()` on the calling side and never accepted as
//! arbitrary arbitrary user strings that could traverse.

pub mod db;
pub mod index;
pub mod keyring;
pub mod pdf;
pub mod system;
pub mod sync;
pub mod upload;
