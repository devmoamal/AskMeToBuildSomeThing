import { spawn } from 'node:child_process'
import os from 'node:os'

export type ShellType = 'powershell' | 'cmd' | 'bash' | 'wsl'

export interface RunCommandOptions {
  command: string
  cwd?: string
  shell?: ShellType
  timeoutMs?: number
  onOutput?: (chunk: string) => void
}

export interface RunCommandResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut?: boolean
}

export class TerminalRunner {
  static resolveShell(shellType?: ShellType): { executable: string; args: string[] } {
    const isWin = os.platform() === 'win32'
    const defaultShell: ShellType = isWin ? 'powershell' : 'bash'
    const target = shellType || defaultShell

    switch (target) {
      case 'powershell':
        return isWin
          ? { executable: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'] }
          : { executable: 'bash', args: ['-c'] }
      case 'cmd':
        return isWin
          ? { executable: 'cmd.exe', args: ['/c'] }
          : { executable: 'sh', args: ['-c'] }
      case 'bash':
        return { executable: 'bash', args: ['-c'] }
      case 'wsl':
        return isWin
          ? { executable: 'wsl.exe', args: ['-e', 'sh', '-c'] }
          : { executable: 'bash', args: ['-c'] }
      default:
        return isWin
          ? { executable: 'powershell.exe', args: ['-NoProfile', '-Command'] }
          : { executable: 'sh', args: ['-c'] }
    }
  }

  static async run(options: RunCommandOptions): Promise<RunCommandResult> {
    const isWin = os.platform() === 'win32'
    const defaultShell: ShellType = isWin ? 'powershell' : 'bash'
    const { command, cwd, shell = defaultShell, timeoutMs = 60000, onOutput } = options
    const shellConfig = this.resolveShell(shell)

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let timedOut = false
      let timer: NodeJS.Timeout | null = null

      const proc = spawn(shellConfig.executable, [...shellConfig.args, command], {
        cwd: cwd || process.cwd(),
        env: { ...process.env, CI: 'true', PAGER: 'cat' },
        shell: false
      })

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true
          proc.kill('SIGTERM')
          setTimeout(() => {
            if (!proc.killed) proc.kill('SIGKILL')
          }, 2000)
        }, timeoutMs)
      }

      proc.stdout?.on('data', (data: Buffer) => {
        const str = data.toString()
        stdout += str
        if (onOutput) onOutput(str)
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const str = data.toString()
        stderr += str
        if (onOutput) onOutput(str)
      })

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer)
        resolve({
          exitCode: code ?? (timedOut ? 124 : 1),
          stdout,
          stderr,
          timedOut
        })
      })

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer)
        resolve({
          exitCode: 1,
          stdout,
          stderr: stderr + `\nProcess error: ${err.message}`,
          timedOut
        })
      })
    })
  }
}
