// サイドバー管理クラス
export class SidebarManager {
  private sidebar: HTMLElement;
  private compactToggle: HTMLButtonElement;
  private sidebarToggle: HTMLButtonElement;
  private resizeHandle: HTMLElement | null;
  private isCompact: boolean = false;
  private isHidden: boolean = false;
  private isResizing: boolean = false;

  constructor() {
    this.sidebar = document.getElementById('sidebar')!;
    this.compactToggle = document.getElementById('compact-toggle') as HTMLButtonElement;
    this.sidebarToggle = document.getElementById('sidebar-toggle') as HTMLButtonElement;
    this.resizeHandle = document.getElementById('sidebar-resize-handle');
    
    this.loadState();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // サイドバー収納ボタン
    this.sidebarToggle.addEventListener('click', () => {
      this.toggleHidden();
    });

    // コンパクトモード切り替えボタン
    this.compactToggle.addEventListener('click', () => {
      this.toggleCompactMode();
    });

    // キーボードショートカット (Ctrl/Cmd + B, Ctrl/Cmd + Shift + H)
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }

      if (!e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.toggleCompactMode();
        return;
      }

      if (e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        this.toggleHidden();
      }
    });

    // コンパクトモード時、サイドバー外をクリックで閉じる
    document.addEventListener('click', (e) => {
      if (this.isCompact && !this.sidebar.contains(e.target as Node)) {
        this.sidebar.classList.remove('hover');
      }
    });

    this.setupResizeHandle();

    window.electronAPI?.shortcuts?.onSidebarToggle(() => {
      this.toggleHidden();
    });
  }

  // コンパクトモードを切り替え
  toggleCompactMode(): void {
    this.isCompact = !this.isCompact;
    this.sidebar.classList.toggle('compact', this.isCompact);
    this.updateToggleIcon();
    this.saveState();
  }

  // サイドバーの収納/表示を切り替え
  toggleHidden(): void {
    this.setHidden(!this.isHidden);
  }

  // サイドバーの収納状態を設定
  private setHidden(hidden: boolean): void {
    this.isHidden = hidden;
    this.sidebar.classList.toggle('hidden', this.isHidden);
    this.updateVisibilityToggleIcon();
    this.saveState();
  }

  // トグルアイコンを更新
  private updateToggleIcon(): void {
    this.compactToggle.innerHTML = this.isCompact
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
         </svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M11 19l-7-7 7-7M17 19l-7-7 7-7"/>
         </svg>`;
  }

  // サイドバー収納トグルのアイコンを更新
  private updateVisibilityToggleIcon(): void {
    this.sidebarToggle.innerHTML = this.isHidden
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <rect x="3" y="4" width="18" height="16" rx="2" />
           <line x1="9" y1="4" x2="9" y2="20" />
           <polyline points="10 8 14 12 10 16" />
         </svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <rect x="3" y="4" width="18" height="16" rx="2" />
           <line x1="9" y1="4" x2="9" y2="20" />
           <polyline points="14 8 10 12 14 16" />
         </svg>`;

    const label = this.isHidden ? 'サイドバーを表示' : 'サイドバーを収納';
    this.sidebarToggle.setAttribute('title', label);
    this.sidebarToggle.setAttribute('aria-label', label);
    this.sidebarToggle.setAttribute('aria-pressed', String(!this.isHidden));
  }

  // 状態を保存
  private saveState(): void {
    localStorage.setItem('browser-el-sidebar-compact', String(this.isCompact));
    localStorage.setItem('browser-el-sidebar-hidden', String(this.isHidden));
  }

  // 状態を読み込み
  private loadState(): void {
    this.applyStoredWidth();

    const compact = localStorage.getItem('browser-el-sidebar-compact');
    if (compact === 'true') {
      this.isCompact = true;
      this.sidebar.classList.add('compact');
    }

    const hidden = localStorage.getItem('browser-el-sidebar-hidden');
    if (hidden === 'true') {
      this.isHidden = true;
      this.sidebar.classList.add('hidden');
    }

    this.updateToggleIcon();
    this.updateVisibilityToggleIcon();
  }

  private setupResizeHandle(): void {
    if (!this.resizeHandle) {
      return;
    }

    const resizeHandle = this.resizeHandle;

    resizeHandle.addEventListener('pointerdown', (e) => {
      if (this.isHidden || this.isCompact) {
        return;
      }

      e.preventDefault();
      this.isResizing = true;
      const startX = e.clientX;
      const startWidth = this.sidebar.getBoundingClientRect().width;
      const bounds = this.getSidebarBounds();

      resizeHandle.setPointerCapture(e.pointerId);
      document.body.classList.add('sidebar-resizing');

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!this.isResizing) {
          return;
        }
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.min(
          Math.max(startWidth + delta, bounds.min),
          bounds.max,
        );
        this.setSidebarWidth(nextWidth);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== e.pointerId) {
          return;
        }
        this.isResizing = false;
        resizeHandle.releasePointerCapture(e.pointerId);
        document.body.classList.remove('sidebar-resizing');
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    });
  }

  private getSidebarBounds(): { min: number; max: number } {
    const styles = getComputedStyle(document.documentElement);
    const min = this.parsePixelValue(styles.getPropertyValue('--sidebar-min-width'), 200);
    const max = this.parsePixelValue(styles.getPropertyValue('--sidebar-max-width'), 420);
    return { min, max: Math.max(min, max) };
  }

  private parsePixelValue(value: string, fallback: number): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private applyStoredWidth(): void {
    const storedWidth = localStorage.getItem('browser-el-sidebar-width');
    if (!storedWidth) {
      return;
    }
    const width = Number.parseFloat(storedWidth);
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    const bounds = this.getSidebarBounds();
    const clamped = Math.min(Math.max(width, bounds.min), bounds.max);
    this.setSidebarWidth(clamped, false);
  }

  private setSidebarWidth(width: number, persist: boolean = true): void {
    document.documentElement.style.setProperty('--sidebar-width', `${Math.round(width)}px`);
    if (persist) {
      localStorage.setItem('browser-el-sidebar-width', String(Math.round(width)));
    }
  }

  // サイドバーの表示/非表示を設定
  setVisible(visible: boolean): void {
    this.setHidden(!visible);
  }

  // コンパクトモードの状態を取得
  isCompactMode(): boolean {
    return this.isCompact;
  }
}
