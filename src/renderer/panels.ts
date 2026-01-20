export type PanelId = 'bookmarks' | 'history' | 'settings';

export class PanelManager {
  private overlay: HTMLElement;
  private panels: Map<PanelId, HTMLElement> = new Map();
  private activePanel: PanelId | null = null;

  constructor() {
    this.overlay = document.getElementById('panel-overlay') as HTMLElement;
    const panelElements = this.overlay.querySelectorAll<HTMLElement>('[data-panel]');
    panelElements.forEach((panel) => {
      const id = panel.dataset.panel as PanelId;
      this.panels.set(id, panel);
    });
    this.setupEventListeners();
  }

  open(panelId: PanelId): void {
    if (!this.panels.has(panelId)) return;
    this.activePanel = panelId;
    this.overlay.classList.add('open');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.panels.forEach((panel, id) => {
      panel.classList.toggle('active', id === panelId);
    });
  }

  close(): void {
    this.activePanel = null;
    this.overlay.classList.remove('open');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.panels.forEach((panel) => {
      panel.classList.remove('active');
    });
  }

  toggle(panelId: PanelId): void {
    if (this.activePanel === panelId && this.overlay.classList.contains('open')) {
      this.close();
      return;
    }
    this.open(panelId);
  }

  getActivePanel(): PanelId | null {
    return this.activePanel;
  }

  private setupEventListeners(): void {
    this.overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === this.overlay) {
        this.close();
      }
    });

    this.overlay.querySelectorAll<HTMLElement>('[data-panel-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.close();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('open')) {
        e.preventDefault();
        this.close();
      }
    });
  }
}
