import { loadSettings, saveSettings } from "./settings";

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
// 閉じたタブの情報を保存する型
interface ClosedTabInfo {
  url: string;
  title: string;
  spaceId: string;
  closedAt: number;
}

// ストレージキー
const TABS_STORAGE_KEY = "zen-tabs";
const CLOSED_TABS_STORAGE_KEY = "zen-closed-tabs";
const ACTIVE_TAB_STORAGE_KEY = "zen-active-tab";

export class TabManager {
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private activeSpaceId: string = "default";
  private lastActiveTabBySpace: Map<string, string> = new Map();
  private closedTabs: ClosedTabInfo[] = [];  // 閉じたタブのスタック
  private readonly MAX_CLOSED_TABS = 20;  // 最大保存数
  private tabsContainerElement: HTMLElement;
  private tabsListElement: HTMLElement;
  private otherTabsListElement: HTMLElement;
  private otherTabsSection: HTMLElement;
  private webviewContainer: HTMLElement;
  private tabChangeListeners: Array<(tab: Tab | null) => void> = [];
  private tabNavigationListeners: Array<(tab: Tab, url: string) => void> = [];
  private spaceSwitchListeners: Array<
    (spaceId: string, tabId: string) => void
  > = [];
  private isYellowModeEnabled: boolean = true;

  constructor() {
    this.tabsContainerElement = document.getElementById("tabs-container")!;
    this.tabsListElement = document.getElementById("tabs-list")!;
    this.otherTabsListElement = document.getElementById("other-tabs-list")!;
    this.otherTabsSection = document.getElementById("other-tabs-section")!;
    this.webviewContainer = document.getElementById("webview-container")!;

    // Load initial yellow mode state
    const settings = loadSettings();
    this.isYellowModeEnabled = settings.yellowMode;

    this.loadFromStorage();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 新規タブボタン
    document.getElementById("new-tab-btn")?.addEventListener("click", () => {
      this.createTab();
    });

    // キーボードショートカット
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key.toLowerCase() === "y") {
          e.preventDefault();
          this.toggleYellowMode();
          return;
        }
        // Cmd+Shift+T で閉じたタブを復元
        if (e.shiftKey && e.key.toLowerCase() === "t") {
          e.preventDefault();
          this.reopenClosedTab();
          return;
        }

