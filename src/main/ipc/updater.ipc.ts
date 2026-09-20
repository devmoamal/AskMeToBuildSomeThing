import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import type { UpdateCheckResult, UpdateInfo, UpdateProgress } from '../../shared/types'
import { isNewerVersion } from '../../shared/semver'

const GITHUB_REPO = 'devmoamal/AskMeToBuildSomeThing'
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

function findMatchingAsset(assets: any[]): any | null {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'win32') {
    return assets.find((a: any) => a.name.endsWith('.exe')) || null
  }

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return (
        assets.find((a: any) => a.name.includes('arm64') && a.name.endsWith('.dmg')) ||
        assets.find((a: any) => a.name.endsWith('.dmg')) ||
        null
      )
    }
    return (
      assets.find((a: any) => (a.name.includes('x64') || a.name.includes('x86_64')) && a.name.endsWith('.dmg')) ||
      assets.find((a: any) => a.name.endsWith('.dmg')) ||
      null
    )
  }

  if (platform === 'linux') {
    return (
      assets.find((a: any) => a.name.endsWith('.AppImage')) ||
      assets.find((a: any) => a.name.endsWith('.deb')) ||
      null
    )
  }

  return null
}

export async function fetchLatestRelease(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()

  try {
    const res = await fetch(RELEASES_API, {
      headers: {
        'User-Agent': 'AskMeToBuildSomeThing-Desktop-App',
        Accept: 'application/vnd.github.v3+json'
      }
    })

    if (!res.ok) {
      if (res.status === 404) {
        return { available: false, currentVersion, error: 'No releases found on GitHub' }
      }
      return { available: false, currentVersion, error: `GitHub API error: ${res.statusText} (${res.status})` }
    }

    const release = (await res.json()) as any
    const remoteTag = release.tag_name || ''
    const available = isNewerVersion(remoteTag, currentVersion)

    const matchingAsset = findMatchingAsset(release.assets || [])

    const updateInfo: UpdateInfo = {
      version: remoteTag.replace(/^v/, ''),
      releaseName: release.name || remoteTag,
      releaseNotes: release.body || 'No release notes provided.',
      publishedAt: release.published_at || '',
      downloadUrl: matchingAsset?.browser_download_url || release.html_url || '',
      assetName: matchingAsset?.name || `AskMeToBuildSomeThing-${remoteTag}-${process.platform}.${process.platform === 'win32' ? 'exe' : 'dmg'}`,
      assetSize: matchingAsset?.size || 0,
      htmlUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases`
    }

    return {
      available,
      currentVersion,
      updateInfo
    }
  } catch (err: any) {
    return {
      available: false,
      currentVersion,
      error: err.message || 'Failed to connect to GitHub releases'
    }
  }
}

export function registerUpdaterIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('updater:checkForUpdates', async (): Promise<UpdateCheckResult> => {
    return await fetchLatestRelease()
  })

  ipcMain.handle('updater:openReleasePage', async (_, url: string) => {
    if (url) {
      await shell.openExternal(url)
    }
  })

  ipcMain.handle(
    'updater:downloadUpdate',
    async (
      _,
      { downloadUrl, assetName }: { downloadUrl: string; assetName: string }
    ): Promise<{ success: boolean; filePath?: string; error?: string }> => {
      try {
        const tempDir = app.getPath('temp')
        const targetPath = path.join(tempDir, assetName || 'update-package')

        // Fetch streaming file
        const res = await fetch(downloadUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'AskMeToBuildSomeThing-Desktop-App'
          }
        })

        if (!res.ok) {
          throw new Error(`Failed to download update: ${res.statusText} (${res.status})`)
        }

        const contentLength = Number(res.headers.get('content-length') || 0)
        let transferred = 0
        let lastReportTime = Date.now()
        let bytesSinceLastReport = 0

        const fileStream = fs.createWriteStream(targetPath)
        const reader = res.body?.getReader()

        if (!reader) {
          throw new Error('Response body stream is not readable')
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (value) {
            fileStream.write(Buffer.from(value))
            transferred += value.length
            bytesSinceLastReport += value.length

            const now = Date.now()
            const timeDiff = (now - lastReportTime) / 1000

            if (timeDiff >= 0.15 || transferred === contentLength) {
              const bytesPerSecond = timeDiff > 0 ? Math.round(bytesSinceLastReport / timeDiff) : 0
              const percent = contentLength > 0 ? Math.min(100, Math.round((transferred / contentLength) * 100)) : 0

              const progress: UpdateProgress = {
                percent,
                bytesPerSecond,
                transferred,
                total: contentLength
              }

              mainWindow.webContents.send('updater:progress', progress)
              lastReportTime = now
              bytesSinceLastReport = 0
            }
          }
        }

        await new Promise<void>((resolve, reject) => {
          fileStream.end((err?: Error | null) => {
            if (err) reject(err)
            else resolve()
          })
        })

        return { success: true, filePath: targetPath }
      } catch (err: any) {
        return { success: false, error: err.message || 'Download failed' }
      }
    }
  )

  ipcMain.handle(
    'updater:installUpdate',
    async (_, filePath: string): Promise<{ success: boolean; message?: string; error?: string }> => {
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error('Update file does not exist: ' + filePath)
        }

        const platform = process.platform

        if (platform === 'win32') {
          // Launch Windows NSIS installer and exit app
          const child = spawn(filePath, [], {
            detached: true,
            stdio: 'ignore'
          })
          child.unref()
          setTimeout(() => app.quit(), 500)
          return { success: true, message: 'Installer launched. Exiting app...' }
        }

        if (platform === 'darwin') {
          // On macOS, open the DMG file so user can drag to Applications or run installer
          await shell.openPath(filePath)
          return { success: true, message: 'DMG opened in Finder. Drag AskMeToBuildSomeThing to Applications.' }
        }

        if (platform === 'linux') {
          if (filePath.endsWith('.AppImage')) {
            fs.chmodSync(filePath, 0o755)
            const child = spawn(filePath, [], { detached: true, stdio: 'ignore' })
            child.unref()
            setTimeout(() => app.quit(), 500)
            return { success: true, message: 'Launching new AppImage...' }
          }
          await shell.openPath(filePath)
          return { success: true, message: 'Package opened.' }
        }

        await shell.openPath(filePath)
        return { success: true, message: 'Installer opened.' }
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to install update' }
      }
    }
  )

  // Background check on startup (delayed 3.5 seconds so app loads fast)
  setTimeout(async () => {
    try {
      const result = await fetchLatestRelease()
      if (result.available && result.updateInfo) {
        mainWindow.webContents.send('updater:updateDetected', result.updateInfo)
      }
    } catch {
      // Ignore background check errors
    }
  }, 3500)
}
