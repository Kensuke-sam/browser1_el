use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Space {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub created_at: i64,
}

pub struct SpaceManager {
    spaces: Vec<Space>,
    active_space_id: String,
}

impl SpaceManager {
    pub fn new() -> Self {
        let default_spaces = vec![
            Space {
                id: "default".to_string(),
                name: "デフォルト".to_string(),
                icon: "🏠".to_string(),
                created_at: chrono::Utc::now().timestamp(),
            },
            Space {
                id: "work".to_string(),
                name: "仕事".to_string(),
                icon: "💼".to_string(),
                created_at: chrono::Utc::now().timestamp(),
            },
            Space {
                id: "personal".to_string(),
                name: "個人".to_string(),
                icon: "👤".to_string(),
                created_at: chrono::Utc::now().timestamp(),
            },
        ];

        Self {
            spaces: default_spaces,
            active_space_id: "default".to_string(),
        }
    }

    pub fn create_space(&mut self, name: String, icon: String) -> Space {
        let space = Space {
            id: format!("space-{}", Uuid::new_v4()),
            name,
            icon,
            created_at: chrono::Utc::now().timestamp(),
        };
        self.spaces.push(space.clone());
        space
    }

    pub fn delete_space(&mut self, space_id: &str) -> bool {
        // Cannot delete default space
        if space_id == "default" {
            return false;
        }

        if let Some(pos) = self.spaces.iter().position(|s| s.id == space_id) {
            self.spaces.remove(pos);
            if self.active_space_id == space_id {
                self.active_space_id = "default".to_string();
            }
            true
        } else {
            false
        }
    }

    pub fn activate_space(&mut self, space_id: &str) -> bool {
        if self.spaces.iter().any(|s| s.id == space_id) {
            self.active_space_id = space_id.to_string();
            true
        } else {
            false
        }
    }

    pub fn get_all_spaces(&self) -> Vec<Space> {
        self.spaces.clone()
    }

    pub fn get_active_space_id(&self) -> String {
        self.active_space_id.clone()
    }

    pub fn get_space(&self, space_id: &str) -> Option<Space> {
        self.spaces.iter().find(|s| s.id == space_id).cloned()
    }
}

impl Default for SpaceManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_spaces() {
        let manager = SpaceManager::new();
        assert_eq!(manager.spaces.len(), 3);
        assert_eq!(manager.get_active_space_id(), "default");
    }

    #[test]
    fn test_create_space() {
        let mut manager = SpaceManager::new();
        let space = manager.create_space("Testing".to_string(), "🧪".to_string());
        assert_eq!(space.name, "Testing");
        assert_eq!(manager.spaces.len(), 4);
    }

    #[test]
    fn test_delete_space() {
        let mut manager = SpaceManager::new();
        let space = manager.create_space("Temp".to_string(), "🗑️".to_string());

        let deleted = manager.delete_space(&space.id);
        assert!(deleted);
        assert_eq!(manager.spaces.len(), 3);
    }

    #[test]
    fn test_cannot_delete_default_space() {
        let mut manager = SpaceManager::new();
        let deleted = manager.delete_space("default");
        assert!(!deleted);
        assert_eq!(manager.spaces.len(), 3);
    }

    #[test]
    fn test_activate_space() {
        let mut manager = SpaceManager::new();
        manager.activate_space("work");
        assert_eq!(manager.get_active_space_id(), "work");
    }
}
