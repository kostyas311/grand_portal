const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const log = require('electron-log');

log.initialize();

const isDev = !app.isPackaged;
const ports = {
  api: Number(process.env.NORMBASE_API_PORT || 3001),
  web: Number(process.env.NORMBASE_WEB_PORT || 3000),
};
const origins = {
  api: `http://127.0.0.1:${ports.api}`,
  web: `http://127.0.0.1:${ports.web}`,
};

let mainWindow;
let apiProcess;
let webProcess;
let shuttingDown = false;
let runtimeReady;

loadDesktopEnv();

function getProjectRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function getBundledAppRoot() {
  return path.join(process.resourcesPath, 'app-bundle');
}

function getUserEnvPath() {
  return path.join(app.getPath('userData'), '.env');
}

function getWritableStoragePath() {
  const configuredPath = process.env.STORAGE_PATH;

  if (configuredPath && !configuredPath.startsWith('/app/')) {
    return configuredPath;
  }

  return path.join(app.getPath('userData'), 'storage');
}

function loadDesktopEnv() {
  const envCandidates = isDev
    ? [
        path.join(getProjectRoot(), '.env'),
        path.join(getProjectRoot(), '.env.example'),
      ]
    : [
        getUserEnvPath(),
        path.join(getBundledAppRoot(), '.env'),
        path.join(getBundledAppRoot(), '.env.example'),
      ];

  for (const candidate of envCandidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    dotenv.config({ path: candidate });
    log.info(`Loaded desktop env from ${candidate}`);
    break;
  }
}

function ensureUserEnvFile() {
  if (isDev || fs.existsSync(getUserEnvPath())) {
    return;
  }

  const bundledEnvExample = path.join(getBundledAppRoot(), '.env.example');
  if (!fs.existsSync(bundledEnvExample)) {
    return;
  }

  fs.mkdirSync(path.dirname(getUserEnvPath()), { recursive: true });
  fs.copyFileSync(bundledEnvExample, getUserEnvPath());
}

function resolvePortalUrl() {
  if (process.env.DESKTOP_START_URL) {
    return process.env.DESKTOP_START_URL;
  }

  return origins.web;
}

function isBundledServerAvailable() {
  return fs.existsSync(path.join(getBundledAppRoot(), 'api', 'dist', 'main.js'))
    && fs.existsSync(path.join(getBundledAppRoot(), 'web', 'server.js'));
}

function spawnNodeProcess(entrypoint, cwd, extraEnv, name) {
  const child = spawn(process.execPath, [entrypoint], {
    cwd,
    env: {
      ...process.env,
      ...extraEnv,
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: 'pipe',
    windowsHide: true,
  });

  child.stdout.on('data', (chunk) => {
    log.info(`[${name}] ${chunk.toString().trim()}`);
  });

  child.stderr.on('data', (chunk) => {
    log.error(`[${name}] ${chunk.toString().trim()}`);
  });

  child.on('exit', (code, signal) => {
    log.info(`[${name}] exited with code=${code} signal=${signal}`);
  });

  child.on('error', (error) => {
    log.error(`[${name}] failed to start`, error);
  });

  return child;
}

function waitForUrl(targetUrl, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(targetUrl, (response) => {
        response.resume();

        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }

        retry(new Error(`Unexpected status code ${response.statusCode} for ${targetUrl}`));
      });

      request.on('error', retry);
      request.setTimeout(3000, () => {
        request.destroy(new Error(`Timeout while waiting for ${targetUrl}`));
      });
    };

    const retry = (error) => {
      if (Date.now() >= deadline) {
        reject(error);
        return;
      }

      setTimeout(attempt, 1000);
    };

    attempt();
  });
}

async function startBundledServers() {
  if (!app.isPackaged || !isBundledServerAvailable()) {
    return resolvePortalUrl();
  }

  ensureUserEnvFile();

  const storagePath = getWritableStoragePath();
  fs.mkdirSync(storagePath, { recursive: true });

  const appBundleRoot = getBundledAppRoot();
  const apiRoot = path.join(appBundleRoot, 'api');
  const webRoot = path.join(appBundleRoot, 'web');

  apiProcess = spawnNodeProcess(
    path.join(apiRoot, 'dist', 'main.js'),
    apiRoot,
    {
      NODE_ENV: 'production',
      PORT: String(ports.api),
      API_PORT: String(ports.api),
      STORAGE_PATH: storagePath,
      CORS_ORIGIN: origins.web,
      APP_BASE_URL: origins.web,
      PORTAL_BASE_URL: origins.web,
    },
    'api',
  );

  await waitForUrl(`${origins.api}/api/auth/me`, 90000).catch(async (error) => {
    log.warn('API readiness probe on /api/auth/me failed, retrying with root endpoint', error);
    await waitForUrl(origins.api, 30000);
  });

  webProcess = spawnNodeProcess(
    path.join(webRoot, 'server.js'),
    webRoot,
    {
      NODE_ENV: 'production',
      PORT: String(ports.web),
      HOSTNAME: '127.0.0.1',
      NEXT_PUBLIC_API_URL: origins.api,
    },
    'web',
  );

  await waitForUrl(origins.web, 90000);
  return origins.web;
}

