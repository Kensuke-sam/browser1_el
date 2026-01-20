// タブの状態を表すインターフェース
export interface Tab {
  id: string;
  title: string;
  url: string;
  favicon: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  spaceId: string;
}

// タブ管理クラス
export class TabManager {
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private activeSpaceId: string = 'default';
  private lastActiveTabBySpace: Map<string, string> = new Map();
  private tabsContainerElement: HTMLElement;
  private tabsListElement: HTMLElement;
  private otherTabsListElement: HTMLElement;
  private otherTabsSection: HTMLElement;
  private webviewContainer: HTMLElement;
  private tabChangeListeners: Array<(tab: Tab | null) => void> = [];
  private tabNavigationListeners: Array<(tab: Tab, url: string) => void> = [];
  private spaceSwitchListeners: Array<(spaceId: string, tabId: string) => void> = [];
  private isYellowModeEnabled: boolean = true;

  constructor() {
    this.tabsContainerElement = document.getElementById('tabs-container')!;
    this.tabsListElement = document.getElementById('tabs-list')!;
    this.otherTabsListElement = document.getElementById('other-tabs-list')!;
    this.otherTabsSection = document.getElementById('other-tabs-section')!;
    this.webviewContainer = document.getElementById('webview-container')!;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 新規タブボタン
    document.getElementById('new-tab-btn')?.addEventListener('click', () => {
      this.createTab();
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            this.toggleYellowMode();
            return;
        }
        switch (e.key) {
          case 't':
            e.preventDefault();
            this.createTab();
            break;
          case 'w':
            e.preventDefault();
            if (this.activeTabId) {
              this.closeTab(this.activeTabId);
            }
            break;
          case 'Tab':
            e.preventDefault();
            this.switchToNextTab(e.shiftKey);
            break;
        }
      }
    });
  }

  // タブ変更時のコールバックを追加
  addOnTabChangeListener(callback: (tab: Tab | null) => void): void {
    this.tabChangeListeners.push(callback);
  }

  // 互換性のため残す
  setOnTabChange(callback: (tab: Tab | null) => void): void {
    this.addOnTabChangeListener(callback);
  }

  // ナビゲーション時のコールバックを追加
  addOnTabNavigationListener(callback: (tab: Tab, url: string) => void): void {
    this.tabNavigationListeners.push(callback);
  }

  // スペース切り替えが必要なタブクリックを通知
  addOnSpaceSwitchRequestListener(
    callback: (spaceId: string, tabId: string) => void,
  ): void {
    this.spaceSwitchListeners.push(callback);
  }

  // 新しいタブを作成
  createTab(url: string = '', spaceId?: string): Tab {
    const resolvedSpaceId = spaceId ?? this.activeSpaceId;
    const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tab: Tab = {
      id,
      title: '新しいタブ',
      url: url || 'about:blank',
      favicon: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      spaceId: resolvedSpaceId,
    };

    this.tabs.set(id, tab);
    this.renderTab(tab);
    this.createWebview(tab);
    this.activateTab(id);

    return tab;
  }

  // タブのHTML要素を作成
  private renderTab(tab: Tab): void {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tab.id;
    tabElement.dataset.spaceId = tab.spaceId;
    tabElement.draggable = true;
    tabElement.classList.toggle('other-space', tab.spaceId !== this.activeSpaceId);

    tabElement.innerHTML = `
      <img class="tab-favicon ${tab.isLoading ? 'loading' : ''}" 
           src="${tab.favicon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><circle cx=%228%22 cy=%228%22 r=%226%22 fill=%22%236366f1%22/></svg>'}" 
           alt="">
      <div class="tab-info">
        <span class="tab-title">${this.escapeHtml(tab.title)}</span>
        <span class="tab-url">${this.getDisplayUrl(tab.url)}</span>
      </div>
      <button class="tab-close" title="タブを閉じる">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5"/>
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    `;

    // クリックでタブをアクティブに
    tabElement.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.tab-close')) {
        if (tab.spaceId !== this.activeSpaceId) {
          this.requestSpaceSwitch(tab.spaceId, tab.id);
          return;
        }
        this.activateTab(tab.id);
      }
    });

    // 閉じるボタン
    tabElement.querySelector('.tab-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    });

    // ドラッグ&ドロップ
    this.setupDragAndDrop(tabElement, tab.id);

    const targetList =
      tab.spaceId === this.activeSpaceId
        ? this.tabsListElement
        : this.otherTabsListElement;
    targetList.appendChild(tabElement);
    this.updateOtherTabsVisibility();
  }

  // ドラッグ&ドロップのセットアップ
  private setupDragAndDrop(element: HTMLElement, tabId: string): void {
    element.addEventListener('dragstart', (e) => {
      element.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', tabId);
    });

    element.addEventListener('dragend', () => {
      element.classList.remove('dragging');
    });

    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('drag-over');
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
      const draggedId = e.dataTransfer?.getData('text/plain');
      if (draggedId && draggedId !== tabId) {
        this.reorderTabs(draggedId, tabId);
      }
    });
  }

  // タブの順序を変更
  private reorderTabs(draggedId: string, targetId: string): void {
    const draggedElement = this.tabsContainerElement.querySelector(
      `[data-tab-id="${draggedId}"]`,
    ) as HTMLElement | null;
    const targetElement = this.tabsContainerElement.querySelector(
      `[data-tab-id="${targetId}"]`,
    ) as HTMLElement | null;

    if (!draggedElement || !targetElement) {
      return;
    }

    if (draggedElement.dataset.spaceId !== targetElement.dataset.spaceId) {
      return;
    }

    const parent = targetElement.parentElement;
    if (parent) {
      parent.insertBefore(draggedElement, targetElement);
    }
  }

  // Webviewを作成
  private createWebview(tab: Tab): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'webview-wrapper';
    wrapper.id = `webview-wrapper-${tab.id}`;
    wrapper.dataset.spaceId = tab.spaceId;
    wrapper.style.display = tab.spaceId === this.activeSpaceId ? '' : 'none';

    if (tab.url === 'about:blank' || !tab.url) {
      // 新規タブページを表示
      wrapper.innerHTML = `
        <div class="new-tab-page">
          <div class="logo">🌊</div>
          <h1>Zen Browser</h1>
          <p class="tagline">シンプルで美しいブラウジング体験</p>
          <div class="search-box">
            <input type="text" class="search-input" placeholder="検索またはURLを入力" id="newtab-search-${tab.id}">
          </div>
        </div>
      `;

      // 検索入力のイベント
      const searchInput = wrapper.querySelector(`#newtab-search-${tab.id}`) as HTMLInputElement;
      searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          this.navigateTab(tab.id, searchInput.value.trim());
        }
      });
    } else {
      // Webviewを作成
      const webview = document.createElement('webview');
      this.applyWebviewPreload(webview);
      webview.setAttribute('src', tab.url);
      webview.setAttribute('allowpopups', 'true');
      wrapper.appendChild(webview);
      this.setupWebviewEvents(webview, tab.id);
    }

    this.webviewContainer.appendChild(wrapper);
  }

  // Webviewのイベントをセットアップ
  private setupWebviewEvents(webview: Electron.WebviewTag, tabId: string): void {
    webview.addEventListener('did-start-loading', () => {
      this.updateTab(tabId, { isLoading: true });
    });

    webview.addEventListener('did-stop-loading', () => {
      this.updateTab(tabId, { isLoading: false });
    });

    webview.addEventListener('page-title-updated', (e: any) => {
      this.updateTab(tabId, { title: e.title });
    });

    webview.addEventListener('page-favicon-updated', (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        this.updateTab(tabId, { favicon: e.favicons[0] });
      }
    });

    webview.addEventListener('did-navigate', (e: any) => {
      this.updateTab(tabId, { 
        url: e.url,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward()
      });
      this.notifyTabNavigation(tabId, e.url);
    });

    webview.addEventListener('did-navigate-in-page', (e: any) => {
      if (e.isMainFrame) {
        this.updateTab(tabId, { 
          url: e.url,
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward()
        });
        this.notifyTabNavigation(tabId, e.url);
      }
    });

    // Use executeJavaScript for dynamic and aggressive fixing
    const injectionScript = `
      (function() {
        if (window.__ZEN_INJECTION_RUNNING) return;
        window.__ZEN_INJECTION_RUNNING = true;
        
        console.log('%c[Zen Browser] Nuclear Injection Started (Final Refined Yellow)', 'color: lime; font-size: 20px;');

        function applyStyles() {
          // Check global toggle state passed from renderer via executeJavaScript updating this prop
          if (window.__ZEN_YELLOW_ENABLED === false) {
             // If disabled, try to reset the body background if it matches our gold
             // This is a naive reset but works for toggling off
             if (document.body.style.backgroundColor === 'rgb(255, 251, 213)' || document.body.style.backgroundColor === '#fffbd5') {
                 document.body.style.backgroundColor = '';
                 document.documentElement.style.backgroundColor = '';
             }
             return;
          }

          const gold = '#fffbd5'; // Midpoint Yellow (Between Yellow 50 and 100)
          const white = '#ffffff'; // Content color
          
          // 1. Force Background (Bands)
          document.documentElement.style.backgroundColor = gold;
          document.body.style.backgroundColor = gold;
          
          // 2. Force Content to be White (Aggressive Mode)
          const contentSelectors = [
            '#app', '#root', '#__next', 
            '.app', '.container', '.wrapper', 
            'main', 'article', '#content', '#main',
            '.paper', '.sheet', '.page', '.exam-container',
            '[role="main"]'
          ];
          
          // Specific targeting
          contentSelectors.forEach(selector => {
            const els = document.querySelectorAll(selector);
            els.forEach(el => {
              if (el !== document.body && el !== document.documentElement) {
                  // Ensure we override !important styles from the page
                  el.style.setProperty('background-color', white, 'important'); 
                  // Widen content to reduce band size
                  el.style.setProperty('max-width', '90vw', 'important');
                  el.style.setProperty('width', '90vw', 'important');
              }
            });
          });

          // Aggressive Child Scan
          Array.from(document.body.children).forEach(child => {
            if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') return;
            const style = window.getComputedStyle(child);
            if (style.display !== 'none' && style.position !== 'fixed') {
                if (child.clientWidth > 300) {
                   if (style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent') {
                      child.style.setProperty('background-color', white, 'important');
                   }
                   // Widen aggressively
                   child.style.setProperty('max-width', '90vw', 'important');
                }
            }
          });

          // 3. Hunt Red Elements -> Turn them Yellow (the bands)
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const style = window.getComputedStyle(el);
            const bg = style.backgroundColor;
            if (bg.indexOf('rgb(255, 0, 0)') !== -1 || bg.indexOf('rgba(255, 0, 0') !== -1 || bg === 'red' || bg === '#ff0000') {
               el.style.setProperty('background-color', gold, 'important');
            }
          }
        }

        // Fullscreen Spoofing (Backup)
        try {
           const getDocEl = () => document.documentElement;
           if (!document.fullscreenElement) {
             Object.defineProperty(document, 'fullscreenElement', { get: getDocEl, configurable: true });
             Object.defineProperty(document, 'webkitFullscreenElement', { get: getDocEl, configurable: true });
             Object.defineProperty(document, 'fullscreen', { get: () => true, configurable: true });
           }
        } catch {}

        // Run Loop
        setInterval(applyStyles, 100);
        applyStyles();
      })();
    `;

    webview.addEventListener('dom-ready', () => {
      // Set initial state
      webview.executeJavaScript(`window.__ZEN_YELLOW_ENABLED = ${this.isYellowModeEnabled};`).then(() => {
          webview.executeJavaScript(injectionScript).catch(e => console.error('JS Injection failed', e));
      });
    });

    webview.addEventListener('did-navigate', () => {
        webview.executeJavaScript(`window.__ZEN_YELLOW_ENABLED = ${this.isYellowModeEnabled};`).then(() => {
            webview.executeJavaScript(injectionScript).catch(() => {});
        });
    });

  }

  // Toggle Yellow Mode
  toggleYellowMode(): void {
    this.isYellowModeEnabled = !this.isYellowModeEnabled;
    console.log('[TabManager] Toggling Yellow Mode:', this.isYellowModeEnabled);
    
    // Broadcast to all active webviews
    // In a multi-tab setup, ideally checking `this.tabs` or `getActiveWebview` is enough if user only cares about current
    // But let's verify all loaded webviews to be safe
    const webviews = this.webviewContainer.querySelectorAll('webview');
    webviews.forEach((webview: any) => {
        try {
            webview.executeJavaScript(`window.__ZEN_YELLOW_ENABLED = ${this.isYellowModeEnabled};`);
        } catch(e) { console.error(e); }
    });
  }

  // タブを更新
  updateTab(tabId: string, updates: Partial<Tab>): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    Object.assign(tab, updates);
    this.updateTabElement(tabId);

    if (tabId === this.activeTabId) {
      this.notifyTabChange(tab);
    }
  }

  // タブ要素を更新
  private updateTabElement(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const element = this.tabsContainerElement.querySelector(`[data-tab-id="${tabId}"]`);
    if (!element) return;

    const favicon = element.querySelector('.tab-favicon') as HTMLImageElement;
    const title = element.querySelector('.tab-title');
    const url = element.querySelector('.tab-url');

    if (favicon) {
      favicon.src = tab.favicon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><circle cx=%228%22 cy=%228%22 r=%226%22 fill=%22%236366f1%22/></svg>';
      favicon.classList.toggle('loading', tab.isLoading);
    }
    if (title) title.textContent = tab.title;
    if (url) url.textContent = this.getDisplayUrl(tab.url);
  }

  // タブをアクティブにする
  activateTab(tabId: string): void {
    // 前のアクティブタブを非アクティブに
    if (this.activeTabId) {
      const prevElement = this.tabsContainerElement.querySelector(
        `[data-tab-id="${this.activeTabId}"]`,
      );
      prevElement?.classList.remove('active');
      
      const prevWrapper = document.getElementById(`webview-wrapper-${this.activeTabId}`);
      prevWrapper?.classList.remove('active');
    }

    // 新しいタブをアクティブに
    this.activeTabId = tabId;
    
    const element = this.tabsContainerElement.querySelector(`[data-tab-id="${tabId}"]`);
    element?.classList.add('active');
    
    const wrapper = document.getElementById(`webview-wrapper-${tabId}`);
    wrapper?.classList.add('active');

    const tab = this.tabs.get(tabId);
    if (tab) {
      this.lastActiveTabBySpace.set(tab.spaceId, tabId);
    }
    this.notifyTabChange(tab || null);
  }

  // タブを閉じる
  closeTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // DOM要素を削除
    const element = this.tabsContainerElement.querySelector(`[data-tab-id="${tabId}"]`);
    element?.remove();

    const wrapper = document.getElementById(`webview-wrapper-${tabId}`);
    wrapper?.remove();

    // タブを削除
    this.tabs.delete(tabId);
    this.updateOtherTabsVisibility();

    // アクティブタブが閉じられた場合、別のタブをアクティブに
    if (this.activeTabId === tabId) {
      const remainingTabs = this.getTabIdsForSpace(tab.spaceId);
      if (remainingTabs.length > 0) {
        this.activateTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        this.activeTabId = null;
        this.createTab('', tab.spaceId); // スペース内の最後のタブが閉じられたら新規タブを作成
      }
    }
  }

  // 次/前のタブに切り替え
  private switchToNextTab(reverse: boolean): void {
    const tabIds = this.getTabIdsForSpace(this.activeSpaceId);
    if (tabIds.length <= 1) return;

    const currentIndex = this.activeTabId ? tabIds.indexOf(this.activeTabId) : 0;
    let nextIndex = reverse ? currentIndex - 1 : currentIndex + 1;
    
    if (nextIndex < 0) nextIndex = tabIds.length - 1;
    if (nextIndex >= tabIds.length) nextIndex = 0;

    this.activateTab(tabIds[nextIndex]);
  }

  // タブにナビゲート
  navigateTab(tabId: string, url: string): void {
    const wrapper = document.getElementById(`webview-wrapper-${tabId}`);
    if (!wrapper) return;

    // URLを正規化
    const normalizedUrl = this.normalizeUrl(url);

    // 既存のwebviewがあれば更新、なければ作成
    let webview = wrapper.querySelector('webview') as Electron.WebviewTag;
    
    if (!webview) {
      // 新規タブページを削除
      wrapper.innerHTML = '';
      webview = document.createElement('webview') as Electron.WebviewTag;
      this.applyWebviewPreload(webview);
      webview.setAttribute('allowpopups', 'true');
      wrapper.appendChild(webview);
      this.setupWebviewEvents(webview, tabId);
    }

    webview.src = normalizedUrl;
    this.updateTab(tabId, { url: normalizedUrl });
  }

  // URLを正規化
  private normalizeUrl(input: string): string {
    const trimmed = input.trim();
    
    // URLパターンをチェック
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    
    // ドメインのようなパターン
    if (/^[\w-]+\.[\w.-]+/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    
    // 検索クエリとして扱う
    const storedSettings = localStorage.getItem('zen-settings');
    if (!storedSettings) {
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }

    try {
      const settings = JSON.parse(storedSettings) as { searchEngine?: string; customSearchUrl?: string };
      const query = encodeURIComponent(trimmed);
      switch (settings.searchEngine) {
        case 'duckduckgo':
          return `https://duckduckgo.com/?q=${query}`;
        case 'bing':
          return `https://www.bing.com/search?q=${query}`;
        case 'custom': {
          const template = settings.customSearchUrl?.trim();
          if (template) {
            return template.includes('{query}') ? template.replaceAll('{query}', query) : `${template}${query}`;
          }
          return `https://www.google.com/search?q=${query}`;
        }
        case 'google':
        default:
          return `https://www.google.com/search?q=${query}`;
      }
    } catch {
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }
  }

  private applyWebviewPreload(webview: Electron.WebviewTag): void {
    let preloadPath = window.electronAPI?.paths?.webviewPreload;
    console.log('[Tabs] Raw preload path:', preloadPath);

    if (!preloadPath) {
      console.error('[Tabs] No preload path found!');
      return;
    }

    // Ensure file:// protocol
    if (!preloadPath.startsWith('file://')) {
      preloadPath = `file://${preloadPath}`;
    }

    console.log('[Tabs] Setting webview preload:', preloadPath);
    webview.setAttribute('preload', preloadPath);
  }

  // 表示用URLを取得
  private getDisplayUrl(url: string): string {
    if (!url || url === 'about:blank') return '';
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    } catch {
      return url;
    }
  }

  // HTMLエスケープ
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 現在のタブを取得
  getActiveTab(): Tab | null {
    return this.activeTabId ? this.tabs.get(this.activeTabId) || null : null;
  }

  // 現在のWebviewを取得
  getActiveWebview(): Electron.WebviewTag | null {
    if (!this.activeTabId) return null;
    const wrapper = document.getElementById(`webview-wrapper-${this.activeTabId}`);
    return wrapper?.querySelector('webview') as Electron.WebviewTag | null;
  }

  // 現在のスペースを設定
  setActiveSpace(spaceId: string, preferredTabId?: string): void {
    if (this.activeSpaceId === spaceId && !preferredTabId) {
      return;
    }
    this.activeSpaceId = spaceId;
    this.updateSpaceVisibility();

    if (preferredTabId) {
      const preferredTab = this.tabs.get(preferredTabId);
      if (preferredTab && preferredTab.spaceId === spaceId) {
        this.activateTab(preferredTabId);
        return;
      }
    }

    const activeTab = this.getActiveTab();
    if (activeTab && activeTab.spaceId === spaceId) {
      this.activateTab(activeTab.id);
      return;
    }

    const lastActive = this.lastActiveTabBySpace.get(spaceId);
    if (lastActive && this.tabs.has(lastActive)) {
      this.activateTab(lastActive);
      return;
    }

    const tabIds = this.getTabIdsForSpace(spaceId);
    if (tabIds.length > 0) {
      this.activateTab(tabIds[tabIds.length - 1]);
      return;
    }

    this.createTab('', spaceId);
  }

  // 現在のスペースIDを取得
  getActiveSpaceId(): string {
    return this.activeSpaceId;
  }

  private getTabIdsForSpace(spaceId: string): string[] {
    return Array.from(this.tabs.values())
      .filter(tab => tab.spaceId === spaceId)
      .map(tab => tab.id);
  }

  private updateSpaceVisibility(): void {
    this.tabsContainerElement
      .querySelectorAll<HTMLElement>('.tab')
      .forEach((tabElement) => {
        const spaceId = tabElement.dataset.spaceId;
        const isActiveSpace = spaceId === this.activeSpaceId;
        tabElement.classList.toggle('other-space', !isActiveSpace);
        const targetList = isActiveSpace
          ? this.tabsListElement
          : this.otherTabsListElement;
        if (tabElement.parentElement !== targetList) {
          targetList.appendChild(tabElement);
        }
      });

    this.updateOtherTabsVisibility();

    this.webviewContainer.querySelectorAll<HTMLElement>('.webview-wrapper').forEach((wrapper) => {
      const spaceId = wrapper.dataset.spaceId;
      wrapper.style.display = spaceId === this.activeSpaceId ? '' : 'none';
    });
  }

  private updateOtherTabsVisibility(): void {
    const hasOtherTabs = this.otherTabsListElement.querySelector('.tab') !== null;
    this.otherTabsSection.classList.toggle('is-visible', hasOtherTabs);
  }

  private requestSpaceSwitch(spaceId: string, tabId: string): void {
    if (this.spaceSwitchListeners.length === 0) {
      this.setActiveSpace(spaceId, tabId);
      return;
    }
    this.spaceSwitchListeners.forEach((listener) => {
      listener(spaceId, tabId);
    });
  }

  private notifyTabChange(tab: Tab | null): void {
    this.tabChangeListeners.forEach((listener) => {
      listener(tab);
    });
  }

  private notifyTabNavigation(tabId: string, url: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    this.tabNavigationListeners.forEach((listener) => {
      listener(tab, url);
    });
  }
}
