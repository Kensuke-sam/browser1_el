export interface Space {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
}

const SPACES_KEY = 'zen-spaces';
const ACTIVE_SPACE_KEY = 'zen-active-space';

const DEFAULT_SPACES: Space[] = [
  { id: 'default', name: 'デフォルト', icon: '🏠', createdAt: Date.now() },
  { id: 'work', name: '仕事', icon: '💼', createdAt: Date.now() + 1 },
  { id: 'personal', name: '個人', icon: '👤', createdAt: Date.now() + 2 },
];

export class SpaceManager {
  private spacesContainer: HTMLElement;
  private spacesList: HTMLElement;
  private addSpaceBtn: HTMLButtonElement;
  private modalOverlay: HTMLElement;
  private nameInput: HTMLInputElement;
  private iconInput: HTMLInputElement;
  private createBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private spaces: Space[] = [];
  private activeSpaceId: string = 'default';
  private onSpaceChange: ((spaceId: string, preferredTabId?: string) => void) | null = null;

  constructor() {
    this.spacesContainer = document.querySelector('.spaces-container') as HTMLElement;
    this.spacesList = document.getElementById('spaces-list') as HTMLElement;
    this.addSpaceBtn = document.getElementById('add-space-btn') as HTMLButtonElement;
    this.modalOverlay = document.getElementById('space-modal') as HTMLElement;
    this.nameInput = document.getElementById('space-name-input') as HTMLInputElement;
    this.iconInput = document.getElementById('space-icon-input') as HTMLInputElement;
    this.createBtn = document.getElementById('space-create-btn') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('space-cancel-btn') as HTMLButtonElement;

    this.loadSpaces();
    this.renderSpaces();
    this.setupEventListeners();
  }

  setOnSpaceChange(callback: (spaceId: string, preferredTabId?: string) => void): void {
    this.onSpaceChange = callback;
  }

  getActiveSpaceId(): string {
    return this.activeSpaceId;
  }

  getSpaces(): Space[] {
    return [...this.spaces];
  }

  setSpaces(spaces: Space[], activeSpaceId?: string): void {
    if (!spaces.length) {
      this.spaces = [...DEFAULT_SPACES];
    } else {
      this.spaces = spaces.map(space => ({ ...space }));
    }

    this.activeSpaceId = this.resolveActiveSpace(activeSpaceId ?? this.activeSpaceId);
    this.saveSpaces();
    this.renderSpaces();
    this.notifySpaceChange();
  }

  private setupEventListeners(): void {
    this.spacesContainer.addEventListener('click', (e) => {
      const spaceElement = (e.target as HTMLElement).closest('.space') as HTMLElement | null;
      if (!spaceElement || spaceElement.classList.contains('active')) {
        return;
      }
      const spaceId = spaceElement.dataset.space;
      if (spaceId) {
        this.switchSpace(spaceId);
      }
    });

    this.addSpaceBtn.addEventListener('click', () => {
      this.openModal();
    });

    this.createBtn.addEventListener('click', () => {
      this.handleCreateSpace();
    });

    this.cancelBtn.addEventListener('click', () => {
      this.closeModal();
    });

    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalOverlay.classList.contains('open')) {
        e.preventDefault();
        this.closeModal();
      }
    });

    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleCreateSpace();
      }
    });

    this.iconInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleCreateSpace();
      }
    });
  }

  private handleCreateSpace(): void {
    const name = this.nameInput.value.trim();
    if (!name) {
      this.nameInput.focus();
      return;
    }

    const icon = this.iconInput.value.trim() || name.slice(0, 1) || '✨';
    const id = this.createSpaceId(name);

    const newSpace: Space = {
      id,
      name,
      icon,
      createdAt: Date.now(),
    };

    this.spaces.push(newSpace);
    this.saveSpaces();
    this.renderSpaces();
    this.switchSpace(id);
    this.closeModal();
  }

  private openModal(): void {
    this.modalOverlay.classList.add('open');
    this.modalOverlay.setAttribute('aria-hidden', 'false');
    this.nameInput.value = '';
    this.iconInput.value = '';
    this.nameInput.focus();
  }

  private closeModal(): void {
    this.modalOverlay.classList.remove('open');
    this.modalOverlay.setAttribute('aria-hidden', 'true');
  }

  activateSpace(spaceId: string, preferredTabId?: string): void {
    this.switchSpace(spaceId, preferredTabId);
  }

  private switchSpace(spaceId: string, preferredTabId?: string): void {
    this.activeSpaceId = this.resolveActiveSpace(spaceId);
    this.saveActiveSpace();
    this.renderSpaces();
    this.notifySpaceChange(preferredTabId);
  }

  private notifySpaceChange(preferredTabId?: string): void {
    if (this.onSpaceChange) {
      this.onSpaceChange(this.activeSpaceId, preferredTabId);
    }
  }

  private renderSpaces(): void {
    this.spacesList.innerHTML = '';

    this.spaces.forEach(space => {
      const spaceElement = document.createElement('div');
      spaceElement.className = 'space';
      spaceElement.dataset.space = space.id;
      spaceElement.title = space.name;
      if (space.id === this.activeSpaceId) {
        spaceElement.classList.add('active');
      }

      const icon = document.createElement('span');
      icon.className = 'space-icon';
      icon.textContent = space.icon;
      spaceElement.appendChild(icon);

      this.spacesList.appendChild(spaceElement);
    });
  }

  private loadSpaces(): void {
    const stored = localStorage.getItem(SPACES_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Space[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.spaces = parsed.filter(space => space.id && space.name);
        }
      } catch {}
    }

    if (this.spaces.length === 0) {
      this.spaces = [...DEFAULT_SPACES];
    }

    const storedActive = localStorage.getItem(ACTIVE_SPACE_KEY);
    this.activeSpaceId = this.resolveActiveSpace(storedActive ?? this.activeSpaceId);
    this.saveSpaces();
    this.saveActiveSpace();
  }

  private saveSpaces(): void {
    localStorage.setItem(SPACES_KEY, JSON.stringify(this.spaces));
  }

  private saveActiveSpace(): void {
    localStorage.setItem(ACTIVE_SPACE_KEY, this.activeSpaceId);
  }

  private resolveActiveSpace(spaceId: string): string {
    if (this.spaces.some(space => space.id === spaceId)) {
      return spaceId;
    }
    return this.spaces[0]?.id ?? 'default';
  }

  private createSpaceId(name: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const base = slug || `space-${Date.now()}`;
    let id = base;
    let counter = 1;

    while (this.spaces.some(space => space.id === id)) {
      counter += 1;
      id = `${base}-${counter}`;
    }
    return id;
  }
}
