import { TabManager } from './tabs';
import { NavigationManager } from './navigation';
import { SidebarManager } from './sidebar';
import { SplitViewManager } from './splitview';
import { SpaceManager } from './spaces';
import { PanelManager } from './panels';
import { BookmarkManager } from './bookmarks';
import { HistoryManager } from './history';
import { ExtensionsManager } from './extensions';
import { SettingsPanel } from './settings';

// アプリケーションクラス
class ZenBrowser {
  private tabManager: TabManager;
  private navigationManager: NavigationManager;
  private sidebarManager: SidebarManager;
  private splitViewManager: SplitViewManager;
  private spaceManager: SpaceManager;
  private panelManager: PanelManager;
  private bookmarkManager: BookmarkManager;
  private historyManager: HistoryManager;
  private extensionsManager: ExtensionsManager;
  private settingsPanel: SettingsPanel;

  constructor() {
    // マネージャーを初期化
    this.tabManager = new TabManager();
    this.navigationManager = new NavigationManager(this.tabManager);
    this.sidebarManager = new SidebarManager();
    this.splitViewManager = new SplitViewManager(this.tabManager);
    this.spaceManager = new SpaceManager();
    this.panelManager = new PanelManager();

    this.spaceManager.setOnSpaceChange((spaceId, preferredTabId) => {
      this.tabManager.setActiveSpace(spaceId, preferredTabId);
    });

    this.tabManager.addOnSpaceSwitchRequestListener((spaceId, tabId) => {
      this.spaceManager.activateSpace(spaceId, tabId);
    });

    this.tabManager.setActiveSpace(this.spaceManager.getActiveSpaceId());

    this.bookmarkManager = new BookmarkManager(this.tabManager, this.panelManager);
    this.historyManager = new HistoryManager(this.tabManager, this.panelManager);
    this.extensionsManager = new ExtensionsManager();
    this.settingsPanel = new SettingsPanel(
      this.panelManager,
      this.bookmarkManager,
      this.historyManager,
      this.spaceManager,
      this.extensionsManager,
      this.tabManager,
    );

    // 初期タブを作成
    if (!this.tabManager.getActiveTab()) {
      this.tabManager.createTab('', this.spaceManager.getActiveSpaceId());
    }

    console.log('Browser El initialized');
  }

  // タブマネージャーを取得
  getTabManager(): TabManager {
    return this.tabManager;
  }

  // ナビゲーションマネージャーを取得
  getNavigationManager(): NavigationManager {
    return this.navigationManager;
  }

  // サイドバーマネージャーを取得
  getSidebarManager(): SidebarManager {
    return this.sidebarManager;
  }

  // 分割ビューマネージャーを取得
  getSplitViewManager(): SplitViewManager {
    return this.splitViewManager;
  }

  // スペースマネージャーを取得
  getSpaceManager(): SpaceManager {
    return this.spaceManager;
  }
}

// DOMが読み込まれたらアプリを初期化
document.addEventListener('DOMContentLoaded', () => {
  (window as any).zenBrowser = new ZenBrowser();
});
