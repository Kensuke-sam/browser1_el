use tauri::{command, State, Window};
use zen_core::{NavigationManager, Space, Tab};

use crate::state::AppState;

// Tab Management Commands
#[command]
pub async fn create_tab(
    state: State<'_, AppState>,
    url: String,
    space_id: Option<String>,
) -> Result<Tab, String> {
    let space = space_id.unwrap_or_else(|| state.spaces.read().get_active_space_id());
    let tab = state.tabs.write().create_tab(url, space);
    Ok(tab)
}

#[command]
pub async fn close_tab(state: State<'_, AppState>, tab_id: String) -> Result<bool, String> {
    Ok(state.tabs.write().close_tab(&tab_id))
}

#[command]
pub async fn activate_tab(
    state: State<'_, AppState>,
    tab_id: String,
) -> Result<Option<Tab>, String> {
    Ok(state.tabs.write().activate_tab(&tab_id))
}

#[command]
pub async fn get_all_tabs(state: State<'_, AppState>) -> Result<Vec<Tab>, String> {
    Ok(state.tabs.read().get_all_tabs())
}

#[command]
pub async fn get_tabs_by_space(
    state: State<'_, AppState>,
    space_id: String,
) -> Result<Vec<Tab>, String> {
    Ok(state.tabs.read().get_tabs_by_space(&space_id))
}

// Navigation Commands
#[command]
pub async fn navigate(
    state: State<'_, AppState>,
    window: Window,
    tab_id: String,
    url: String,
) -> Result<String, String> {
    let search_engine = state.settings.read().search_engine.clone();
    let normalized = NavigationManager::normalize_url(&url, &search_engine);

    // Update tab URL
    state
        .tabs
        .write()
        .update_tab(&tab_id, normalized.clone(), url.clone());

    // Emit navigation event to frontend
    window
        .emit(
            "tab-navigate",
            serde_json::json!({
                "tabId": tab_id,
                "url": normalized
            }),
        )
        .map_err(|e| e.to_string())?;

    Ok(normalized)
}

// Space Management Commands
#[command]
pub async fn create_space(
    state: State<'_, AppState>,
    name: String,
    icon: String,
) -> Result<Space, String> {
    Ok(state.spaces.write().create_space(name, icon))
}

#[command]
pub async fn delete_space(state: State<'_, AppState>, space_id: String) -> Result<bool, String> {
    Ok(state.spaces.write().delete_space(&space_id))
}

#[command]
pub async fn activate_space(
    state: State<'_, AppState>,
    space_id: String,
) -> Result<bool, String> {
    Ok(state.spaces.write().activate_space(&space_id))
}

#[command]
pub async fn get_all_spaces(state: State<'_, AppState>) -> Result<Vec<Space>, String> {
    Ok(state.spaces.read().get_all_spaces())
}

#[command]
pub async fn get_active_space_id(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.spaces.read().get_active_space_id())
}

// Exam Mode Commands
#[command]
pub async fn toggle_yellow_mode(
    state: State<'_, AppState>,
    window: Window,
) -> Result<bool, String> {
    let enabled = state.exam_mode.write().toggle();

    // Emit event to inject CSS in all webviews
    window
        .emit(
            "inject-exam-css",
            serde_json::json!({
                "enabled": enabled,
                "css": zen_core::ExamMode::get_injection_css()
            }),
        )
        .map_err(|e| e.to_string())?;

    Ok(enabled)
}

// Sidebar Commands
#[command]
pub async fn set_sidebar_width(
    state: State<'_, AppState>,
    width: u32,
) -> Result<(), String> {
    state.sidebar.write().set_width(width);
    Ok(())
}

#[command]
pub async fn toggle_sidebar_compact(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.sidebar.write().toggle_compact())
}

#[command]
pub async fn toggle_sidebar_hidden(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.sidebar.write().toggle_hidden())
}

// Settings Commands
#[command]
pub async fn get_settings(
    state: State<'_, AppState>,
) -> Result<zen_core::Settings, String> {
    Ok(state.settings.read().clone())
}

#[command]
pub async fn update_settings(
    state: State<'_, AppState>,
    search_engine: Option<String>,
    theme: Option<String>,
    custom_search_url: Option<String>,
) -> Result<(), String> {
    let mut settings = state.settings.write();
    if let Some(engine) = search_engine {
        settings.set_search_engine(engine);
    }
    if let Some(t) = theme {
        settings.set_theme(t);
    }
    if custom_search_url.is_some() {
        settings.set_custom_search_url(custom_search_url);
    }
    Ok(())
}

// Bookmark Commands
#[command]
pub async fn add_bookmark(
    state: State<'_, AppState>,
    title: String,
    url: String,
    favicon: Option<String>,
) -> Result<String, String> {
    state
        .bookmarks
        .add_bookmark(&title, &url, favicon.as_deref())
        .map_err(|e| e.to_string())
}

#[command]
pub async fn remove_bookmark(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    state
        .bookmarks
        .remove_bookmark(&id)
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_bookmarks(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<zen_storage::Bookmark>, String> {
    state
        .bookmarks
        .search_bookmarks(&query)
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_all_bookmarks(
    state: State<'_, AppState>,
) -> Result<Vec<zen_storage::Bookmark>, String> {
    state
        .bookmarks
        .get_all_bookmarks()
        .map_err(|e| e.to_string())
}

// History Commands
#[command]
pub async fn add_history(
    state: State<'_, AppState>,
    url: String,
    title: String,
) -> Result<(), String> {
    state
        .history
        .add_visit(&url, &title)
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_recent_history(
    state: State<'_, AppState>,
    limit: usize,
) -> Result<Vec<zen_storage::HistoryEntry>, String> {
    state
        .history
        .get_recent_history(limit)
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_history(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<zen_storage::HistoryEntry>, String> {
    state
        .history
        .search_history(&query)
        .map_err(|e| e.to_string())
}

#[command]
pub async fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    state.history.clear_history().map_err(|e| e.to_string())
}
