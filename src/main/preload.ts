import { contextBridge, ipcRenderer } from 'electron';

// サンドボックス環境ではpathモジュールが使用できないため、メインプロセスから渡されたパスを使用
const webviewPreloadPath = process.env.WEBVIEW_PRELOAD_PATH || '';

// レンダラープロセスに公開するAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // ウィンドウ操作
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    enterFullscreen: () => ipcRenderer.invoke('fullscreen:enter'),
    leaveFullscreen: () => ipcRenderer.invoke('fullscreen:leave'),
  },
  navigation: {
    onGesture: (callback: (direction: 'back' | 'forward') => void) => {
      ipcRenderer.on('navigation:gesture', (_event, direction: 'back' | 'forward') => {
        callback(direction);
      });
    },
  },
  paths: {
    webviewPreload: webviewPreloadPath,
  },
  extensions: {
    list: () => ipcRenderer.invoke('extensions:list'),
    add: () => ipcRenderer.invoke('extensions:add'),
    remove: (extensionId: string) => ipcRenderer.invoke('extensions:remove', extensionId),
  },
  sync: {
    exportProfile: (profile: unknown) => ipcRenderer.invoke('sync:export', profile),
    importProfile: () => ipcRenderer.invoke('sync:import'),
  },
  shortcuts: {
    onSidebarToggle: (callback: () => void) => {
      ipcRenderer.on('sidebar:toggle', () => {
        callback();
      });
    },
  },
});

// 型定義のエクスポート
export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    enterFullscreen: () => Promise<void>;
    leaveFullscreen: () => Promise<void>;
  };
  navigation: {
    onGesture: (callback: (direction: 'back' | 'forward') => void) => void;
  };
  paths: {
    webviewPreload: string;
  };
  extensions: {
    list: () => Promise<Array<{ id: string; name: string; version?: string; path?: string }>>;
    add: () => Promise<{ id: string; name: string; version?: string; path?: string } | null>;
    remove: (extensionId: string) => Promise<boolean>;
  };
  sync: {
    exportProfile: (profile: unknown) => Promise<boolean>;
    importProfile: () => Promise<any | null>;
  };
  shortcuts: {
    onSidebarToggle: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

