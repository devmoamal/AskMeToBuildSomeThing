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