function renderErrorPage(portalUrl, error) {
  const details = String(error && error.message ? error.message : error);

  return `
    <!DOCTYPE html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>Нормбаза недоступна</title>
        <style>
          body {
            margin: 0;
            font-family: "Segoe UI", Arial, sans-serif;
            background: linear-gradient(180deg, #f6f9fe 0%, #edf3fb 100%);
            color: #17324d;
          }
          .shell {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px;
          }
          .card {
            max-width: 760px;
            background: #ffffff;
            border: 1px solid #d7e4f3;
            border-radius: 28px;
            padding: 32px;
            box-shadow: 0 20px 60px rgba(23, 50, 77, 0.08);
          }
          h1 {
            margin: 0 0 12px;
            font-size: 30px;
          }
          p {
            margin: 0 0 12px;
            line-height: 1.6;
            color: #5d7287;
          }
          code {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 8px;
            background: #eef4fb;
            color: #234767;
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="card">
            <h1>Портал сейчас недоступен</h1>
            <p>Desktop-клиент не смог открыть портал по адресу <code>${portalUrl}</code>.</p>
            <p>Проверьте настройки в <code>${getUserEnvPath()}</code> и доступность локальной БД PostgreSQL.</p>
            <p>Техническая деталь: <code>${details}</code>.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function loadPortal(mainBrowserWindow) {
  try {
    const portalUrl = await runtimeReady;
    await mainBrowserWindow.loadURL(portalUrl);
  } catch (error) {
    log.error('Failed to boot desktop runtime', error);
    await mainBrowserWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderErrorPage(resolvePortalUrl(), error))}`);
  }
}

function createMainWindow() {
  const faviconPath = isDev
    ? path.join(getProjectRoot(), 'apps', 'web', 'public', 'favicon.ico')
    : undefined;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: '#f4f7fb',
    title: 'Нормбаза',
    icon: faviconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', async (event, url) => {
    const portalUrl = await runtimeReady.catch(() => resolvePortalUrl());
    const currentOrigin = new URL(portalUrl).origin;
    const nextOrigin = new URL(url).origin;

    if (currentOrigin !== nextOrigin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<html><body style="font-family:Segoe UI,Arial,sans-serif;padding:24px;background:#f6f9fe;color:#17324d">Запуск Нормбазы...</body></html>')}`);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  loadPortal(mainWindow);
  return mainWindow;
}

function buildAppMenu(mainBrowserWindow) {
  const template = [
    {
      label: 'Нормбаза',
      submenu: [
        {
          label: 'Открыть портал в браузере',
          click: async () => shell.openExternal(await runtimeReady.catch(() => resolvePortalUrl())),
        },
        {
          label: 'Перезагрузить',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainBrowserWindow.webContents.reload(),
        },
        {
          label: 'Открыть DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainBrowserWindow.webContents.openDevTools({ mode: 'detach' }),
        },
        { type: 'separator' },
        {
          label: 'Выход',
          role: 'quit',
        },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function stopProcess(child, name) {
  if (!child || child.killed) {
    return;
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch (error) {
        log.error(`Failed to SIGKILL ${name}`, error);
      }
      resolve();
    }, 5000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    try {
      child.kill();
    } catch (error) {
      clearTimeout(timeout);
      log.error(`Failed to stop ${name}`, error);
      resolve();
    }
  });
}

async function shutdownRuntime() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await Promise.all([
    stopProcess(webProcess, 'web'),
    stopProcess(apiProcess, 'api'),
  ]);
}

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const existingWindow = BrowserWindow.getAllWindows()[0];
    if (!existingWindow) {
      return;
    }

    if (existingWindow.isMinimized()) {
      existingWindow.restore();
    }

    existingWindow.focus();
  });

  app.whenReady().then(() => {
    runtimeReady = startBundledServers();
    const browserWindow = createMainWindow();
    buildAppMenu(browserWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const nextWindow = createMainWindow();
        buildAppMenu(nextWindow);
      }
    });
  });
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('render-process-gone', async (_renderEvent, details) => {
    log.error('Renderer process gone', details);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Нормбаза',
      message: 'Окно портала было аварийно закрыто. Приложение можно перезапустить.',
    });
  });
});

app.on('before-quit', async (event) => {
  if (shuttingDown) {
    return;
  }

  event.preventDefault();
  await shutdownRuntime();
  app.exit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
