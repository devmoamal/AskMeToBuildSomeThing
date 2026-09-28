import { describe, it, expect } from 'bun:test'
import { isNewerVersion } from '../shared/semver'

describe('Updater Version Comparison', () => {
  it('should detect higher patch version as newer', () => {
    expect(isNewerVersion('v1.0.2', '1.0.1')).toBe(true)
    expect(isNewerVersion('1.0.2', '1.0.1')).toBe(true)
  })

  it('should detect higher minor version as newer', () => {
    expect(isNewerVersion('v1.1.0', '1.0.9')).toBe(true)
    expect(isNewerVersion('1.2.0', '1.1.5')).toBe(true)
  })

  it('should detect higher major version as newer', () => {
    expect(isNewerVersion('v2.0.0', '1.9.9')).toBe(true)
  })

  it('should not detect equal version as newer', () => {
    expect(isNewerVersion('v1.0.2', '1.0.2')).toBe(false)
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false)
  })

  it('should not detect lower version as newer', () => {
    expect(isNewerVersion('v1.0.0', '1.0.1')).toBe(false)
    expect(isNewerVersion('v1.0.1', '1.1.0')).toBe(false)
    expect(isNewerVersion('v0.9.0', '1.0.0')).toBe(false)
  })
})

describe('Updater Asset Resolution', () => {
  const sampleAssets = [
    { name: 'AskMeToBuildSomeThing-v1.0.4-win-x64.exe', size: 120000000 },
    { name: 'AskMeToBuildSomeThing-v1.0.4-linux-x86_64.AppImage', size: 110000000 },
    { name: 'AskMeToBuildSomeThing-v1.0.4-linux-amd64.deb', size: 90000000 },
    { name: 'AskMeToBuildSomeThing-v1.0.4-mac-arm64.dmg', size: 105000000 },
    { name: 'AskMeToBuildSomeThing-v1.0.4-mac-arm64.zip', size: 85000000 },
    { name: 'AskMeToBuildSomeThing-v1.0.4-mac-x64.dmg', size: 106000000 },
    { name: 'AskMeToBuildSomeThing-v1.0.4-mac-x64.zip', size: 86000000 }
  ]

  it('should match Windows .exe asset on win32', () => {
    const { findMatchingAsset } = require('../shared/updater-utils')
    const match = findMatchingAsset(sampleAssets, 'win32', 'x64')
    expect(match).not.toBeNull()
    expect(match.name).toBe('AskMeToBuildSomeThing-v1.0.4-win-x64.exe')
  })

  it('should prioritize mac-arm64.zip over dmg for in-place auto update on Apple Silicon', () => {
    const { findMatchingAsset } = require('../shared/updater-utils')
    const match = findMatchingAsset(sampleAssets, 'darwin', 'arm64')
    expect(match).not.toBeNull()
    expect(match.name).toBe('AskMeToBuildSomeThing-v1.0.4-mac-arm64.zip')
  })

  it('should prioritize mac-x64.zip over dmg on Intel macOS', () => {
    const { findMatchingAsset } = require('../shared/updater-utils')
    const match = findMatchingAsset(sampleAssets, 'darwin', 'x64')
    expect(match).not.toBeNull()
    expect(match.name).toBe('AskMeToBuildSomeThing-v1.0.4-mac-x64.zip')
  })

  it('should fallback to dmg if zip is not present', () => {
    const { findMatchingAsset } = require('../shared/updater-utils')
    const dmgOnlyAssets = [
      { name: 'AskMeToBuildSomeThing-v1.0.4-mac-arm64.dmg', size: 105000000 }
    ]
    const match = findMatchingAsset(dmgOnlyAssets, 'darwin', 'arm64')
    expect(match).not.toBeNull()
    expect(match.name).toBe('AskMeToBuildSomeThing-v1.0.4-mac-arm64.dmg')
  })

  it('should match AppImage on linux', () => {
    const { findMatchingAsset } = require('../shared/updater-utils')
    const match = findMatchingAsset(sampleAssets, 'linux', 'x64')
    expect(match).not.toBeNull()
    expect(match.name).toBe('AskMeToBuildSomeThing-v1.0.4-linux-x86_64.AppImage')
  })
})

