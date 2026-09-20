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
