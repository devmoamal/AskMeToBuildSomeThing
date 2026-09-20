export function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, '').trim()
  const parts = clean.split('.').map(Number)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

export function isNewerVersion(remoteVersion: string, localVersion: string): boolean {
  const [rMaj, rMin, rPat] = parseSemver(remoteVersion)
  const [lMaj, lMin, lPat] = parseSemver(localVersion)

  if (rMaj !== lMaj) return rMaj > lMaj
  if (rMin !== lMin) return rMin > lMin
  return rPat > lPat
}
