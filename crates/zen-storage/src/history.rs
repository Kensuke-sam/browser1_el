use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub url: String,
    pub title: String,
    pub visited_at: i64,
    pub visit_count: i32,
}

pub struct HistoryStore {
    conn: Connection,
}

impl HistoryStore {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                visited_at INTEGER NOT NULL,
                visit_count INTEGER DEFAULT 1
            )",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_url ON history(url)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_visited ON history(visited_at DESC)",
            [],
        )?;
        Ok(Self { conn })
    }

    pub fn add_visit(&self, url: &str, title: &str) -> Result<()> {
        // Check if URL already exists
        let exists: bool = self
            .conn
            .query_row("SELECT 1 FROM history WHERE url = ?1", [url], |_| Ok(true))
            .unwrap_or(false);

        if exists {
            // Update existing entry
            self.conn.execute(
                "UPDATE history
                 SET visit_count = visit_count + 1,
                     visited_at = ?1,
                     title = ?2
                 WHERE url = ?3",
                (chrono::Utc::now().timestamp(), title, url),
            )?;
        } else {
            // Insert new entry
            self.conn.execute(
                "INSERT INTO history (url, title, visited_at, visit_count)
                 VALUES (?1, ?2, ?3, 1)",
                (url, title, chrono::Utc::now().timestamp()),
            )?;
        }
        Ok(())
    }

    pub fn get_recent_history(&self, limit: usize) -> Result<Vec<HistoryEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, url, title, visited_at, visit_count
             FROM history
             ORDER BY visited_at DESC
             LIMIT ?1",
        )?;
        let entries = stmt.query_map([limit], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                url: row.get(1)?,
                title: row.get(2)?,
                visited_at: row.get(3)?,
                visit_count: row.get(4)?,
            })
        })?;
        entries.collect()
    }

    pub fn search_history(&self, query: &str) -> Result<Vec<HistoryEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, url, title, visited_at, visit_count
             FROM history
             WHERE title LIKE ?1 OR url LIKE ?1
             ORDER BY visited_at DESC
             LIMIT 100",
        )?;
        let search_pattern = format!("%{}%", query);
        let entries = stmt.query_map([&search_pattern], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                url: row.get(1)?,
                title: row.get(2)?,
                visited_at: row.get(3)?,
                visit_count: row.get(4)?,
            })
        })?;
        entries.collect()
    }

    pub fn clear_history(&self) -> Result<()> {
        self.conn.execute("DELETE FROM history", [])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_history_operations() -> Result<()> {
        let store = HistoryStore::new(":memory:")?;

        // Add visit
        store.add_visit("https://example.com", "Example Site")?;
        store.add_visit("https://example.com", "Example Site Updated")?; // Duplicate visit

        let recent = store.get_recent_history(10)?;
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].visit_count, 2);
        assert_eq!(recent[0].title, "Example Site Updated");

        // Search history
        let results = store.search_history("Example")?;
        assert_eq!(results.len(), 1);

        // Clear history
        store.clear_history()?;
        let recent = store.get_recent_history(10)?;
        assert_eq!(recent.len(), 0);

        Ok(())
    }
}
