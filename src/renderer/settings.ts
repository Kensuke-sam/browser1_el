import { BookmarkManager } from "./bookmarks";
import { ExtensionsManager } from "./extensions";
import { HistoryManager } from "./history";
import { PanelManager } from "./panels";
import { Space, SpaceManager } from "./spaces";

export type SearchEngine = "google" | "duckduckgo" | "bing" | "custom";
export type Theme = "liquid" | "classic";
export type LiquidVariant =
  | "nature"
  | "ocean"
  | "sunset"
  | "frost"
  | "midnight";

export interface Settings {
  searchEngine: SearchEngine;
  customSearchUrl: string;
  theme: Theme;
  liquidVariant: LiquidVariant;
  lastSyncAt?: string;
}

export interface SyncProfile {
  version: number;
  exportedAt: string;
  data: {
    bookmarks: ReturnType<BookmarkManager["getBookmarks"]>;
    history: ReturnType<HistoryManager["getHistory"]>;
    spaces: Space[];
    activeSpaceId: string;
    settings: Settings;
  };
}

const SETTINGS_KEY = "zen-settings";
const DEFAULT_SETTINGS: Settings = {
  searchEngine: "google",
  customSearchUrl: "",
  theme: "liquid",
  liquidVariant: "nature",
};

export const loadSettings = (): Settings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const parsed = JSON.parse(stored) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (settings: Settings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export class SettingsPanel {
  private panelManager: PanelManager;
  private bookmarkManager: BookmarkManager;
  private historyManager: HistoryManager;
  private spaceManager: SpaceManager;
  private extensionsManager: ExtensionsManager;
  private settings: Settings;
  private settingsBtn: HTMLButtonElement;
  private searchEngineSelect: HTMLSelectElement;
  private themeSelect: HTMLSelectElement;
  private variantSelect: HTMLSelectElement;
  private customSearchRow: HTMLElement;
  private variantRow: HTMLElement;
  private customSearchInput: HTMLInputElement;
  private syncExportBtn: HTMLButtonElement;
  private syncImportBtn: HTMLButtonElement;
  private syncStatus: HTMLElement;

  constructor(
    panelManager: PanelManager,
    bookmarkManager: BookmarkManager,
    historyManager: HistoryManager,
    spaceManager: SpaceManager,
    extensionsManager: ExtensionsManager,
  ) {
    this.panelManager = panelManager;
    this.bookmarkManager = bookmarkManager;
    this.historyManager = historyManager;
    this.spaceManager = spaceManager;
    this.extensionsManager = extensionsManager;
    this.settingsBtn = document.getElementById(
      "settings-btn",
    ) as HTMLButtonElement;
    this.searchEngineSelect = document.getElementById(
      "settings-search-engine",
    ) as HTMLSelectElement;
    this.themeSelect = document.getElementById(
      "settings-theme",
    ) as HTMLSelectElement;
    this.variantSelect = document.getElementById(
      "settings-variant",
    ) as HTMLSelectElement;
    this.customSearchRow = document.getElementById(
      "settings-custom-row",
    ) as HTMLElement;
    this.variantRow = document.getElementById(
      "settings-variant-row",
    ) as HTMLElement;
    this.customSearchInput = document.getElementById(
      "settings-custom-search",
    ) as HTMLInputElement;
    this.syncExportBtn = document.getElementById(
      "sync-export-btn",
    ) as HTMLButtonElement;
    this.syncImportBtn = document.getElementById(
      "sync-import-btn",
    ) as HTMLButtonElement;
    this.syncStatus = document.getElementById("sync-status") as HTMLElement;

    this.settings = loadSettings();
    this.applySettingsToUI();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.settingsBtn.addEventListener("click", async () => {
      this.panelManager.toggle("settings");
      await this.extensionsManager.refresh();
    });

    document.addEventListener("keydown", async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        this.panelManager.toggle("settings");
        await this.extensionsManager.refresh();
      }
    });

    this.searchEngineSelect.addEventListener("change", () => {
      this.settings.searchEngine = this.searchEngineSelect
        .value as SearchEngine;
      this.saveAndApplySettings();
    });

    this.customSearchInput.addEventListener("input", () => {
      this.settings.customSearchUrl = this.customSearchInput.value.trim();
      this.saveAndApplySettings();
    });

    this.themeSelect.addEventListener("change", () => {
      this.settings.theme = this.themeSelect.value as Theme;
      this.saveAndApplySettings();
    });

    this.variantSelect.addEventListener("change", () => {
      this.settings.liquidVariant = this.variantSelect.value as LiquidVariant;
      this.saveAndApplySettings();
    });

    this.syncExportBtn.addEventListener("click", async () => {
      await this.exportProfile();
    });

    this.syncImportBtn.addEventListener("click", async () => {
      await this.importProfile();
    });
  }

  private saveAndApplySettings(): void {
    saveSettings(this.settings);
    this.applySettingsToUI();
  }

  private applySettingsToUI(): void {
    this.searchEngineSelect.value = this.settings.searchEngine;
    this.themeSelect.value = this.settings.theme;
    this.variantSelect.value = this.settings.liquidVariant;

    this.customSearchInput.value = this.settings.customSearchUrl || "";
    this.customSearchRow.style.display =
      this.settings.searchEngine === "custom" ? "flex" : "none";

    // Show/Hide variant selector based on theme
    this.variantRow.style.display =
      this.settings.theme === "liquid" ? "flex" : "none";

    this.applyTheme();
    const status = this.settings.lastSyncAt
      ? `最終同期: ${this.settings.lastSyncAt}`
      : "最終同期: -";
    this.syncStatus.textContent = status;
  }

  private applyTheme(): void {
    const theme = this.settings.theme === "classic" ? "classic" : "liquid";
    document.documentElement.dataset.theme = theme;
    if (theme === "liquid") {
      document.documentElement.dataset.variant = this.settings.liquidVariant;
    } else {
      delete document.documentElement.dataset.variant;
    }
  }

  private async exportProfile(): Promise<void> {
    if (!window.electronAPI?.sync) {
      this.syncStatus.textContent = "同期機能が利用できません";
      return;
    }

    const profile: SyncProfile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        bookmarks: this.bookmarkManager.getBookmarks(),
        history: this.historyManager.getHistory(),
        spaces: this.spaceManager.getSpaces(),
        activeSpaceId: this.spaceManager.getActiveSpaceId(),
        settings: this.settings,
      },
    };

    const result = await window.electronAPI.sync.exportProfile(profile);
    if (result) {
      this.settings.lastSyncAt = new Date().toLocaleString();
      this.saveAndApplySettings();
    }
  }

  private async importProfile(): Promise<void> {
    if (!window.electronAPI?.sync) {
      this.syncStatus.textContent = "同期機能が利用できません";
      return;
    }

    const profile = await window.electronAPI.sync.importProfile();
    if (!profile || !profile.data) {
      return;
    }

    if (profile.data.bookmarks) {
      this.bookmarkManager.setBookmarks(profile.data.bookmarks);
    }
    if (profile.data.history) {
      this.historyManager.setHistory(profile.data.history);
    }
    if (profile.data.spaces) {
      this.spaceManager.setSpaces(
        profile.data.spaces,
        profile.data.activeSpaceId,
      );
    }
    if (profile.data.settings) {
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...profile.data.settings,
      };
      saveSettings(this.settings);
    }

    this.settings.lastSyncAt = new Date().toLocaleString();
    this.saveAndApplySettings();
  }
}
