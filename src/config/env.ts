// No environment variable can redirect browser API requests to a webhook.
export const getApiBase = () => '/api/panoptes'

export function getAuthConfig(): { url: string; key: string } {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) throw new Error('Supabase sign-in is not configured. Set the public Supabase URL and publishable key, then restart the console.')
  try {
    const parsed = new URL(url)
    const local = import.meta.env.DEV && parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if ((parsed.protocol !== 'https:' && !local) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error()
    let publicKey = key.startsWith('sb_publishable_')
    if (!publicKey) {
      try { publicKey = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon' } catch { /* Reject privileged or malformed keys. */ }
    }
    if (!publicKey) throw new Error()
    return { url: parsed.origin, key }
  } catch { throw new Error('Invalid public Supabase configuration. Use a project origin and a publishable or legacy anon key.') }
}
