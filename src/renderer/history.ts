import { PanelManager } from './panels';
import { Tab, TabManager } from './tabs';

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

const HISTORY_KEY = 'zen-history';
const MAX_HISTORY = 500;

export class HistoryManager {
  private tabManager: TabManager;
  private panelManager: PanelManager;
  private history: HistoryEntry[] = [];
  private listElement: HTMLElement;
  private emptyElement: HTMLElement;
  private searchInput: HTMLInputElement;
  private clearBtn: HTMLButtonElement;
  private historyBtn: HTMLButtonElement;
  private searchTerm: string = '';

  constructor(tabManager: TabManager, panelManager: PanelManager) {
    this.tabManager = tabManager;
    this.panelManager = panelManager;
    this.listElement = document.getElementById('history-list') as HTMLElement;
    this.emptyElement = document.getElementById('history-empty') as HTMLElement;
    this.searchInput = document.getElementById('history-search') as HTMLInputElement;
    this.clearBtn = document.getElementById('history-clear-btn') as HTMLButtonElement;
    this.historyBtn = document.getElementById('history-btn') as HTMLButtonElement;

    this.loadHistory();
    this.render();
    this.setupEventListeners();
  }

  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  setHistory(history: HistoryEntry[]): void {
    this.history = history.map(entry => ({ ...entry }));
    this.saveHistory();
    this.render();
  }

  private setupEventListeners(): void {
    this.historyBtn.addEventListener('click', () => {
      this.panelManager.toggle('history');
      this.render();
    });

    this.clearBtn.addEventListener('click', () => {
      this.history = [];
      this.saveHistory();
      this.render();
    });

    this.searchInput.addEventListener('input', () => {
      this.searchTerm = this.searchInput.value.trim().toLowerCase();
      this.render();
    });

    this.listElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest<HTMLElement>('[data-history-id]');
      if (!item) return;

      const entryId = item.dataset.historyId;
      if (!entryId) return;

      if (target.closest('[data-history-remove]')) {
        this.removeEntry(entryId);
        return;
      }

      const entry = this.history.find(historyEntry => historyEntry.id === entryId);
      if (entry) {
        const activeTab = this.tabManager.getActiveTab();
        if (activeTab) {
          this.tabManager.navigateTab(activeTab.id, entry.url);
        } else {
          this.tabManager.createTab(entry.url);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        this.panelManager.toggle('history');
      }
    });

    this.tabManager.addOnTabNavigationListener((tab, url) => {
      this.recordNavigation(tab, url);
    });
  }

  private recordNavigation(tab: Tab, url: string): void {
    if (!url || url === 'about:blank') {
      return;
    }

    const now = Date.now();
    const lastEntry = this.history[0];
    if (lastEntry && lastEntry.url === url && now - lastEntry.visitedAt < 3000) {
      lastEntry.title = tab.title || lastEntry.title;
      lastEntry.visitedAt = now;
      this.saveHistory();
      this.render();
      return;
    }

    const entry: HistoryEntry = {
      id: `history-${now}-${Math.random().toString(36).slice(2, 8)}`,
      title: tab.title || url,
      url,
      visitedAt: now,
    };

    this.history.unshift(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }
    this.saveHistory();
    this.render();
  }

  private removeEntry(entryId: string): void {
    this.history = this.history.filter(entry => entry.id !== entryId);
    this.saveHistory();
    this.render();
  }

  private render(): void {
    const filtered = this.filterHistory();
    this.listElement.innerHTML = '';

    if (filtered.length === 0) {
      this.emptyElement.style.display = 'block';
      return;
    }

    this.emptyElement.style.display = 'none';
    filtered.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'panel-item';
      item.dataset.historyId = entry.id;

      const info = document.createElement('div');
      info.className = 'item-info';

      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = entry.title;

      const url = document.createElement('div');
      url.className = 'item-url';
      url.textContent = this.getDisplayUrl(entry.url);

      const meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.textContent = this.formatTime(entry.visitedAt);

      info.appendChild(title);
      info.appendChild(url);
      info.appendChild(meta);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'item-action danger';
      removeBtn.setAttribute('data-history-remove', 'true');
      removeBtn.textContent = '削除';

      item.appendChild(info);
      item.appendChild(removeBtn);

      this.listElement.appendChild(item);
    });
  }

  private filterHistory(): HistoryEntry[] {
    if (!this.searchTerm) {
      return this.history;
    }
    return this.history.filter((entry) => {
      const haystack = `${entry.title} ${entry.url}`.toLowerCase();
      return haystack.includes(this.searchTerm);
    });
  }

  private loadHistory(): void {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as HistoryEntry[];
      if (Array.isArray(parsed)) {
        this.history = parsed;
      }
    } catch {}
  }

  private saveHistory(): void {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
  }

  private formatTime(timestamp: number): string {
    try {
      return new Intl.DateTimeFormat('ja-JP', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleString();
    }
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
