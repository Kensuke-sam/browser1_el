use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub search_engine: String,
    pub theme: String,
    pub custom_search_url: Option<String>,
}

impl Settings {
    pub fn new() -> Self {
        Self {
            search_engine: "google".to_string(),
            theme: "liquid".to_string(),
            custom_search_url: None,
        }
    }

    pub fn set_search_engine(&mut self, engine: String) {
        self.search_engine = engine;
    }

    pub fn set_theme(&mut self, theme: String) {
        self.theme = theme;
    }

    pub fn set_custom_search_url(&mut self, url: Option<String>) {
        self.custom_search_url = url;
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = Settings::new();
        assert_eq!(settings.search_engine, "google");
        assert_eq!(settings.theme, "liquid");
        assert!(settings.custom_search_url.is_none());
    }

    #[test]
    fn test_set_search_engine() {
        let mut settings = Settings::new();
        settings.set_search_engine("duckduckgo".to_string());
        assert_eq!(settings.search_engine, "duckduckgo");
    }
}
