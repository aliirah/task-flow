export function buildWsUrl(path: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!apiUrl) {
    if (typeof window !== 'undefined') {
      const { protocol, host } = window.location
      const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
      return `${wsProtocol}//${host}${normalizedPath}`
    }
    return normalizedPath
  }
  const wsBase = apiUrl.replace(/^http/i, (match) =>
    match.toLowerCase() === 'https' ? 'wss' : 'ws'
  )
  return `${wsBase.replace(/\/$/, '')}${normalizedPath}`
}
