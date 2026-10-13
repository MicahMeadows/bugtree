import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, x-site-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: cors })
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
const digest = async (text: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
function check(error: unknown) { if (error) throw error }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  try {
    let body
    try { body = await req.json() } catch { return reply({ error: 'Invalid request' }, 400) }
    if (!body || typeof body !== 'object') return reply({ error: 'Invalid request' }, 400)
    if (body.action === 'login') {
      if (typeof body.password !== 'string' || body.password.length > 256) return reply({ error: 'Invalid password' }, 400)
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
      const bucket = await digest(ip)
      const limit = await db.rpc('check_site_login_limit', { p_bucket: bucket })
      check(limit.error)
      if (!limit.data) return reply({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)
      const credentials = await db.from('site_credentials').select('salt,password_hash,iterations').eq('id', 1).single()
      check(credentials.error)
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(body.password), 'PBKDF2', false, ['deriveBits'])
      const computed = hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(credentials.data.salt), iterations: credentials.data.iterations, hash: 'SHA-256' }, key, 256))
      let difference = 0
      for (let i = 0; i < computed.length; i++) difference |= computed.charCodeAt(i) ^ credentials.data.password_hash.charCodeAt(i)
      if (difference !== 0) return reply({ error: 'Incorrect password' }, 401)
      // Store only a digest of the random bearer token. Expiry is set by the database.
      const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
      const session = await db.from('site_sessions').insert({ token_hash: await digest(token) }).select('expires_at').single()
      check(session.error)
      await db.from('site_sessions').delete().lt('expires_at', new Date().toISOString())
      await db.from('site_login_limits').delete().lt('expires_at', new Date().toISOString())
      return reply({ token, expiresAt: session.data.expires_at })
    }
    const token = req.headers.get('x-site-session') || ''
    if (!/^[a-f0-9]{64}$/.test(token)) return reply({ error: 'Please enter the site password' }, 401)
    const tokenHash = await digest(token)
    const session = await db.from('site_sessions').select('expires_at').eq('token_hash', tokenHash).gt('expires_at', new Date().toISOString()).maybeSingle()
    check(session.error)
    if (!session.data) return reply({ error: 'Your login expired. Please sign in again.' }, 401)
    if (body.action === 'logout') {
      const result = await db.from('site_sessions').delete().eq('token_hash', tokenHash)
      check(result.error)
      return reply({ ok: true })
    }
    const columns = 'id,title,completed,created_at'
    let result
    if (body.action === 'list') {
      result = await db.from('todos').select(columns).order('id')
    } else if (body.action === 'add') {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) return reply({ error: 'Enter a task between 1 and 200 characters.' }, 400)
      result = await db.from('todos').insert({ title: body.title.trim() }).select(columns).single()
    } else if (body.action === 'toggle' || body.action === 'delete') {
      if (!Number.isSafeInteger(body.id) || body.id < 1) return reply({ error: 'Invalid todo ID' }, 400)
      if (body.action === 'toggle') {
        if (typeof body.completed !== 'boolean') return reply({ error: 'Invalid completion value' }, 400)
        result = await db.from('todos').update({ completed: body.completed }).eq('id', body.id).select(columns).single()
      } else {
        result = await db.from('todos').delete().eq('id', body.id).select('id').single()
      }
    } else return reply({ error: 'Unknown action' }, 400)
    check(result.error)
    return reply({ data: result.data })
  } catch {
    return reply({ error: 'Could not complete the request. Please try again.' }, 500)
  }
})
