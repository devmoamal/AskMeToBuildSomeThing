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

export function findOtaAsset(assets: any[]): any | null {
  if (!Array.isArray(assets)) return null
  return (
    assets.find((a: any) =>
      a.name === 'bundle.zip' ||
      a.name === 'ota-bundle.zip' ||
      (typeof a.name === 'string' && a.name.endsWith('-ota.zip')) ||
      a.name === 'dist.zip'
    ) || null
  )
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

export function resolveTargetAppPath(exePath?: string, customPlatform?: string): string {
  const platform = customPlatform || process.platform
  if (platform === 'darwin') {
    if (exePath) {
      const match = exePath.match(/^(.*?\.app)\/Contents\/MacOS\//)
      if (match && match[1]) {
        const detected = match[1]
        // If app is running from DMG mount or temporary translocation or dev electron, default to /Applications
        if (
          detected.startsWith('/Volumes/') ||
          detected.includes('/AppTranslocation/') ||
          detected.includes('node_modules/electron')
        ) {
          return '/Applications/AskMeToBuildSomeThing.app'
        }
        return detected
      }
    }
    return '/Applications/AskMeToBuildSomeThing.app'
  }

  if (platform === 'win32') {
    return exePath || 'AskMeToBuildSomeThing.exe'
  }

  if (platform === 'linux') {
    return process.env.APPIMAGE || exePath || ''
  }

  return exePath || ''
}

export function generateMacUpdateScript(params: {
  pid: number | string
  newAppPath: string
  targetAppPath: string
  logPath?: string
}): string {
  const logFile = params.logPath || '/tmp/askmetobuildsomething-update.log'
  return `#!/bin/bash
exec > "${logFile}" 2>&1
set -x

PID="${params.pid}"
NEW_APP="${params.newAppPath}"
TARGET_APP="${params.targetAppPath}"

echo "[$(date)] Auto-updater script launched for PID $PID"
echo "NEW_APP: $NEW_APP"
echo "TARGET_APP: $TARGET_APP"

# Step 1: Wait for parent process to exit
COUNT=0
while kill -0 "$PID" 2>/dev/null; do
  sleep 0.1
  COUNT=$((COUNT+1))
  if [ $COUNT -ge 80 ]; then
    echo "Parent PID $PID did not exit in 8s, killing..."
    kill -9 "$PID" 2>/dev/null || true
    break
  fi
done

# Step 2: Ensure any lingering helpers or child processes from old target bundle are terminated
echo "Terminating any lingering helper processes..."
pkill -9 -f "$TARGET_APP/Contents/MacOS" 2>/dev/null || true
sleep 0.3

# Step 3: Atomic replacement via directory move
TRASH_DIR="\${TARGET_APP}.trash.$$"
rm -rf "$TRASH_DIR" 2>/dev/null || true

if [ -e "$TARGET_APP" ]; then
  echo "Atomically moving existing app to trash backup..."
  mv "$TARGET_APP" "$TRASH_DIR"
fi

echo "Copying new app bundle to $TARGET_APP via ditto..."
mkdir -p "$(dirname "$TARGET_APP")"
ditto "$NEW_APP" "$TARGET_APP"

# Verify TARGET_APP was created
if [ ! -d "$TARGET_APP" ]; then
  echo "CRITICAL ERROR: Failed to install target app bundle! Restoring backup..."
  if [ -d "$TRASH_DIR" ]; then
    mv "$TRASH_DIR" "$TARGET_APP"
  fi
  open -a "$TARGET_APP" 2>/dev/null || open "$TARGET_APP"
  exit 1
fi

# Step 4: Clear quarantine attributes and touch bundle for LaunchServices
echo "Clearing quarantine attributes..."
xattr -dr com.apple.quarantine "$TARGET_APP" 2>/dev/null || true
xattr -cr "$TARGET_APP" 2>/dev/null || true
touch "$TARGET_APP"

# Step 5: Clean up temporary files in background
rm -rf "$TRASH_DIR" "$NEW_APP" 2>/dev/null &

# Step 6: Relaunch updated application
echo "Relaunching updated application: $TARGET_APP"
sleep 0.3
open -a "$TARGET_APP" || open "$TARGET_APP" || open -n "$TARGET_APP"
echo "[$(date)] Auto-updater finished successfully"
`
}

export function generateWinUpdateScript(params: {
  pid: number | string
  installerPath: string
  exePath: string
}): string {
  return `@echo off
set "OLD_PID=${params.pid}"
set "INSTALLER=${params.installerPath}"
set "EXE_PATH=${params.exePath}"

:: Wait for old PID to exit
:wait_pid
tasklist /fi "PID eq %OLD_PID%" | find "%OLD_PID%" >nul 2>&1
if not errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_pid
)

:: Wait brief moment for file handles to be released
timeout /t 1 /nobreak >nul

:: Run installer silently and wait for it to finish installing
start /wait "" "%INSTALLER%" /S

:: Wait brief moment for installer to finish writing files
timeout /t 1 /nobreak >nul

:: Relaunch updated application
start "" "%EXE_PATH%"
`
}

export function generateLinuxUpdateScript(params: {
  pid: number | string
  newAppPath: string
  targetAppPath?: string
  logPath?: string
}): string {
  const logFile = params.logPath || '/tmp/askmetobuildsomething-update.log'
  return `#!/bin/bash
exec > "${logFile}" 2>&1
set -x

PID="${params.pid}"
NEW_FILE="${params.newAppPath}"
TARGET_FILE="${params.targetAppPath || ''}"

while kill -0 "$PID" 2>/dev/null; do
  sleep 0.1
done

if [ -n "$TARGET_FILE" ] && [ -f "$TARGET_FILE" ] && [ -w "$(dirname "$TARGET_FILE")" ]; then
  cp -f "$NEW_FILE" "$TARGET_FILE"
  chmod +x "$TARGET_FILE"
  "$TARGET_FILE" &
else
  chmod +x "$NEW_FILE"
  "$NEW_FILE" &
fi
`
}

