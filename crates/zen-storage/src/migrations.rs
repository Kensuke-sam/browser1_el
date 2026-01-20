use anyhow::Result;
use rusqlite::Connection;
use serde_json::Value;
use std::path::Path;

pub fn migrate_from_localstorage(json_data: &str, db_path: &Path) -> Result<()> {
    let data: Value = serde_json::from_str(json_data)?;
    let conn = Connection::open(db_path)?;

    // Migrate bookmarks
    if let Some(bookmarks) = data["bookmarks"].as_array() {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS bookmarks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                favicon TEXT,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        for bookmark in bookmarks {
            if let (Some(title), Some(url)) =
                (bookmark["title"].as_str(), bookmark["url"].as_str())
            {
                let id = bookmark["id"]
                    .as_str()
                    .unwrap_or(&format!("bm-{}", uuid::Uuid::new_v4()));
                let created_at = bookmark["createdAt"].as_i64().unwrap_or_else(|| {
                    chrono::Utc::now().timestamp()
                });

                conn.execute(
                    "INSERT OR REPLACE INTO bookmarks VALUES (?1, ?2, ?3, NULL, ?4)",
                    (id, title, url, created_at),
                )?;
            }
        }
    }

    // Migrate spaces
    if let Some(spaces) = data["spaces"].as_array() {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS spaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        for space in spaces {
            if let (Some(id), Some(name), Some(icon)) = (
                space["id"].as_str(),
                space["name"].as_str(),
                space["icon"].as_str(),
            ) {
                let created_at = space["createdAt"]
                    .as_i64()
                    .unwrap_or_else(|| chrono::Utc::now().timestamp());

                conn.execute(
                    "INSERT OR REPLACE INTO spaces VALUES (?1, ?2, ?3, ?4)",
                    (id, name, icon, created_at),
                )?;
            }
        }
    }

    // Migrate settings
    if let Some(settings) = data["settings"].as_object() {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        for (key, value) in settings {
            let value_str = serde_json::to_string(value)?;
            conn.execute(
                "INSERT OR REPLACE INTO settings VALUES (?1, ?2)",
                (key, value_str),
            )?;
        }
    }

    Ok(())
}
