export interface ExtensionInfo {
  id: string;
  name: string;
  version?: string;
  path?: string;
}

export class ExtensionsManager {
  private listElement: HTMLElement;
  private emptyElement: HTMLElement;
  private addBtn: HTMLButtonElement;

  constructor() {
    this.listElement = document.getElementById('extensions-list') as HTMLElement;
    this.emptyElement = document.getElementById('extensions-empty') as HTMLElement;
    this.addBtn = document.getElementById('extensions-add-btn') as HTMLButtonElement;

    this.setupEventListeners();
  }

  async refresh(): Promise<void> {
    if (!window.electronAPI?.extensions) {
      this.renderUnsupported();
      return;
    }

    try {
      const extensions = await window.electronAPI.extensions.list();
      this.renderList(extensions || []);
    } catch {
      this.renderUnsupported();
    }
  }

  private setupEventListeners(): void {
    this.addBtn.addEventListener('click', async () => {
      if (!window.electronAPI?.extensions) {
        return;
      }
      await window.electronAPI.extensions.add();
      await this.refresh();
    });

    this.listElement.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const removeBtn = target.closest('[data-extension-remove]') as HTMLElement | null;
      if (!removeBtn) return;

      const extensionId = removeBtn.dataset.extensionRemove;
      if (!extensionId || !window.electronAPI?.extensions) {
        return;
      }
      await window.electronAPI.extensions.remove(extensionId);
      await this.refresh();
    });
  }

  private renderUnsupported(): void {
    this.listElement.innerHTML = '';
    this.emptyElement.textContent = 'この環境では拡張機能を利用できません';
    this.emptyElement.style.display = 'block';
  }

  private renderList(extensions: ExtensionInfo[]): void {
    this.listElement.innerHTML = '';

    if (!extensions.length) {
      this.emptyElement.textContent = '拡張機能がありません';
      this.emptyElement.style.display = 'block';
      return;
    }

    this.emptyElement.style.display = 'none';
    extensions.forEach((extension) => {
      const item = document.createElement('div');
      item.className = 'panel-item extension-item';

      const info = document.createElement('div');
      info.className = 'item-info';

      const name = document.createElement('div');
      name.className = 'item-title';
      name.textContent = extension.name || extension.id;

      const meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.textContent = extension.version
        ? `v${extension.version}`
        : extension.path || '';

      info.appendChild(name);
      info.appendChild(meta);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'item-action danger';
      removeBtn.dataset.extensionRemove = extension.id;
      removeBtn.textContent = '削除';

      item.appendChild(info);
      item.appendChild(removeBtn);

      this.listElement.appendChild(item);
    });
  }
}
