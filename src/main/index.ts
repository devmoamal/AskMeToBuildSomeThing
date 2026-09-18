import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { initializeDatabase } from './db/client'
import { registerAllIpc } from './ipc'

process.env.DIST_ELECTRON = path.join(import.meta.dirname, '../dist-electron')
process.env.DIST = path.join(import.meta.dirname, '../dist')
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(import.meta.dirname, '../public')
  : process.env.DIST

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'AskMeToBuildSomeThing',
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.center()

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.setAlwaysOnTop(true)
    mainWindow?.focus()
    mainWindow?.setAlwaysOnTop(false)
  })

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main Process] Renderer finished loading successfully.')
    mainWindow?.show()
    mainWindow?.setAlwaysOnTop(true)
    mainWindow?.focus()
    mainWindow?.setAlwaysOnTop(false)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Main Process] Failed to load: ${errorDescription} (${errorCode})`)
  })

  // Open target="_blank" links in default external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  registerAllIpc(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(import.meta.dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  initializeDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
