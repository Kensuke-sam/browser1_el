use parking_lot::RwLock;
use zen_core::{ExamMode, NavigationManager, Settings, SidebarState, SpaceManager, TabManager};
use zen_storage::{BookmarkStore, HistoryStore};

pub struct AppState {
    pub tabs: RwLock<TabManager>,
    pub spaces: RwLock<SpaceManager>,
    pub sidebar: RwLock<SidebarState>,
    pub exam_mode: RwLock<ExamMode>,
    pub settings: RwLock<Settings>,
    pub bookmarks: BookmarkStore,
    pub history: HistoryStore,
}

impl AppState {
    pub fn new(db_path: &str) -> anyhow::Result<Self> {
        Ok(Self {
            tabs: RwLock::new(TabManager::new()),
            spaces: RwLock::new(SpaceManager::new()),
            sidebar: RwLock::new(SidebarState::new()),
            exam_mode: RwLock::new(ExamMode::new()),
            settings: RwLock::new(Settings::new()),
            bookmarks: BookmarkStore::new(db_path)?,
            history: HistoryStore::new(db_path)?,
        })
    }
}
