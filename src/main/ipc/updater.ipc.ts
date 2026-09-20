import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import type { UpdateCheckResult, UpdateInfo, UpdateProgress } from '../../shared/types'
import { isNewerVersion } from '../../shared/semver'
import { findMatchingAsset } from '../../shared/updater-utils'

const GITHUB_REPO = 'devmoamal/AskMeToBuildSomeThing'
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

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

  function getCurrentAppBundlePath(): string {
    try {
      const exePath = app.getPath('exe')
      const match = exePath.match(/^(.*?\.app)\/Contents\/MacOS\//)
      if (match && match[1]) {
        return match[1]
      }
    } catch {}
    return '/Applications/AskMeToBuildSomeThing.app'
  }

  ipcMain.handle(
    'updater:installUpdate',
    async (_, filePath: string): Promise<{ success: boolean; message?: string; error?: string }> => {
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error('Update file does not exist: ' + filePath)
        }

        const platform = process.platform

        if (platform === 'win32') {
          // Launch Windows NSIS installer silently (/S) and exit app
          const child = spawn(filePath, ['/S'], {
            detached: true,
            stdio: 'ignore'
          })
          child.unref()
          setTimeout(() => app.exit(0), 500)
          return { success: true, message: 'Installing update silently and restarting...' }
        }

        if (platform === 'darwin') {
          const targetAppPath = getCurrentAppBundlePath()
          const tempDir = app.getPath('temp')
          const stagingDir = path.join(tempDir, `update-app-${Date.now()}`)
          fs.mkdirSync(stagingDir, { recursive: true })

          let extractedAppPath = ''

          if (filePath.endsWith('.zip')) {
            // Unpack directly via ditto preserving codesign signatures and permissions
            execSync(`ditto -xk "${filePath}" "${stagingDir}"`)
            const items = fs.readdirSync(stagingDir)
            const appFolder = items.find(i => i.endsWith('.app'))
            if (!appFolder) {
              throw new Error('No .app bundle found inside downloaded update archive')
            }
            extractedAppPath = path.join(stagingDir, appFolder)
          } else if (filePath.endsWith('.dmg')) {
            // Mount DMG silently without opening Finder
            const mountPoint = path.join(tempDir, `update-mount-${Date.now()}`)
            fs.mkdirSync(mountPoint, { recursive: true })
            execSync(`hdiutil attach "${filePath}" -nobrowse -mountpoint "${mountPoint}" -quiet`)
            try {
              const items = fs.readdirSync(mountPoint)
              const appFolder = items.find(i => i.endsWith('.app'))
              if (!appFolder) {
                throw new Error('No .app bundle found inside downloaded DMG')
              }
              extractedAppPath = path.join(stagingDir, appFolder)
              execSync(`cp -R "${path.join(mountPoint, appFolder)}" "${extractedAppPath}"`)
            } finally {
              try {
                execSync(`hdiutil detach "${mountPoint}" -quiet -force`)
              } catch {}
            }
          } else {
            throw new Error('Unsupported macOS update package: ' + filePath)
          }

          // Create detached shell script to swap app bundle, strip quarantine, and relaunch
          const scriptPath = path.join(tempDir, `apply-update-${Date.now()}.sh`)
          const scriptContent = `#!/bin/bash
PID=$1
NEW_APP="$2"
TARGET_APP="$3"

COUNT=0
while kill -0 $PID 2>/dev/null; do
  sleep 0.1
  COUNT=$((COUNT+1))
  if [ $COUNT -ge 100 ]; then
    kill -9 $PID 2>/dev/null
    break
  fi
done

# Atomically replace target application
rm -rf "$TARGET_APP"
cp -R "$NEW_APP" "$TARGET_APP"

# Strip quarantine attribute to avoid Gatekeeper launch delays/bouncing
xattr -cr "$TARGET_APP" 2>/dev/null || true

# Clean up temporary files
rm -rf "$NEW_APP"

# Launch updated application
open -n "$TARGET_APP"
`
          fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 })

          const child = spawn('/bin/bash', [
            scriptPath,
            String(process.pid),
            extractedAppPath,
            targetAppPath
          ], {
            detached: true,
            stdio: 'ignore'
          })
          child.unref()

          setTimeout(() => {
            app.exit(0)
          }, 400)

          return { success: true, message: 'Update installed! Restarting application...' }
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
