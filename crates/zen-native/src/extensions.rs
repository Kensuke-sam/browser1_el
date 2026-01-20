use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extension {
    pub id: String,
    pub name: String,
    pub version: String,
    pub path: String,
}

// Platform-specific extension loading will be implemented here
// For now, this is a placeholder for future implementation
