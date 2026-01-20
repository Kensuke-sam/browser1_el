import { TabManager, Tab } from './tabs';

const EXAM_HOST = 'exam.iniad.org';
const EXAM_PATH = '/exams/2025/COT102/final-trial';

// ナビゲーション管理クラス
export class NavigationManager {
  private tabManager: TabManager;
  private addressInput: HTMLInputElement;
  private backBtn: HTMLButtonElement;
  private forwardBtn: HTMLButtonElement;
  private reloadBtn: HTMLButtonElement;
  private securityIcon: HTMLElement;

  constructor(tabManager: TabManager) {
    this.tabManager = tabManager;
    
    this.addressInput = document.getElementById('address-input') as HTMLInputElement;
    this.backBtn = document.getElementById('back-btn') as HTMLButtonElement;
    this.forwardBtn = document.getElementById('forward-btn') as HTMLButtonElement;
    this.reloadBtn = document.getElementById('reload-btn') as HTMLButtonElement;
    this.securityIcon = document.getElementById('security-icon') as HTMLElement;

    this.setupEventListeners();
    this.setupTabChangeHandler();
  }

  private setupEventListeners(): void {
    // アドレスバーでEnterキー
    this.addressInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = this.addressInput.value.trim();
        if (url) {
          const tab = this.tabManager.getActiveTab();
          if (tab) {
            this.tabManager.navigateTab(tab.id, url);
          }
        }
      }
    });

    // アドレスバーフォーカス時に全選択
    this.addressInput.addEventListener('focus', () => {
      this.addressInput.select();
    });

    // 戻るボタン
    this.backBtn.addEventListener('click', () => {
      this.goBack();
    });

    // 進むボタン
    this.forwardBtn.addEventListener('click', () => {
      this.goForward();
    });

    // リロードボタン
    this.reloadBtn.addEventListener('click', () => {
      this.reload();
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      // Alt + 左矢印: 戻る
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.goBack();
      }
      // Alt + 右矢印: 進む
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.goForward();
      }
      // Ctrl/Cmd + R: リロード
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.reload();
      }
      // Ctrl/Cmd + L: アドレスバーにフォーカス
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        this.addressInput.focus();
      }
    });

    // トラックパッドのジェスチャ（macOS）
    window.electronAPI?.navigation?.onGesture((direction) => {
      if (direction === 'back') {
        this.goBack();
      } else if (direction === 'forward') {
        this.goForward();
      }
    });
  }

  private setupTabChangeHandler(): void {
    this.tabManager.addOnTabChangeListener((tab) => {
      this.updateUI(tab);
    });
  }

  // UIを更新
  private updateUI(tab: Tab | null): void {
    if (!tab) {
      this.addressInput.value = '';
      this.backBtn.disabled = true;
      this.forwardBtn.disabled = true;
      this.updateSecurityIcon('');
      this.updateExamMode('');
      return;
    }

    // アドレスバーを更新
    if (document.activeElement !== this.addressInput) {
      this.addressInput.value = tab.url === 'about:blank' ? '' : tab.url;
    }

    // ナビゲーションボタンの状態を更新
    this.backBtn.disabled = !tab.canGoBack;
    this.forwardBtn.disabled = !tab.canGoForward;

    // セキュリティアイコンを更新
    this.updateSecurityIcon(tab.url);
    this.updateExamMode(tab.url);

    // リロードボタンの状態を更新（ローディング中は停止アイコン）
    if (tab.isLoading) {
      this.reloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="3" x2="13" y2="13"/>
          <line x1="13" y1="3" x2="3" y2="13"/>
        </svg>
      `;
      this.reloadBtn.title = '読み込みを停止 (Esc)';
    } else {
      this.reloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 8a6 6 0 1 1-1.5-4"/>
          <path d="M14 2v4h-4"/>
        </svg>
      `;
      this.reloadBtn.title = '再読み込み (Ctrl+R)';
    }
  }

  // セキュリティアイコンを更新
  private updateSecurityIcon(url: string): void {
    if (!url || url === 'about:blank') {
      this.securityIcon.className = 'security-icon';
      this.securityIcon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
      `;
      return;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') {
        this.securityIcon.className = 'security-icon secure';
        this.securityIcon.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        `;
      } else {
        this.securityIcon.className = 'security-icon insecure';
        this.securityIcon.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
        `;
      }
    } catch {
      this.securityIcon.className = 'security-icon';
    }
  }

  private updateExamMode(url: string): void {
    if (this.isExamUrl(url)) {
      document.documentElement.dataset.examMode = 'true';
    } else {
      delete document.documentElement.dataset.examMode;
    }
  }

  private isExamUrl(url: string): boolean {
    if (!url || url === 'about:blank') {
      return false;
    }
    try {
      const parsed = new URL(url);
      const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
      if (!isHttp || parsed.hostname !== EXAM_HOST) {
        return false;
      }
      const locationString = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return locationString.includes(EXAM_PATH);
    } catch {
      return false;
    }
  }

  // 戻る
  goBack(): void {
    const webview = this.tabManager.getActiveWebview();
    if (webview?.canGoBack()) {
      webview.goBack();
    }
  }

  // 進む
  goForward(): void {
    const webview = this.tabManager.getActiveWebview();
    if (webview?.canGoForward()) {
      webview.goForward();
    }
  }

  // リロード/停止
  reload(): void {
    const webview = this.tabManager.getActiveWebview();
    const tab = this.tabManager.getActiveTab();
    
    if (webview) {
      if (tab?.isLoading) {
        webview.stop();
      } else {
        webview.reload();
      }
    }
  }

  // URLに移動
  navigate(url: string): void {
    const tab = this.tabManager.getActiveTab();
    if (tab) {
      this.tabManager.navigateTab(tab.id, url);
    }
  }
}
