import { ipcMain, type BrowserWindow } from 'electron'
import { TerminalRunner, type ShellType } from '../terminal/runner'

export function registerTerminalIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('terminal:runCommand', async (_, options: { command: string; cwd?: string; shell?: string }) => {
    return TerminalRunner.run({
      command: options.command,
      cwd: options.cwd,
      shell: (options.shell as ShellType) || 'powershell',
      onOutput: (chunk) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:output', chunk)
        }
      }
    })
  })
}
