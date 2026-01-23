import { app, BrowserWindow, dialog, globalShortcut, ipcMain, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// メインウィンドウの参照を保持
let mainWindow: BrowserWindow | null = null;

const SIDEBAR_TOGGLE_ACCELERATOR = 'CommandOrControl+Shift+H';
const EXAM_HOST = 'exam.iniad.org';

type StoredExtension = {
  id: string;
  name: string;
  path: string;
  version?: string;
};

const getExtensionsStorePath = (): string => {
  return path.join(app.getPath('userData'), 'extensions.json');
};

const readExtensionsStore = async (): Promise<StoredExtension[]> => {
  try {
    const raw = await fs.promises.readFile(getExtensionsStorePath(), 'utf8');
    const parsed = JSON.parse(raw) as StoredExtension[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeExtensionsStore = async (extensions: StoredExtension[]): Promise<void> => {
  await fs.promises.writeFile(
    getExtensionsStorePath(),
    JSON.stringify(extensions, null, 2),
    'utf8',
  );
};

const sendSidebarToggle = (): void => {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }
  targetWindow.webContents.send('sidebar:toggle');
};

const registerSidebarShortcut = (): void => {
  if (globalShortcut.isRegistered(SIDEBAR_TOGGLE_ACCELERATOR)) {
    return;
  }
  const registered = globalShortcut.register(SIDEBAR_TOGGLE_ACCELERATOR, sendSidebarToggle);
  if (!registered) {
    console.warn(`[Shortcuts] Failed to register ${SIDEBAR_TOGGLE_ACCELERATOR}`);
  }
};

const unregisterSidebarShortcut = (): void => {
  if (globalShortcut.isRegistered(SIDEBAR_TOGGLE_ACCELERATOR)) {
    globalShortcut.unregister(SIDEBAR_TOGGLE_ACCELERATOR);
  }
};

const loadStoredExtensions = async (): Promise<void> => {
  const stored = await readExtensionsStore();
  if (!stored.length) return;

  const loaded: StoredExtension[] = [];
  for (const entry of stored) {
    try {
      const extension = await session.defaultSession.loadExtension(entry.path, {
        allowFileAccess: true,
      });
      loaded.push({
        id: extension.id,
        name: extension.name,
        version: extension.version,
        path: entry.path,
      });
    } catch (error) {
      console.error('[Extensions] Failed to load', entry.path, error);
    }
  }

  if (loaded.length !== stored.length) {
    await writeExtensionsStore(loaded);
  }
};

const shouldRelaxCsp = (urlString: string): boolean => {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.toLowerCase() === EXAM_HOST;
  } catch {
    return false;
  }
};

const stripHeader = (headers: Record<string, string[]>, headerName: string): void => {
  const target = headerName.toLowerCase();
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === target) {
      delete headers[key];
    }
  });
};

// サンドボックス内のプリロードスクリプト向けにパスを設定
const webviewPreloadPath = path.join(__dirname, '../renderer/webview-preload.js');
process.env.WEBVIEW_PRELOAD_PATH = webviewPreloadPath;

function createWindow(): void {
  // メインウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false, // カスタムタイトルバーのためフレームを非表示
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // webviewタグを有効化
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // CSPを除去してスクリプト注入を許可する
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders;
    if (
      responseHeaders &&
      shouldRelaxCsp(details.url) &&
      (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame')
    ) {
      stripHeader(responseHeaders, 'content-security-policy');
      stripHeader(responseHeaders, 'content-security-policy-report-only');
      stripHeader(responseHeaders, 'x-frame-options');
    }
    callback({ responseHeaders });
  });

  // index.htmlをロード
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 開発時はDevToolsを開く
  mainWindow.webContents.openDevTools();

  // macOSのトラックパッドジェスチャで戻る/進む
  mainWindow.on('swipe', (_event, direction) => {
    if (!mainWindow) return;
    if (direction === 'right') {
      mainWindow.webContents.send('navigation:gesture', 'back');
    } else if (direction === 'left') {
      mainWindow.webContents.send('navigation:gesture', 'forward');
    }
  });

  // ウィンドウが閉じられたときの処理
  mainWindow.on('closed', () => {
    unregisterSidebarShortcut();
    mainWindow = null;
  });

  mainWindow.on('focus', () => {
    registerSidebarShortcut();
  });

  mainWindow.on('blur', () => {
    unregisterSidebarShortcut();
  });

  registerSidebarShortcut();
}

