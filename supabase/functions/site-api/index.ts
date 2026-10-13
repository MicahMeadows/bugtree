import { newNode, validateNodes, COLORS } from './tree-model.js'
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
    const chartColumns = 'id,name,description,default_color,nodes,node_count,version,created_at,updated_at'
    const validId = (id: unknown) => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id)
    if (body.action === 'charts-list') {
      const result = await db.from('taxonomy_charts').select('id,name,description,node_count,version,updated_at').is('deleted_at', null).order('updated_at', { ascending: false })
      check(result.error)
      return reply({ data: result.data })
    }
    if (body.action === 'chart-create') {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200) return reply({ error: 'Give your chart a name (up to 200 characters).' }, 400)
      const root = newNode(null, 'Insecta', 'Class')
      const result = await db.from('taxonomy_charts').insert({ name: body.name.trim(), nodes: [root] }).select(chartColumns).single()
      check(result.error)
      return reply({ data: result.data, photoUrls: {} })
    }
    if (!validId(body.id)) return reply({ error: 'Invalid chart ID' }, 400)
    const existing = await db.from('taxonomy_charts').select(chartColumns).eq('id', body.id).is('deleted_at', null).maybeSingle()
    check(existing.error)
    if (!existing.data) return reply({ error: 'This chart is no longer available.' }, 404)
    const bucket = db.storage.from('taxonomy-photos')
    const signPhotos = async (paths: string[]) => {
      if (!paths.length) return {}
      const ttl = Math.max(1, Math.min(3600, Math.floor((Date.parse(session.data.expires_at) - Date.now()) / 1000)))
      const signed = await bucket.createSignedUrls(paths, ttl)
      check(signed.error)
      return Object.fromEntries(signed.data.filter((p) => p.signedUrl).map((p) => [p.path, p.signedUrl]))
    }
    if (body.action === 'chart-load') return reply({ data: existing.data, photoUrls: await signPhotos(existing.data.nodes.map((n: { photo: string }) => n.photo).filter(Boolean)) })
    if (body.action === 'chart-save') {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200 || typeof body.description !== 'string' || body.description.length > 2000) return reply({ error: 'Check your chart name and description.' }, 400)
      const defaultColor = body.default_color === undefined ? existing.data.default_color : body.default_color
      if (!COLORS.includes(defaultColor)) return reply({ error: 'Invalid default color.' }, 400)
      const invalid = validateNodes(body.nodes, body.id)
      if (invalid) return reply({ error: invalid }, 400)
      if (JSON.stringify(body.nodes).length > 1000000) return reply({ error: 'This chart is too large. Shorten its notes or split it into two trees.' }, 400)
      if (!Number.isInteger(body.version) || body.version < 1) return reply({ error: 'Invalid chart version' }, 400)
      const nodes = body.nodes.map((n: any) => ({ id: n.id, parentId: n.parentId, name: n.name.trim(), rank: n.rank, bullets: n.bullets, photo: n.photo, photoAlt: n.photoAlt, color: n.color, type: n.type || 'taxon', offsetX: n.offsetX || 0, offsetY: n.offsetY || 0 }))
      const result = await db.from('taxonomy_charts').update({ name: body.name.trim(), description: body.description, default_color: defaultColor, nodes, version: body.version + 1, updated_at: new Date().toISOString() }).eq('id', body.id).eq('version', body.version).is('deleted_at', null).select(chartColumns).maybeSingle()
      check(result.error)
      if (!result.data) return reply({ error: 'This chart changed in another tab. Your edits are still here; export a backup, then reopen the chart before saving.' }, 409)
      return reply({ data: result.data })
    }
    if (body.action === 'chart-delete') {
      const result = await db.from('taxonomy_charts').update({ deleted_at: new Date().toISOString(), version: existing.data.version + 1 }).eq('id', body.id).eq('version', body.version).is('deleted_at', null).select('id').maybeSingle()
      check(result.error)
      if (!result.data) return reply({ error: 'This chart changed. Refresh the library before deleting it.' }, 409)
      return reply({ data: result.data })
    }
    if (body.action === 'photo-urls') {
      if (!Array.isArray(body.paths) || body.paths.length > 200 || body.paths.some((p: unknown) => typeof p !== 'string' || !new RegExp(`^${body.id}/[a-f0-9-]{36}/[a-f0-9-]{36}\\.(jpg|png|webp)$`).test(p))) return reply({ error: 'Invalid photo references' }, 400)
      return reply({ photoUrls: await signPhotos(body.paths) })
    }
    if (body.action === 'photo-upload') {
      if (!validId(body.nodeId) || typeof body.image !== 'string' || body.image.length > 1400000) return reply({ error: 'Use an image under 1 MB.' }, 400)
      const match = body.image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/)
      if (!match) return reply({ error: 'Use a JPEG, PNG, or WebP image.' }, 400)
      let bytes
      try { bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0)) } catch { return reply({ error: 'Invalid image' }, 400) }
      if (!bytes.length || bytes.length > 1048576) return reply({ error: 'Use an image under 1 MB.' }, 400)
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      const png = bytes.slice(0, 8).every((b, i) => b === [137,80,78,71,13,10,26,10][i]) && bytes.length > 8
      const webp = new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP'
      if (!(match[1] === 'jpeg' ? jpeg : match[1] === 'png' ? png : webp)) return reply({ error: 'The image format could not be verified.' }, 400)
      const path = `${body.id}/${body.nodeId}/${crypto.randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`
      const uploaded = await bucket.upload(path, bytes, { contentType: `image/${match[1]}`, upsert: false })
      check(uploaded.error)
      return reply({ path, photoUrls: await signPhotos([path]) })
    }
    return reply({ error: 'Unknown action' }, 400)
  } catch {
    return reply({ error: 'Could not complete the request. Please try again.' }, 500)
  }
})
