use url::Url;

pub struct NavigationManager;

impl NavigationManager {
    pub fn normalize_url(input: &str, search_engine: &str) -> String {
        // Try parsing as URL first
        if let Ok(url) = Url::parse(input) {
            return url.to_string();
        }

        // Try adding https:// prefix for domain-like inputs
        if !input.contains(' ') && input.contains('.') {
            if let Ok(url) = Url::parse(&format!("https://{}", input)) {
                return url.to_string();
            }
        }

        // Treat as search query
        let encoded = urlencoding::encode(input);
        match search_engine {
            "google" => format!("https://www.google.com/search?q={}", encoded),
            "duckduckgo" => format!("https://duckduckgo.com/?q={}", encoded),
            "bing" => format!("https://www.bing.com/search?q={}", encoded),
            custom if custom.contains("{query}") => custom.replace("{query}", &encoded),
            _ => format!("https://www.google.com/search?q={}", encoded), // Default to Google
        }
    }

    pub fn is_secure_url(url: &str) -> bool {
        url.starts_with("https://")
    }

    pub fn extract_domain(url: &str) -> Option<String> {
        if let Ok(parsed) = Url::parse(url) {
            parsed.host_str().map(|h| h.to_string())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_url_with_protocol() {
        let url = NavigationManager::normalize_url("https://example.com", "google");
        assert_eq!(url, "https://example.com/");
    }

    #[test]
    fn test_normalize_url_without_protocol() {
        let url = NavigationManager::normalize_url("example.com", "google");
        assert_eq!(url, "https://example.com/");
    }

    #[test]
    fn test_normalize_url_as_search_query() {
        let url = NavigationManager::normalize_url("test query", "google");
        assert_eq!(url, "https://www.google.com/search?q=test%20query");
    }

    #[test]
    fn test_normalize_url_duckduckgo() {
        let url = NavigationManager::normalize_url("rust programming", "duckduckgo");
        assert_eq!(url, "https://duckduckgo.com/?q=rust%20programming");
    }

    #[test]
    fn test_is_secure_url() {
        assert!(NavigationManager::is_secure_url("https://example.com"));
        assert!(!NavigationManager::is_secure_url("http://example.com"));
    }

    #[test]
    fn test_extract_domain() {
        assert_eq!(
            NavigationManager::extract_domain("https://example.com/path"),
            Some("example.com".to_string())
        );
        assert_eq!(NavigationManager::extract_domain("invalid"), None);
    }
}
