const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const storageKey = 'bugtree.site-session'
export const configured = Boolean(url && key)

export function clearSession() { localStorage.removeItem(storageKey) }
export function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(storageKey))
    if (session?.token && Date.parse(session.expiresAt) > Date.now()) return session
    clearSession()
  } catch { /* A missing or invalid session is signed out. */ }
  return null
}
export function saveSession(session) { localStorage.setItem(storageKey, JSON.stringify(session)) }

export async function siteApi(action, body = {}) {
  if (!configured) throw new Error('Set your Supabase environment values.')
  const session = readSession()
  const response = await fetch(`${url}/functions/v1/site-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, ...(session ? { 'x-site-session': session.token } : {}) },
    body: JSON.stringify({ ...body, action }),
  })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(result.error || 'Could not connect. Please try again.')
    error.status = response.status
    throw error
  }
  return result
}
