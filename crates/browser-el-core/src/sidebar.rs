use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarState {
    pub width: u32,
    pub is_compact: bool,
    pub is_hidden: bool,
}

impl SidebarState {
    pub fn new() -> Self {
        Self {
            width: 280,
            is_compact: false,
            is_hidden: false,
        }
    }

    pub fn set_width(&mut self, width: u32) {
        self.width = width.clamp(200, 600);
    }

    pub fn toggle_compact(&mut self) -> bool {
        self.is_compact = !self.is_compact;
        self.is_compact
    }

    pub fn toggle_hidden(&mut self) -> bool {
        self.is_hidden = !self.is_hidden;
        self.is_hidden
    }
}

impl Default for SidebarState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_state() {
        let sidebar = SidebarState::new();
        assert_eq!(sidebar.width, 280);
        assert!(!sidebar.is_compact);
        assert!(!sidebar.is_hidden);
    }

    #[test]
    fn test_set_width_clamping() {
        let mut sidebar = SidebarState::new();
        sidebar.set_width(100); // Too small
        assert_eq!(sidebar.width, 200);

        sidebar.set_width(1000); // Too large
        assert_eq!(sidebar.width, 600);

        sidebar.set_width(400); // Just right
        assert_eq!(sidebar.width, 400);
    }

    #[test]
    fn test_toggle_compact() {
        let mut sidebar = SidebarState::new();
        sidebar.toggle_compact();
        assert!(sidebar.is_compact);
    }
}
