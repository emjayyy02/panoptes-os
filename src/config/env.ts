export function getApiBase(): string {
  const base = import.meta.env.VITE_PANOPTES_API_BASE?.trim().replace(/\/+$/, '')
  if (!base) throw new Error('API address is missing. Set VITE_PANOPTES_API_BASE and restart the console.')
  if (base.startsWith('/') && !base.startsWith('//') && !/[?#]/.test(base)) return base
  try {
    const url = new URL(base)
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash) return base
  } catch { /* Report configuration errors at the request boundary. */ }
  throw new Error('API address must be a same-origin path or an HTTP(S) URL without credentials, query, or fragment.')
}
