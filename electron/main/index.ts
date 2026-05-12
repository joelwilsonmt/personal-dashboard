import { app, BrowserWindow, shell, dialog } from 'electron'
import path from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { runMigrations } from './db/client'
import { createAppStore } from './store'
import { log } from './logger'
import { registerAccountHandlers } from './ipc/accounts'
import { registerMortgageHandlers } from './ipc/mortgage'
import { registerSiteHandlers } from './ipc/sites'
import { registerDeviceHandlers } from './ipc/devices'
import { initSettingsStore, registerSettingsHandlers } from './ipc/settings'
import { startSiteMonitor, stopAllChecks } from './monitors/site-monitor'
import { startDeviceServer, stopDeviceServer } from './monitors/device-server'

const store = createAppStore()

const resourcesDir = path.join(__dirname, '../../resources')
const iconIcns = path.join(resourcesDir, 'icon.icns')
const iconPng  = path.join(resourcesDir, 'icon.png')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f172a',
    icon: process.platform === 'darwin' ? iconIcns : iconPng,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.dashboard.personal')
  if (process.platform === 'darwin') app.dock.setIcon(iconPng)

  app.on('browser-window-created', (_, win) => {
    optimizer.watchWindowShortcuts(win)
  })

  try {
    runMigrations()
  } catch (err) {
    log.error(err, 'Database migration failed')
    dialog.showErrorBox(
      'Database migration failed',
      `The app could not update the database schema:\n\n${err instanceof Error ? err.message : String(err)}\n\nThe app may not function correctly.`,
    )
  }

  // Register all IPC handlers
  initSettingsStore(store)
  registerAccountHandlers()
  registerMortgageHandlers()
  registerSiteHandlers()
  registerDeviceHandlers()
  registerSettingsHandlers()

  // Start background services
  const port = (store.get('agent_server_port') as number | undefined) ?? 53117
  startDeviceServer(port)
  await startSiteMonitor()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopAllChecks()
  stopDeviceServer()
  if (process.platform !== 'darwin') app.quit()
})
