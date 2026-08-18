//! Papex desktop — Rust core (Tauri 2).
//!
//! This crate is intentionally *thin*: it only hosts native capabilities that
//! the web frontend cannot safely perform (PDF parsing, local SQLite, full-text
//! index, OS keychain, direct uploads, system paths). Every capability is
//! exposed to the frontend through a typed `invoke` command declared in
//! `commands/*` and consumed via `src/lib/tauri/bridge.ts`.

mod commands;
mod db;
mod error;
mod indexer;
mod sync;

use commands::sync as sync_cmd;
use tauri::Manager;

/// Build the shared application state (DB handle, indexer handle, sync runtime).
pub struct AppState {
    pub db: db::Db,
}

/// Entry point invoked from `main.rs`.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Focus the existing window when a second instance is launched.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            // Initialise the local database and run migrations.
            let db = db::Db::open(app.path().app_cache_dir()?)?;
            app.manage(AppState { db });

            // Build the tray icon.
            build_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pdf::parse_pdf,
            commands::db::query_library,
            commands::db::annotations_get,
            commands::db::annotations_upsert,
            commands::db::reading_progress_get,
            commands::db::reading_progress_upsert,
            commands::db::settings_get,
            commands::db::settings_set,
            commands::index::index_search,
            commands::index::index_upsert,
            commands::keyring::keyring_get,
            commands::keyring::keyring_set,
            commands::keyring::keyring_delete,
            commands::upload::upload_validate,
            commands::system::app_paths,
            commands::system::open_path,
            commands::system::check_update,
            sync_cmd::sync_run,
            sync_cmd::sync_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Papex desktop");
}

fn build_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    };

    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show Papex", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => app.exit(0),
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
