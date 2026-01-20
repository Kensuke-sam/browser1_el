use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub id: String,
    pub title: String,
    pub url: String,
    pub favicon: Option<String>,
    pub is_loading: bool,
    pub can_go_back: bool,
    pub can_go_forward: bool,
    pub space_id: String,
}

pub struct TabManager {
    tabs: HashMap<String, Tab>,
    active_tab_id: Option<String>,
}

impl TabManager {
    pub fn new() -> Self {
        Self {
            tabs: HashMap::new(),
            active_tab_id: None,
        }
    }

    pub fn create_tab(&mut self, url: String, space_id: String) -> Tab {
        let id = format!("tab-{}", Uuid::new_v4());
        let tab = Tab {
            id: id.clone(),
            title: "新しいタブ".to_string(),
            url,
            favicon: None,
            is_loading: false,
            can_go_back: false,
            can_go_forward: false,
            space_id,
        };
        self.tabs.insert(id.clone(), tab.clone());
        self.active_tab_id = Some(id);
        tab
    }

    pub fn close_tab(&mut self, tab_id: &str) -> bool {
        if self.tabs.remove(tab_id).is_some() {
            if self.active_tab_id.as_deref() == Some(tab_id) {
                self.active_tab_id = self.tabs.keys().next().cloned();
            }
            true
        } else {
            false
        }
    }

    pub fn activate_tab(&mut self, tab_id: &str) -> Option<Tab> {
        if self.tabs.contains_key(tab_id) {
            self.active_tab_id = Some(tab_id.to_string());
            self.tabs.get(tab_id).cloned()
        } else {
            None
        }
    }

    pub fn get_tabs_by_space(&self, space_id: &str) -> Vec<Tab> {
        self.tabs
            .values()
            .filter(|t| t.space_id == space_id)
            .cloned()
            .collect()
    }

    pub fn get_all_tabs(&self) -> Vec<Tab> {
        self.tabs.values().cloned().collect()
    }

    pub fn get_active_tab_id(&self) -> Option<String> {
        self.active_tab_id.clone()
    }

    pub fn update_tab(&mut self, tab_id: &str, url: String, title: String) -> bool {
        if let Some(tab) = self.tabs.get_mut(tab_id) {
            tab.url = url;
            tab.title = title;
            true
        } else {
            false
        }
    }
}

impl Default for TabManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_close_tab() {
        let mut manager = TabManager::new();
        let tab = manager.create_tab("https://example.com".to_string(), "default".to_string());
        assert_eq!(tab.url, "https://example.com");
        assert_eq!(manager.tabs.len(), 1);

        let closed = manager.close_tab(&tab.id);
        assert!(closed);
        assert_eq!(manager.tabs.len(), 0);
    }

    #[test]
    fn test_activate_tab() {
        let mut manager = TabManager::new();
        let tab1 = manager.create_tab("https://example.com".to_string(), "default".to_string());
        let tab2 = manager.create_tab("https://test.com".to_string(), "default".to_string());

        manager.activate_tab(&tab1.id);
        assert_eq!(manager.get_active_tab_id(), Some(tab1.id.clone()));
    }

    #[test]
    fn test_get_tabs_by_space() {
        let mut manager = TabManager::new();
        manager.create_tab("https://example.com".to_string(), "work".to_string());
        manager.create_tab("https://test.com".to_string(), "personal".to_string());
        manager.create_tab("https://work.com".to_string(), "work".to_string());

        let work_tabs = manager.get_tabs_by_space("work");
        assert_eq!(work_tabs.len(), 2);
    }
}
