import { PanelManager } from './panels';
import { Tab, TabManager } from './tabs';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: number;
}

const BOOKMARKS_KEY = 'browser-el-bookmarks';

export class BookmarkManager {
  private tabManager: TabManager;
  private panelManager: PanelManager;
  private bookmarks: Bookmark[] = [];
  private listElement: HTMLElement;
  private emptyElement: HTMLElement;
  private searchInput: HTMLInputElement;
  private toggleCurrentBtn: HTMLButtonElement;
  private bookmarkBtn: HTMLButtonElement;
  private searchTerm: string = '';

  constructor(tabManager: TabManager, panelManager: PanelManager) {
    this.tabManager = tabManager;
    this.panelManager = panelManager;
    this.listElement = document.getElementById('bookmarks-list') as HTMLElement;
    this.emptyElement = document.getElementById('bookmarks-empty') as HTMLElement;
    this.searchInput = document.getElementById('bookmarks-search') as HTMLInputElement;
    this.toggleCurrentBtn = document.getElementById('bookmark-current-btn') as HTMLButtonElement;
    this.bookmarkBtn = document.getElementById('bookmark-btn') as HTMLButtonElement;

    this.loadBookmarks();
    this.render();
    this.setupEventListeners();
    this.refreshCurrentTabState(this.tabManager.getActiveTab());
  }

  getBookmarks(): Bookmark[] {
    return [...this.bookmarks];
  }

  setBookmarks(bookmarks: Bookmark[]): void {
    this.bookmarks = bookmarks.map(bookmark => ({ ...bookmark }));
    this.saveBookmarks();
    this.render();
    this.refreshCurrentTabState(this.tabManager.getActiveTab());
  }

  private setupEventListeners(): void {
    this.bookmarkBtn.addEventListener('click', () => {
      this.panelManager.toggle('bookmarks');
      this.render();
    });

    this.toggleCurrentBtn.addEventListener('click', () => {
      this.toggleBookmarkForTab(this.tabManager.getActiveTab());
    });

    this.searchInput.addEventListener('input', () => {
      this.searchTerm = this.searchInput.value.trim().toLowerCase();
      this.render();
    });

    this.listElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest<HTMLElement>('[data-bookmark-id]');
      if (!item) return;

      const bookmarkId = item.dataset.bookmarkId;
      if (!bookmarkId) return;

      if (target.closest('[data-bookmark-remove]')) {
        this.removeBookmark(bookmarkId);
        return;
      }

      const bookmark = this.bookmarks.find(entry => entry.id === bookmarkId);
      if (bookmark) {
        const activeTab = this.tabManager.getActiveTab();
        if (activeTab) {
          this.tabManager.navigateTab(activeTab.id, bookmark.url);
        } else {
          this.tabManager.createTab(bookmark.url);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.toggleBookmarkForTab(this.tabManager.getActiveTab());
      }
    });

    this.tabManager.addOnTabChangeListener((tab) => {
      this.refreshCurrentTabState(tab);
    });
  }

  private toggleBookmarkForTab(tab: Tab | null): void {
    if (!tab || !tab.url || tab.url === 'about:blank') {
      return;
    }

    const existing = this.bookmarks.find(bookmark => bookmark.url === tab.url);
    if (existing) {
      this.removeBookmark(existing.id);
    } else {
      this.addBookmark(tab);
    }
  }

  private addBookmark(tab: Tab): void {
    const bookmark: Bookmark = {
      id: `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: tab.title || tab.url,
      url: tab.url,
      createdAt: Date.now(),
    };

    this.bookmarks.unshift(bookmark);
    this.saveBookmarks();
    this.render();
    this.refreshCurrentTabState(tab);
  }

  private removeBookmark(bookmarkId: string): void {
    this.bookmarks = this.bookmarks.filter(entry => entry.id !== bookmarkId);
    this.saveBookmarks();
    this.render();
    this.refreshCurrentTabState(this.tabManager.getActiveTab());
  }

  private refreshCurrentTabState(tab: Tab | null): void {
    const isBookmarked = tab?.url ? this.bookmarks.some(entry => entry.url === tab.url) : false;
    this.bookmarkBtn.classList.toggle('active', isBookmarked);
    if (this.toggleCurrentBtn) {
      this.toggleCurrentBtn.textContent = isBookmarked ? 'ブックマーク解除' : 'このページを追加';
    }
  }

  private render(): void {
    const filtered = this.filterBookmarks();
    this.listElement.innerHTML = '';

    if (filtered.length === 0) {
      this.emptyElement.style.display = 'block';
      return;
    }

    this.emptyElement.style.display = 'none';
    filtered.forEach((bookmark) => {
      const item = document.createElement('div');
      item.className = 'panel-item';
      item.dataset.bookmarkId = bookmark.id;

      const info = document.createElement('div');
      info.className = 'item-info';

      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = bookmark.title;

      const url = document.createElement('div');
      url.className = 'item-url';
      url.textContent = this.getDisplayUrl(bookmark.url);

      info.appendChild(title);
      info.appendChild(url);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'item-action danger';
      removeBtn.setAttribute('data-bookmark-remove', 'true');
      removeBtn.textContent = '削除';

      item.appendChild(info);
      item.appendChild(removeBtn);

      this.listElement.appendChild(item);
    });
  }

  private filterBookmarks(): Bookmark[] {
    if (!this.searchTerm) {
      return this.bookmarks;
    }
    return this.bookmarks.filter((bookmark) => {
      const haystack = `${bookmark.title} ${bookmark.url}`.toLowerCase();
      return haystack.includes(this.searchTerm);
    });
  }

  private loadBookmarks(): void {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Bookmark[];
      if (Array.isArray(parsed)) {
        this.bookmarks = parsed;
      }
    } catch {}
  }

  private saveBookmarks(): void {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(this.bookmarks));
  }

  private getDisplayUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    } catch {
      return url;
    }
  }
}