// Electronの初期化完了時にウィンドウを作成
app.whenReady().then(async () => {
  await loadStoredExtensions();
  createWindow();

  // macOSでドックアイコンクリック時の処理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 全ウィンドウが閉じられたときの処理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC ハンドラー: ウィンドウ操作
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// Fullscreen state management
let previousBounds: Electron.Rectangle | null = null;
let wasMaximized = false;

ipcMain.handle('fullscreen:enter', () => {
  if (!mainWindow) return;

  // Save state before entering fullscreen
  wasMaximized = mainWindow.isMaximized();
  if (!wasMaximized) {
    previousBounds = mainWindow.getBounds();
  }

  mainWindow.setSimpleFullScreen(true);
});

ipcMain.handle('fullscreen:leave', () => {
  if (!mainWindow) return;

  mainWindow.setSimpleFullScreen(false);

  // Restore state
  if (wasMaximized) {
    mainWindow.maximize();
  } else if (previousBounds) {
    mainWindow.setBounds(previousBounds);
  }
});

ipcMain.handle('extensions:list', async () => {
  const stored = await readExtensionsStore();
  const loaded = session.defaultSession.getAllExtensions();
  const loadedMap = new Map(
    Object.values(loaded).map((ext) => [ext.id, ext]),
  );

  return stored.map((entry) => {
    const match = loadedMap.get(entry.id);
    return {
      id: entry.id,
      name: match?.name ?? entry.name,
      version: match?.version ?? entry.version,
      path: entry.path,
    };
  });
});

ipcMain.handle('extensions:add', async () => {
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, {
        title: '拡張機能を追加',
        properties: ['openDirectory'],
      })
    : await dialog.showOpenDialog({
        title: '拡張機能を追加',
        properties: ['openDirectory'],
      });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const extensionPath = result.filePaths[0];
  try {
    const extension = await session.defaultSession.loadExtension(extensionPath, {
      allowFileAccess: true,
    });

    const stored = await readExtensionsStore();
    const updated = stored.filter(
      (entry) => entry.id !== extension.id && entry.path !== extensionPath,
    );
    const record: StoredExtension = {
      id: extension.id,
      name: extension.name,
      version: extension.version,
      path: extensionPath,
    };
    updated.push(record);
    await writeExtensionsStore(updated);

    return record;
  } catch (error) {
    console.error('[Extensions] Failed to add', extensionPath, error);
    return null;
  }
});

ipcMain.handle('extensions:remove', async (_event, extensionId: string) => {
  try {
    await session.defaultSession.removeExtension(extensionId);
  } catch (error) {
    console.error('[Extensions] Failed to remove', extensionId, error);
  }

  const stored = await readExtensionsStore();
  const updated = stored.filter((entry) => entry.id !== extensionId);
  await writeExtensionsStore(updated);
  return true;
});

ipcMain.handle('sync:export', async (_event, profile: unknown) => {
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, {
        title: '同期データを保存',
        defaultPath: 'browser-el-profile.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
    : await dialog.showSaveDialog({
        title: '同期データを保存',
        defaultPath: 'browser-el-profile.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

  if (result.canceled || !result.filePath) {
    return false;
  }

  try {
    await fs.promises.writeFile(
      result.filePath,
      JSON.stringify(profile, null, 2),
      'utf8',
    );
    return true;
  } catch (error) {
    console.error('[Sync] Failed to export profile', error);
    return false;
  }
});

ipcMain.handle('sync:import', async () => {
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, {
        title: '同期データを読み込み',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
    : await dialog.showOpenDialog({
        title: '同期データを読み込み',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  try {
    const raw = await fs.promises.readFile(result.filePaths[0], 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('[Sync] Failed to import profile', error);
    return null;
  }
});
