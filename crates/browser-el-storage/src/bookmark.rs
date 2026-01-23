use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub title: String,
    pub url: String,
    pub favicon: Option<String>,
    pub created_at: i64,
}

pub struct BookmarkStore {
    conn: Connection,
}

impl BookmarkStore {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
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
        Ok(Self { conn })
    }

    pub fn add_bookmark(&self, title: &str, url: &str, favicon: Option<&str>) -> Result<String> {
        let id = format!("bm-{}", Uuid::new_v4());
        self.conn.execute(
            "INSERT INTO bookmarks VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &id,
                title,
                url,
                favicon,
                chrono::Utc::now().timestamp(),
            ),
        )?;
        Ok(id)
    }

    pub fn remove_bookmark(&self, id: &str) -> Result<bool> {
        let rows = self.conn.execute("DELETE FROM bookmarks WHERE id = ?1", [id])?;
        Ok(rows > 0)
    }

    pub fn search_bookmarks(&self, query: &str) -> Result<Vec<Bookmark>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, url, favicon, created_at
             FROM bookmarks
             WHERE title LIKE ?1 OR url LIKE ?1
             ORDER BY created_at DESC",
        )?;
        let search_pattern = format!("%{}%", query);
        let bookmarks = stmt.query_map([&search_pattern], |row| {
            Ok(Bookmark {
                id: row.get(0)?,
                title: row.get(1)?,
                url: row.get(2)?,
                favicon: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        bookmarks.collect()
    }

    pub fn get_all_bookmarks(&self) -> Result<Vec<Bookmark>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, url, favicon, created_at
             FROM bookmarks
             ORDER BY created_at DESC",
        )?;
        let bookmarks = stmt.query_map([], |row| {
            Ok(Bookmark {
                id: row.get(0)?,
                title: row.get(1)?,
                url: row.get(2)?,
                favicon: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        bookmarks.collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bookmark_operations() -> Result<()> {
        let store = BookmarkStore::new(":memory:")?;

        // Add bookmark
        let id = store.add_bookmark("Example", "https://example.com", None)?;
        assert!(id.starts_with("bm-"));

        // Search bookmarks
        let results = store.search_bookmarks("Example")?;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Example");

        // Remove bookmark
        let removed = store.remove_bookmark(&id)?;
        assert!(removed);

        let results = store.search_bookmarks("Example")?;
        assert_eq!(results.len(), 0);

        Ok(())
    }
}
