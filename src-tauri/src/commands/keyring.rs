//! `keyring:*` commands — OS secret storage (Windows CredMan / macOS Keychain /
//! Linux SecretService, file fallback).
//!
//! SECURITY: refresh tokens are stored here and MUST NEVER be written to SQLite
//! or logs. The frontend only ever receives a redacted session descriptor.

use crate::error::{AppError, AppResult};
use crate::AppState;
use serde::Deserialize;
use tauri::State;

const SERVICE: &str = "papex-desktop";

#[derive(Debug, Deserialize)]
pub struct KeyringArgs {
    /// Account key, conventionally `"{userId}"` so multi-account is namespaced.
    pub user: String,
    #[serde(default)]
    pub secret: Option<String>,
}

#[tauri::command]
pub fn keyring_set(_state: State<AppState>, args: KeyringArgs) -> AppResult<()> {
    let secret = args
        .secret
        .ok_or_else(|| AppError::Validation("missing secret".into()))?;
    let entry = keyring::Entry::new(SERVICE, &args.user).map_err(AppError::Keyring)?;
    entry
        .set_password(&secret)
        .map_err(AppError::Keyring)?;
    Ok(())
}

#[tauri::command]
pub fn keyring_get(_state: State<AppState>, args: KeyringArgs) -> AppResult<Option<String>> {
    let entry = keyring::Entry::new(SERVICE, &args.user).map_err(AppError::Keyring)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keyring(e)),
    }
}

#[tauri::command]
pub fn keyring_delete(_state: State<AppState>, args: KeyringArgs) -> AppResult<()> {
    let entry = keyring::Entry::new(SERVICE, &args.user).map_err(AppError::Keyring)?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Keyring(e)),
    }
}
