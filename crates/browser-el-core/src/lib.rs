pub mod tab_manager;
pub mod space_manager;
pub mod navigation;
pub mod exam_mode;
pub mod sidebar;
pub mod settings;

pub use tab_manager::{Tab, TabManager};
pub use space_manager::{Space, SpaceManager};
pub use navigation::NavigationManager;
pub use exam_mode::ExamMode;
pub use sidebar::SidebarState;
pub use settings::Settings;
