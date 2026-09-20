import { execSync } from 'node:child_process'

export function getRealSystemArch(): string {
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') return 'arm64'
    try {
      const translated = execSync('sysctl -in sysctl.proc_translated', { encoding: 'utf-8' }).trim()
      if (translated === '1') return 'arm64'
      const isArm64 = execSync('sysctl -in hw.optional.arm64', { encoding: 'utf-8' }).trim()
      if (isArm64 === '1') return 'arm64'
    } catch {}
  }
  return process.arch
}

export function findMatchingAsset(
  assets: any[],
  customPlatform?: string,
  customArch?: string
): any | null {
  const platform = customPlatform || process.platform
  const arch = customArch || getRealSystemArch()

  if (platform === 'win32') {
    return assets.find((a: any) => a.name.endsWith('.exe')) || null
  }

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      // Prioritize .zip for in-place updates, fallback to .dmg
      return (
        assets.find((a: any) => a.name.includes('arm64') && a.name.endsWith('.zip')) ||
        assets.find((a: any) => a.name.includes('arm64') && a.name.endsWith('.dmg')) ||
        assets.find((a: any) => a.name.endsWith('.zip')) ||
        assets.find((a: any) => a.name.endsWith('.dmg')) ||
        null
      )
    }
    return (
      assets.find((a: any) => (a.name.includes('x64') || a.name.includes('x86_64')) && a.name.endsWith('.zip')) ||
      assets.find((a: any) => (a.name.includes('x64') || a.name.includes('x86_64')) && a.name.endsWith('.dmg')) ||
      assets.find((a: any) => a.name.endsWith('.zip')) ||
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