        // Cmd+Option+ArrowLeft/Right for tab navigation
        if (e.altKey) {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            this.switchToNextTab(true);
            return;
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            this.switchToNextTab(false);
            return;
          }
        }

        switch (e.key) {
          case "t":
            e.preventDefault();
            this.createTab();
            break;
          case "w":
            e.preventDefault();
            if (this.activeTabId) {
              this.closeTab(this.activeTabId);
            }
            break;
          case "Tab":
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
  createTab(url: string = "", spaceId?: string): Tab {
    const resolvedSpaceId = spaceId ?? this.activeSpaceId;
    const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const tab: Tab = {
      id,
      title: "新しいタブ",
      url: url || "about:blank",
      favicon: "",
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      spaceId: resolvedSpaceId,
    };

    this.tabs.set(id, tab);
    this.renderTab(tab);
    this.createWebview(tab);
    this.activateTab(id);
    this.saveToStorage();

    return tab;
  }

  // タブのHTML要素を作成
  private renderTab(tab: Tab): void {
    const tabElement = document.createElement("div");
    tabElement.className = "tab";
    tabElement.dataset.tabId = tab.id;
    tabElement.dataset.spaceId = tab.spaceId;
    tabElement.draggable = true;
    tabElement.classList.toggle(
      "other-space",
      tab.spaceId !== this.activeSpaceId,
    );

    tabElement.innerHTML = `
      <img class="tab-favicon ${tab.isLoading ? "loading" : ""}" 
           src="${tab.favicon || "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><circle cx=%228%22 cy=%228%22 r=%226%22 fill=%22%236366f1%22/></svg>"}" 
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
    tabElement.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest(".tab-close")) {
        if (tab.spaceId !== this.activeSpaceId) {
          this.requestSpaceSwitch(tab.spaceId, tab.id);
          return;
        }
        this.activateTab(tab.id);
      }
    });

    // 閉じるボタン
    tabElement.querySelector(".tab-close")?.addEventListener("click", (e) => {
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
    element.addEventListener("dragstart", (e) => {
      element.classList.add("dragging");
      e.dataTransfer?.setData("text/plain", tabId);
    });

    element.addEventListener("dragend", () => {
      element.classList.remove("dragging");
    });

    element.addEventListener("dragover", (e) => {
      e.preventDefault();
      element.classList.add("drag-over");
    });

    element.addEventListener("dragleave", () => {
      element.classList.remove("drag-over");
    });

    element.addEventListener("drop", (e) => {
      e.preventDefault();
      element.classList.remove("drag-over");
      const draggedId = e.dataTransfer?.getData("text/plain");
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
    const wrapper = document.createElement("div");
    wrapper.className = "webview-wrapper";
    wrapper.id = `webview-wrapper-${tab.id}`;
    wrapper.dataset.spaceId = tab.spaceId;
    wrapper.style.display = tab.spaceId === this.activeSpaceId ? "" : "none";

    if (tab.url === "about:blank" || !tab.url) {
      // 新規タブページを表示
      wrapper.innerHTML = `
        <div class="new-tab-page">

          <div class="developer-profile">
            <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1kxwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApJZG4AAAA8AAAB0GNwcnQAAAE8AAAAIXd0cHQAAAFQAAAAIHRyY3AAAAFgAAABJGdrc3AAAAOMAAAAJGNoYWQAAAPcAAAALGJUUkMAAAQAAAAADmdUUkMAAAQAAAAADmJVUkMAAAQAAAAADnZjZ3QAAAREAAAAMG1vZGV3AAARSAAAABhkZXNjAAARcAAAAGZndHJjAAASGAAAAB5YWVogAAAAAAAAdE0AAP14AAAFk2luZ2EAAAAAAAQAAABsAAAAzAAAABgAAAAdAAAAB3NmMzIAAAAAAAEMQgAABd7///MmAAAHkwAA/ZD///ui///9owAAA9wAAMBuY3VydgAAAAAAAAABAc0AAGO1cnYAAAAAAAAAAQHNAABjtXJ2AAAAAAAAAAEBzQAAeHRleHQAAAAAQ29weXJpZ2h0IChjKSAxOTk4IEhld2xldHQtUGFja2FyZCBDb21wYW55AABkZXNjAAAAAAAAABJzUkdCIElFQzYxOTY2LTIuMQAAAAAAAAAAAAAAEnNSR0IgSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYWVogAAAAAAAA81EAAQAAAAEWzFhZWiAAAAAAAAAAAAAAAAAAAAAAWFlaIAAAAAAAAG+iAAA49QAAA5ZjdXJ2AAAAAAAABAAAAAAFAAUACQANAA8AFQAZAB0AIQAoAC0AMgA7AEAARQBKAE8AVABZAF4AYwBoAG0AcgB3AHwAgQCGAIsAkACVAJoAnwCkAKkArgCyALcAvADBAMYAywDQANUA2wDgAOUA6wDwAPYA+wEBAQcBDQETARkBHwElASsBMgE4AT4BRQFMAVIBWQFgAWkBbgF1AXwBgwGLAZIBmgGhAakBsQG5AcEByQHRAdkB4QHpAfIB+gIDAgwCFAIdAiYCLwI4AkECSwJUAl0CZwJxAoUChgKQApgCoQKpArQCxQLLAtUC4ALrAvUDAAMLAxYDIQMtAzgDQANLAS0BTwFYAWEBagFrAXABcgF4AYMBigGSAZoBoQGpAbEBuQHBAckB0QHZAeEB6QHyAfcCAwIMAhQCHQImAi8COAJBAksCVAJdAmcCcQJ6AoQCjgKYAqICrAK2AsECywLVAuAC6wL1AwADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAn4ChQKNApECmgKiAq4CswK9AssC1MLWAt0C5wLtAvADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAoWChgKQApgCoQKpArQCxQLLAtUC4ALrAvUDAAMLAxYDIQMtAzgDQANLAS0BTwFYAWEBagFrAXABcgF4AYMBigGSAZoBoQGpAbEBuQHBAckB0QHZAeEB6QHyAfcCAwIMAhQCHQImAi8COAJBAksCVAJdAmcCcQJ6AoQCjgKYAqICrAK2AsECywLVAuAC6wL1AwADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAn4ChQKNApECmgKiAq4CswK9AssC1MLWAt0C5wLtAvADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAoWChgKQApgCoQKpArQCxQLLAtUC4ALrAvUDAAMLAxYDIQMtAzgDQANLAS0BTwFYAWEBagFrAXABcgF4AYMBigGSAZoBoQGpAbEBuQHBAckB0QHZAeEB6QHyAfcCAwIMAhQCHQImAi8COAJBAksCVAJdAmcCcQJ6AoQCjgKYAqICrAK2AsECywLVAuAC6wL1AwADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAn4ChQKNApECmgKiAq4CswK9AssC1MLWAt0C5wLtAvADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAoWChgKQApgCoQKpArQCxQLLAtUC4ALrAvUDAAMLAxYDIQMtAzgDQANLAS0BTwFYAWEBagFrAXABcgF4AYMBigGSAZoBoQGpAbEBuQHBAckB0QHZAeEB6QHyAfcCAwIMAhQCHQImAi8COAJBAksCVAJdAmcCcQJ6AoQCjgKYAqICrAK2AsECywLVAuAC6wL1AwADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAn4ChQKNApECmgKiAq4CswK9AssC1MLWAt0C5wLtAvADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAoWChgKQApgCoQKpArQCxQLLAtUC4ALrAvUDAAMLAxYDIQMtAzgDQANLAS0BTwFYAWEBagFrAXABcgF4AYMBigGSAZoBoQGpAbEBuQHBAckB0QHZAeEB6QHyAfcCAwIMAhQCHQImAi8COAJBAksCVAJdAmcCcQJ6AoQCjgKYAqICrAK2AsECywLVAuAC6wL1AwADCwMWAyEDLQM4A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APAA9kDBAMEAwQDFAIdAiYCLwI4AkECSwJUAl0CZwJxAn4ChQKNApECmgKiAq4CswK9AssC1MLWAt0C5wLtAvAL/2wBDAAYebQ8gLB4sIC4gIiAkMCwoJDAwMDRCNDI4QEhUSEhESExYfHh0WFh0jExQmJycnMjI1NTEsNzo5Mjo8MDIyMv/2wBDAQYICDAwMEA4MEAyJRMlMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAH0AfQDAREAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAAAgMAAQQFBgf/xAA7EAACAgEDAgUA2AcAAgICAwAAAQIRAyExEkEEIlFhcQUTgQYyQpGhscEUI1JigtHwk+EVMwdykvH/xAAZAQEBAQEBAQAAAAAAAAAAAAAAAQIDBAX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" alt="Developer" class="developer-photo" />
          </div>
          <h1>Ben Browser</h1>
          <p class="tagline">Start browsing the web</p>
          <div class="search-box">
            <input type="text" class="search-input" placeholder="検索またはURLを入力" id="newtab-search-${tab.id}">
          </div>
        </div>
      `;

      // 検索入力のイベント
      const searchInput = wrapper.querySelector(
        `#newtab-search-${tab.id}`,
      ) as HTMLInputElement;
      searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && searchInput.value.trim()) {
          this.navigateTab(tab.id, searchInput.value.trim());
        }
      });
    } else {
      // Webviewを作成
      const webview = document.createElement("webview");
      this.applyWebviewPreload(webview);
      webview.setAttribute("src", tab.url);
      webview.setAttribute("allowpopups", "true");
      wrapper.appendChild(webview);
      this.setupWebviewEvents(webview, tab.id);
    }

    this.webviewContainer.appendChild(wrapper);
  }

  // Webviewのイベントをセットアップ
  private setupWebviewEvents(
    webview: Electron.WebviewTag,
    tabId: string,
  ): void {
    webview.addEventListener("did-start-loading", () => {
      this.updateTab(tabId, { isLoading: true });
    });

    webview.addEventListener("did-stop-loading", () => {
      this.updateTab(tabId, { isLoading: false });
    });

    webview.addEventListener("page-title-updated", (e: any) => {
      this.updateTab(tabId, { title: e.title });
    });

    webview.addEventListener("page-favicon-updated", (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        this.updateTab(tabId, { favicon: e.favicons[0] });
      }
    });

    webview.addEventListener("did-navigate", (e: any) => {
      this.updateTab(tabId, {
        url: e.url,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward(),
      });
      this.notifyTabNavigation(tabId, e.url);
      this.saveToStorage();
    });

    webview.addEventListener("did-navigate-in-page", (e: any) => {
      if (e.isMainFrame) {
        this.updateTab(tabId, {
          url: e.url,
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward(),
        });
        this.notifyTabNavigation(tabId, e.url);
      }
    });

    // Handle new window requests (target="_blank")
    webview.addEventListener('new-window', (e: any) => {
      e.preventDefault();
      const targetUrl = typeof e.url === 'string' ? e.url : '';
      if (!this.isSafeNavigationUrl(targetUrl)) {
        return;
      }
      const currentTab = this.tabs.get(tabId);
      if (currentTab) {
        this.createTab(targetUrl, currentTab.spaceId);
      } else {
        this.createTab(targetUrl);
      }
    });

    // Use executeJavaScript for dynamic and aggressive fixing
    const injectionScript = `
      (function() {
        if (window.__ZEN_INJECTION && typeof window.__ZEN_INJECTION.setEnabled === 'function') {
          window.__ZEN_INJECTION.setEnabled(window.__ZEN_YELLOW_ENABLED !== false);
          return;
        }

        console.log('%c[Zen Browser] Nuclear Injection Started (Final Refined Yellow)', 'color: lime; font-size: 20px;');

        const state = { intervalId: null };

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

        function start() {
          if (state.intervalId !== null) {
            return;
          }
          state.intervalId = window.setInterval(applyStyles, 100);
          applyStyles();
        }

        function stop() {
          if (state.intervalId === null) {
            return;
          }
          window.clearInterval(state.intervalId);
          state.intervalId = null;
        }

        window.__ZEN_INJECTION = {
          setEnabled: function(enabled) {
            if (enabled) {
              start();
            } else {
              applyStyles();
              stop();
            }
          },
        };

        // Fullscreen Spoofing (Backup)
        try {
           const getDocEl = () => document.documentElement;
           if (!document.fullscreenElement) {
             Object.defineProperty(document, 'fullscreenElement', { get: getDocEl, configurable: true });
             Object.defineProperty(document, 'webkitFullscreenElement', { get: getDocEl, configurable: true });
             Object.defineProperty(document, 'fullscreen', { get: () => true, configurable: true });
           }
        } catch {}

        window.__ZEN_INJECTION.setEnabled(window.__ZEN_YELLOW_ENABLED !== false);
      })();
    `;

    webview.addEventListener("dom-ready", () => {
      // Set initial state
      webview
        .executeJavaScript(
          `window.__ZEN_YELLOW_ENABLED = ${this.isYellowModeEnabled};`,
        )
        .then(() => {
          webview
            .executeJavaScript(injectionScript)
            .catch((e) => console.error("JS Injection failed", e));
        });
    });

    webview.addEventListener("did-navigate", () => {
      webview
        .executeJavaScript(
          `window.__ZEN_YELLOW_ENABLED = ${this.isYellowModeEnabled};`,
        )
        .then(() => {
          webview.executeJavaScript(injectionScript).catch(() => {});
        });
    });

    // Fullscreen handling
    webview.addEventListener('enter-html-full-screen', () => {
      window.electronAPI?.window?.enterFullscreen?.();
    });

    webview.addEventListener('leave-html-full-screen', () => {
      window.electronAPI?.window?.leaveFullscreen?.();
    });
  }

  // Set Yellow Mode explicitly
  setYellowMode(enabled: boolean): void {
    if (this.isYellowModeEnabled === enabled) return;
    this.isYellowModeEnabled = enabled;
    console.log("[TabManager] Setting Yellow Mode:", this.isYellowModeEnabled);
    this.applyYellowModeToAll();
  }

  // Toggle Yellow Mode
  toggleYellowMode(): void {
    this.isYellowModeEnabled = !this.isYellowModeEnabled;
    console.log("[TabManager] Toggling Yellow Mode:", this.isYellowModeEnabled);
    
    // Update settings to match
    const settings = loadSettings();
    settings.yellowMode = this.isYellowModeEnabled;
    saveSettings(settings);

    // Update UI if settings panel is open (optional, but good practice if feasible. 
    // Here we just save it, and next time settings opens it will be correct)

    this.applyYellowModeToAll();
  }

  private applyYellowModeToAll(): void {
    const webviews = this.webviewContainer.querySelectorAll("webview");
    webviews.forEach((webview: any) => {
      try {
        webview.executeJavaScript(
          `window.__ZEN_YELLOW_ENABLED = ${this.isYellowModeEnabled};
           if (window.__ZEN_INJECTION && typeof window.__ZEN_INJECTION.setEnabled === 'function') {
             window.__ZEN_INJECTION.setEnabled(${this.isYellowModeEnabled});
           }`,
        );
      } catch (e) {
        console.error(e);
      }
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

    const element = this.tabsContainerElement.querySelector(
      `[data-tab-id="${tabId}"]`,
    );
    if (!element) return;

    const favicon = element.querySelector(".tab-favicon") as HTMLImageElement;
    const title = element.querySelector(".tab-title");
    const url = element.querySelector(".tab-url");

    if (favicon) {
      favicon.src =
        tab.favicon ||
        "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><circle cx=%228%22 cy=%228%22 r=%226%22 fill=%22%236366f1%22/></svg>";
      favicon.classList.toggle("loading", tab.isLoading);
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
      prevElement?.classList.remove("active");

      const prevWrapper = document.getElementById(
        `webview-wrapper-${this.activeTabId}`,
      );
      prevWrapper?.classList.remove("active");
    }

    // 新しいタブをアクティブに
    this.activeTabId = tabId;

    const element = this.tabsContainerElement.querySelector(
      `[data-tab-id="${tabId}"]`,
    );
    element?.classList.add("active");

    const wrapper = document.getElementById(`webview-wrapper-${tabId}`);
    wrapper?.classList.add("active");

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

    // 復元用に閉じたタブの情報を保存（about:blank以外）
    if (tab.url && tab.url !== "about:blank") {
      this.closedTabs.push({
        url: tab.url,
        title: tab.title,
        spaceId: tab.spaceId,
        closedAt: Date.now(),
      });
      // 最大数を超えたら古いものを削除
      if (this.closedTabs.length > this.MAX_CLOSED_TABS) {
        this.closedTabs.shift();
      }
    }

    // DOM要素を削除
    const element = this.tabsContainerElement.querySelector(
      `[data-tab-id="${tabId}"]`,
    );
    element?.remove();

    const wrapper = document.getElementById(`webview-wrapper-${tabId}`);
    wrapper?.remove();

    // タブを削除
    this.tabs.delete(tabId);
    this.updateOtherTabsVisibility();
    this.saveToStorage();

    // アクティブタブが閉じられた場合、別のタブをアクティブに
    if (this.activeTabId === tabId) {
      const remainingTabs = this.getTabIdsForSpace(tab.spaceId);
      if (remainingTabs.length > 0) {
        this.activateTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        this.activeTabId = null;
        this.createTab("", tab.spaceId); // スペース内の最後のタブが閉じられたら新規タブを作成
      }
    }
  }

  // 閉じたタブを復元
  reopenClosedTab(): void {
    const closedTab = this.closedTabs.pop();
    if (!closedTab) {
      console.log("[TabManager] No closed tabs to reopen");
      return;
    }

    console.log("[TabManager] Reopening closed tab:", closedTab.url);
    // 元のスペースにタブを作成
    const newTab = this.createTab(closedTab.url, closedTab.spaceId);
    // タイトルを復元（ページ読み込み時に更新される）
    this.updateTab(newTab.id, { title: closedTab.title });
  }

  // 次/前のタブに切り替え
  private switchToNextTab(reverse: boolean): void {
    const tabIds = this.getTabIdsForSpace(this.activeSpaceId);
    if (tabIds.length <= 1) return;

    const currentIndex = this.activeTabId
      ? tabIds.indexOf(this.activeTabId)
      : 0;
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
    let webview = wrapper.querySelector("webview") as Electron.WebviewTag;

    if (!webview) {
      // 新規タブページを削除
      wrapper.innerHTML = "";
      webview = document.createElement("webview") as Electron.WebviewTag;
      this.applyWebviewPreload(webview);
      webview.setAttribute("allowpopups", "true");
      wrapper.appendChild(webview);
      this.setupWebviewEvents(webview, tabId);
    }

    webview.src = normalizedUrl;
    this.updateTab(tabId, { url: normalizedUrl });
    this.saveToStorage();
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
    const storedSettings = localStorage.getItem("browser-el-settings");
    if (!storedSettings) {
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }

    try {
      const settings = JSON.parse(storedSettings) as {
        searchEngine?: string;
        customSearchUrl?: string;
      };
      const query = encodeURIComponent(trimmed);
      switch (settings.searchEngine) {
        case "duckduckgo":
          return `https://duckduckgo.com/?q=${query}`;
        case "bing":
          return `https://www.bing.com/search?q=${query}`;
        case "custom": {
          const template = settings.customSearchUrl?.trim();
          if (template) {
            return template.includes("{query}")
              ? template.replaceAll("{query}", query)
              : `${template}${query}`;
          }
          return `https://www.google.com/search?q=${query}`;
        }
        case "google":
        default:
          return `https://www.google.com/search?q=${query}`;
      }
    } catch {
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }
  }

  private isSafeNavigationUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private applyWebviewPreload(webview: Electron.WebviewTag): void {
    let preloadPath = window.electronAPI?.paths?.webviewPreload;
    console.log("[Tabs] Raw preload path:", preloadPath);

    if (!preloadPath) {
      console.error("[Tabs] No preload path found!");
      return;
    }

    // Ensure file:// protocol
    if (!preloadPath.startsWith("file://")) {
      preloadPath = `file://${preloadPath}`;
    }

    console.log("[Tabs] Setting webview preload:", preloadPath);
    webview.setAttribute("preload", preloadPath);
  }

  // 表示用URLを取得
  private getDisplayUrl(url: string): string {
    if (!url || url === "about:blank") return "";
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
    } catch {
      return url;
    }
  }

  // HTMLエスケープ
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
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
    const wrapper = document.getElementById(
      `webview-wrapper-${this.activeTabId}`,
    );
    return wrapper?.querySelector("webview") as Electron.WebviewTag | null;
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

    this.createTab("", spaceId);
  }

  // 現在のスペースIDを取得
  getActiveSpaceId(): string {
    return this.activeSpaceId;
  }

  getTabIdsForSpace(spaceId: string): string[] {
    return Array.from(this.tabs.values())
      .filter((tab) => tab.spaceId === spaceId)
      .map((tab) => tab.id);
  }

  private updateSpaceVisibility(): void {
    this.tabsContainerElement
      .querySelectorAll<HTMLElement>(".tab")
      .forEach((tabElement) => {
        const spaceId = tabElement.dataset.spaceId;
        const isActiveSpace = spaceId === this.activeSpaceId;
        tabElement.classList.toggle("other-space", !isActiveSpace);
        const targetList = isActiveSpace
          ? this.tabsListElement
          : this.otherTabsListElement;
        if (tabElement.parentElement !== targetList) {
          targetList.appendChild(tabElement);
        }
      });

    this.updateOtherTabsVisibility();

    this.webviewContainer
      .querySelectorAll<HTMLElement>(".webview-wrapper")
      .forEach((wrapper) => {
        const spaceId = wrapper.dataset.spaceId;
        wrapper.style.display = spaceId === this.activeSpaceId ? "" : "none";
      });
  }

  private updateOtherTabsVisibility(): void {
    const hasOtherTabs =
      this.otherTabsListElement.querySelector(".tab") !== null;
    this.otherTabsSection.classList.toggle("is-visible", hasOtherTabs);
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

  // タブ状態をlocalStorageに保存
  private saveToStorage(): void {
    try {
      // タブ情報を保存（about:blank以外）
      const tabsToSave = Array.from(this.tabs.values())
        .filter(tab => tab.url && tab.url !== "about:blank")
        .map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          favicon: tab.favicon,
          spaceId: tab.spaceId,
        }));
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabsToSave));

      // 閉じたタブの履歴を保存
      localStorage.setItem(CLOSED_TABS_STORAGE_KEY, JSON.stringify(this.closedTabs));

      // アクティブタブIDを保存
      if (this.activeTabId) {
        localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, this.activeTabId);
      }
    } catch (e) {
      console.error("[TabManager] Failed to save to storage:", e);
    }
  }

  // localStorageからタブ状態を復元
  private loadFromStorage(): void {
    try {
      // 閉じたタブ履歴を復元
      const closedTabsJson = localStorage.getItem(CLOSED_TABS_STORAGE_KEY);
      if (closedTabsJson) {
        const parsed = JSON.parse(closedTabsJson) as ClosedTabInfo[];
        if (Array.isArray(parsed)) {
          this.closedTabs = parsed;
        }
      }

      // タブを復元
      const tabsJson = localStorage.getItem(TABS_STORAGE_KEY);
      const savedActiveTabId = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);

      if (tabsJson) {
        const savedTabs = JSON.parse(tabsJson) as Array<{
          id: string;
          url: string;
          title: string;
          favicon: string;
          spaceId: string;
        }>;

        if (Array.isArray(savedTabs) && savedTabs.length > 0) {
          console.log("[TabManager] Restoring", savedTabs.length, "tabs from storage");

          // タブを復元（アクティブ化は後で）
          for (const savedTab of savedTabs) {
            const tab: Tab = {
              id: savedTab.id,
              title: savedTab.title || "復元されたタブ",
              url: savedTab.url,
              favicon: savedTab.favicon || "",
              isLoading: false,
              canGoBack: false,
              canGoForward: false,
              spaceId: savedTab.spaceId || "default",
            };

            this.tabs.set(tab.id, tab);
            this.renderTab(tab);
            this.createWebview(tab);
          }

          // アクティブタブを復元
          if (savedActiveTabId && this.tabs.has(savedActiveTabId)) {
            this.activateTab(savedActiveTabId);
          } else {
            // 最後のタブをアクティブに
            const lastTabId = savedTabs[savedTabs.length - 1].id;
            this.activateTab(lastTabId);
          }
        }
      }
    } catch (e) {
      console.error("[TabManager] Failed to load from storage:", e);
    }
  }
}
