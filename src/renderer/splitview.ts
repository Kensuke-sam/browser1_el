import { TabManager } from './tabs';

// 分割ビュー管理クラス
export class SplitViewManager {
  private tabManager: TabManager;
  private webviewContainer: HTMLElement;
  private splitViewBtn: HTMLButtonElement;
  private isSplitView: boolean = false;
  private splitPanes: string[] = []; // タブIDのリスト
  private resizeHandles: HTMLElement[] = [];
  private refreshScheduled: boolean = false;
  private isResizing: boolean = false;
  private paneObserver: MutationObserver | null = null;

  constructor(tabManager: TabManager) {
    this.tabManager = tabManager;
    this.webviewContainer = document.getElementById('webview-container')!;
    this.splitViewBtn = document.getElementById('split-view-btn') as HTMLButtonElement;
    
    this.setupEventListeners();
    this.setupObservers();
  }

  private setupEventListeners(): void {
    // 分割ビューボタン
    this.splitViewBtn.addEventListener('click', () => {
      this.toggleSplitView();
    });

    // キーボードショートカット (Ctrl/Cmd + Shift + S)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.toggleSplitView();
      }
    });
  }

  private setupObservers(): void {
    this.paneObserver = new MutationObserver(() => {
      if (!this.isSplitView || this.isResizing) {
        return;
      }
      this.scheduleHandleRefresh();
    });

    this.paneObserver.observe(this.webviewContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    window.addEventListener('resize', () => {
      if (!this.isSplitView || this.isResizing) {
        return;
      }
      this.scheduleHandleRefresh();
    });
  }

  // 分割ビューを切り替え
  toggleSplitView(): void {
    this.isSplitView = !this.isSplitView;
    this.webviewContainer.classList.toggle('split-view', this.isSplitView);
    this.splitViewBtn.classList.toggle('active', this.isSplitView);
    
    if (this.isSplitView) {
      this.updateSplitViewIcon();
      
      // アクティブなタブと次のタブを追加
      this.resetSplitView();
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab) {
        this.addPane(activeTab.id);
        
        // 同じスペースの他のタブを探す
        // TODO: TabManagerから取得するメソッドがあると良いが、ここではDOM構造に依存せずに実装
        // TabManagerに公開メソッドを追加するのが本来は望ましい
        // 簡易的に実装：すでにDOMにあるタブ要素から探す、またはTabManagerの実装詳細を知っている前提
      }

      this.scheduleHandleRefresh();
    } else {
      this.resetSplitView();
      this.clearResizeHandles();
      this.resetPaneSizes();
    }
  }

  // 分割ビューアイコンを更新
  private updateSplitViewIcon(): void {
    this.splitViewBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1"/>
        <line x1="8" y1="2" x2="8" y2="14"/>
      </svg>
    `;
  }

  // 分割ビューをリセット
  private resetSplitView(): void {
    this.splitPanes = [];
  }

  // ペインを追加
  addPane(tabId: string): void {
    if (!this.isSplitView) {
      this.toggleSplitView();
    }
    
    if (!this.splitPanes.includes(tabId)) {
      this.splitPanes.push(tabId);
      
      const wrapper = document.getElementById(`webview-wrapper-${tabId}`);
      if (wrapper) {
        wrapper.classList.add('active');
      }
      this.scheduleHandleRefresh();
    }
  }

  // ペインを削除
  removePane(tabId: string): void {
    const index = this.splitPanes.indexOf(tabId);
    if (index > -1) {
      this.splitPanes.splice(index, 1);
      
      const wrapper = document.getElementById(`webview-wrapper-${tabId}`);
      if (wrapper) {
        wrapper.classList.remove('active');
      }
      
      // ペインが1つ以下になったら分割ビューを終了
      if (this.splitPanes.length <= 1) {
        this.toggleSplitView();
      } else {
        this.scheduleHandleRefresh();
      }
    }
  }

  // 分割ビューの状態を取得
  isSplitViewActive(): boolean {
    return this.isSplitView;
  }

  // ペインの数を取得
  getPaneCount(): number {
    return this.splitPanes.length;
  }

  private scheduleHandleRefresh(): void {
    if (this.refreshScheduled || !this.isSplitView || this.isResizing) {
      return;
    }
    this.refreshScheduled = true;
    window.requestAnimationFrame(() => {
      this.refreshScheduled = false;
      this.refreshResizeHandles();
    });
  }

  private refreshResizeHandles(): void {
    this.clearResizeHandles();
    if (!this.isSplitView) {
      return;
    }

    const panes = this.getVisibleWrappers();
    if (panes.length <= 1) {
      return;
    }

    for (let i = 0; i < panes.length - 1; i += 1) {
      const handle = this.createResizeHandle(panes[i], panes[i + 1]);
      this.resizeHandles.push(handle);
    }

    this.positionResizeHandles();
  }

  private clearResizeHandles(): void {
    this.resizeHandles.forEach((handle) => handle.remove());
    this.resizeHandles = [];
  }

  private getVisibleWrappers(): HTMLElement[] {
    return Array.from(
      this.webviewContainer.querySelectorAll<HTMLElement>('.webview-wrapper'),
    ).filter((wrapper) => wrapper.style.display !== 'none');
  }

  private positionResizeHandles(): void {
    if (!this.isSplitView) {
      return;
    }

    const containerRect = this.webviewContainer.getBoundingClientRect();
    this.resizeHandles = this.resizeHandles.filter((handle) => {
      const leftId = handle.dataset.leftId;
      const rightId = handle.dataset.rightId;
      if (!leftId || !rightId) {
        handle.remove();
        return false;
      }

      const left = document.getElementById(leftId) as HTMLElement | null;
      const right = document.getElementById(rightId) as HTMLElement | null;
      if (!left || !right || left.style.display === 'none' || right.style.display === 'none') {
        handle.remove();
        return false;
      }

      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const center = (leftRect.right + rightRect.left) / 2;
      const handleWidth = handle.getBoundingClientRect().width || 4;
      const leftOffset = center - containerRect.left - handleWidth / 2;
      handle.style.left = `${Math.round(leftOffset)}px`;
      return true;
    });
  }

  private createResizeHandle(left: HTMLElement, right: HTMLElement): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'split-resize-handle';
    handle.dataset.leftId = left.id;
    handle.dataset.rightId = right.id;
    handle.addEventListener('pointerdown', (event) => {
      this.handleResizeStart(event, handle);
    });
    this.webviewContainer.appendChild(handle);
    return handle;
  }

  private handleResizeStart(event: PointerEvent, handle: HTMLElement): void {
    if (event.button !== 0 || !this.isSplitView) {
      return;
    }

    const leftId = handle.dataset.leftId;
    const rightId = handle.dataset.rightId;
    if (!leftId || !rightId) {
      return;
    }

    const left = document.getElementById(leftId) as HTMLElement | null;
    const right = document.getElementById(rightId) as HTMLElement | null;
    if (!left || !right) {
      return;
    }

    event.preventDefault();
    this.isResizing = true;
    handle.classList.add('dragging');
    document.body.classList.add('split-resizing');

    const startX = event.clientX;
    const startLeftWidth = left.getBoundingClientRect().width;
    const startRightWidth = right.getBoundingClientRect().width;
    const totalWidth = startLeftWidth + startRightWidth;
    const minWidth = Math.min(this.getSplitPaneMinWidth(), totalWidth / 2);

    handle.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      let nextLeft = startLeftWidth + delta;
      let nextRight = startRightWidth - delta;

      if (nextLeft < minWidth) {
        nextLeft = minWidth;
        nextRight = totalWidth - minWidth;
      }

      if (nextRight < minWidth) {
        nextRight = minWidth;
        nextLeft = totalWidth - minWidth;
      }

      left.style.flex = `0 1 ${Math.round(nextLeft)}px`;
      right.style.flex = `0 1 ${Math.round(nextRight)}px`;
      this.positionResizeHandles();
    };

    const handlePointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== event.pointerId) {
        return;
      }
      this.isResizing = false;
      handle.classList.remove('dragging');
      document.body.classList.remove('split-resizing');
      handle.releasePointerCapture(event.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      this.scheduleHandleRefresh();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  }

  private getSplitPaneMinWidth(): number {
    const styles = getComputedStyle(document.documentElement);
    const rawValue = styles.getPropertyValue('--split-pane-min-width').trim();
    const parsed = Number.parseFloat(rawValue);
    return Number.isFinite(parsed) ? parsed : 220;
  }

  private resetPaneSizes(): void {
    this.webviewContainer
      .querySelectorAll<HTMLElement>('.webview-wrapper')
      .forEach((wrapper) => {
        wrapper.style.flex = '';
        wrapper.style.flexBasis = '';
      });
  }
}
