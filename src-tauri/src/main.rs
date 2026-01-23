// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use browser_el_ipc::{AppState, commands};

fn main() {

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Tab commands
            commands::create_tab,
            commands::close_tab,
            commands::activate_tab,
            commands::get_all_tabs,
            commands::get_tabs_by_space,
            // Navigation commands
            commands::navigate,
            // Space commands
            commands::create_space,
            commands::delete_space,
            commands::activate_space,
            commands::get_all_spaces,
            commands::get_active_space_id,
            // Exam mode commands
            commands::toggle_yellow_mode,
            // Sidebar commands
            commands::set_sidebar_width,
            commands::toggle_sidebar_compact,
            commands::toggle_sidebar_hidden,
            // Settings commands
            commands::get_settings,
            commands::update_settings,
            // Bookmark commands
            commands::add_bookmark,
            commands::remove_bookmark,
            commands::search_bookmarks,
            commands::get_all_bookmarks,
            // History commands
            commands::add_history,
            commands::get_recent_history,
            commands::search_history,
            commands::clear_history,
        ])
        .setup(|app| {
            // Get app data directory
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            let db_path = app_data_dir.join("browser-el.db");
            let db_path_str = db_path.to_str().expect("Invalid DB path");

            // Initialize application state
            let app_state = AppState::new(db_path_str).expect("Failed to initialize app state");
            app.manage(app_state);

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