describe('Target App Path Resolution', () => {
  const { resolveTargetAppPath } = require('../shared/updater-utils')

  it('should redirect DMG mounted app path to /Applications', () => {
    const dmgPath = '/Volumes/AskMeToBuildSomeThing 1.0.4/AskMeToBuildSomeThing.app/Contents/MacOS/AskMeToBuildSomeThing'
    expect(resolveTargetAppPath(dmgPath, 'darwin')).toBe('/Applications/AskMeToBuildSomeThing.app')
  })

  it('should redirect AppTranslocation app path to /Applications', () => {
    const translocatedPath = '/private/var/folders/xx/12345/AppTranslocation/abc/AskMeToBuildSomeThing.app/Contents/MacOS/AskMeToBuildSomeThing'
    expect(resolveTargetAppPath(translocatedPath, 'darwin')).toBe('/Applications/AskMeToBuildSomeThing.app')
  })

  it('should redirect dev electron binary path to /Applications', () => {
    const devPath = '/Users/user/project/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'
    expect(resolveTargetAppPath(devPath, 'darwin')).toBe('/Applications/AskMeToBuildSomeThing.app')
  })

  it('should preserve standard /Applications install path', () => {
    const installedPath = '/Applications/AskMeToBuildSomeThing.app/Contents/MacOS/AskMeToBuildSomeThing'
    expect(resolveTargetAppPath(installedPath, 'darwin')).toBe('/Applications/AskMeToBuildSomeThing.app')
  })

  it('should preserve custom user Applications path', () => {
    const userAppPath = '/Users/test/Applications/AskMeToBuildSomeThing.app/Contents/MacOS/AskMeToBuildSomeThing'
    expect(resolveTargetAppPath(userAppPath, 'darwin')).toBe('/Users/test/Applications/AskMeToBuildSomeThing.app')
  })

  it('should resolve Windows exe path', () => {
    expect(resolveTargetAppPath('C:\\Program Files\\App\\app.exe', 'win32')).toBe('C:\\Program Files\\App\\app.exe')
  })
})

describe('Update Script Generation', () => {
  const {
    generateMacUpdateScript,
    generateWinUpdateScript,
    generateLinuxUpdateScript
  } = require('../shared/updater-utils')

  it('should generate robust atomic macOS update script with auto-reopen', () => {
    const script = generateMacUpdateScript({
      pid: 12345,
      newAppPath: '/tmp/staging/AskMeToBuildSomeThing.app',
      targetAppPath: '/Applications/AskMeToBuildSomeThing.app'
    })

    expect(script).toContain('PID="12345"')
    expect(script).toContain('kill -0 "$PID"')
    expect(script).toContain('pkill -9 -f "$TARGET_APP/Contents/MacOS"')
    expect(script).toContain('mv "$TARGET_APP" "$TRASH_DIR"')
    expect(script).toContain('ditto "$NEW_APP" "$TARGET_APP"')
    expect(script).toContain('xattr -dr com.apple.quarantine')
    expect(script).toContain('touch "$TARGET_APP"')
    expect(script).toContain('open -a "$TARGET_APP"')
  })

  it('should generate Windows silent install and auto-relaunch batch script', () => {
    const script = generateWinUpdateScript({
      pid: 54321,
      installerPath: 'C:\\Users\\Temp\\update.exe',
      exePath: 'C:\\Program Files\\AskMe\\AskMe.exe'
    })

    expect(script).toContain('set "OLD_PID=54321"')
    expect(script).toContain('start /wait "" "%INSTALLER%" /S')
    expect(script).toContain('start "" "%EXE_PATH%"')
  })

  it('should generate Linux AppImage update and restart script', () => {
    const script = generateLinuxUpdateScript({
      pid: 9999,
      newAppPath: '/tmp/AskMe.AppImage',
      targetAppPath: '/home/user/Applications/AskMe.AppImage'
    })

    expect(script).toContain('PID="9999"')
    expect(script).toContain('cp -f "$NEW_FILE" "$TARGET_FILE"')
    expect(script).toContain('chmod +x')
    expect(script).toContain('"$TARGET_FILE" &')
  })
})
