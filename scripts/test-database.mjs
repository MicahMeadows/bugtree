import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { newNode } from '../supabase/functions/site-api/tree-model.js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
assert.ok(process.env.SITE_TEST_PASSWORD, 'Set SITE_TEST_PASSWORD to run the authenticated smoke test')
const db = createClient(url, key)
async function call(action, body = {}, token) {
  const response = await fetch(`${url}/functions/v1/site-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, ...(token ? { 'x-site-session': token } : {}) },
    body: JSON.stringify({ action, ...body }),
  })
  return { status: response.status, body: await response.json() }
}
let token, chart
try {
  for (const table of ['taxonomy_charts', 'site_credentials', 'site_sessions']) assert.ok((await db.from(table).select()).error, `${table} must not be public`)
  assert.equal((await call('charts-list')).status, 401)
  assert.equal((await call('charts-list', {}, '0'.repeat(64))).status, 401)
  assert.equal((await call('login', { password: 'wrong-password' })).status, 401)
  const login = await call('login', { password: process.env.SITE_TEST_PASSWORD })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  token = login.body.token
  const duration = Date.parse(login.body.expiresAt) - Date.now()
  assert.ok(duration > 7 * 86400000 - 60000 && duration <= 7 * 86400000)
  const created = await call('chart-create', { name: `Taxonomy smoke test ${crypto.randomUUID()}` }, token)
  assert.equal(created.status, 200, JSON.stringify(created.body))
  chart = created.body.data
  const child = newNode(chart.nodes[0].id, 'Example family', 'Family')
  child.bullets = ['A distinguishing feature', 'A second identification note']
  const save = await call('chart-save', { ...chart, nodes: [...chart.nodes, child], description: 'Persistence check' }, token)
  assert.equal(save.status, 200, JSON.stringify(save.body))
  const stale = await call('chart-save', chart, token)
  assert.equal(stale.status, 409, 'Stale edits must not overwrite newer data')
  chart = save.body.data
  const loaded = await call('chart-load', { id: chart.id }, token)
  assert.equal(loaded.status, 200)
  assert.deepEqual(loaded.body.data.nodes, chart.nodes)
  const listed = await call('charts-list', {}, token)
  assert.ok(listed.body.data.some((c) => c.id === chart.id && c.node_count === 2))
  const cycle = await call('chart-save', { ...chart, nodes: chart.nodes.map((n) => n.id === chart.nodes[0].id ? { ...n, parentId: child.id } : n) }, token)
  assert.equal(cycle.status, 400)
  const invalidImage = await call('photo-upload', { id: chart.id, nodeId: child.id, image: 'data:image/jpeg;base64,SGVsbG8=' }, token)
  assert.equal(invalidImage.status, 400)
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ocAAAAASUVORK5CYII='
  const upload = await call('photo-upload', { id: chart.id, nodeId: child.id, image }, token)
  assert.equal(upload.status, 200, JSON.stringify(upload.body))
  assert.equal((await fetch(upload.body.photoUrls[upload.body.path])).status, 200)
  const withPhoto = await call('chart-save', { ...chart, nodes: chart.nodes.map((n) => n.id === child.id ? { ...n, photo: upload.body.path, photoAlt: 'Test image' } : n) }, token)
  assert.equal(withPhoto.status, 200, JSON.stringify(withPhoto.body))
  chart = withPhoto.body.data
  const reloaded = await call('chart-load', { id: chart.id }, token)
  assert.ok(reloaded.body.photoUrls[upload.body.path], 'Reload must regenerate private photo URLs')
  const renewed = await call('photo-urls', { id: chart.id, paths: [upload.body.path] }, token)
  assert.equal(renewed.status, 200)
  assert.ok(renewed.body.photoUrls[upload.body.path])
  const publicRead = await db.storage.from('taxonomy-photos').download(upload.body.path)
  assert.ok(publicRead.error, 'Private photos must not be directly downloadable')
  assert.equal((await call('chart-delete', { id: chart.id, version: chart.version }, token)).status, 200)
  assert.equal((await call('chart-load', { id: chart.id }, token)).status, 404)
  chart = null
  assert.equal((await call('logout', {}, token)).status, 200)
  assert.equal((await call('charts-list', {}, token)).status, 401)
  console.log('PASS: password/session, chart lifecycle, persistence, conflict protection, cycle rejection, private photo upload/reload, logout')
} finally {
  if (chart) await call('chart-delete', { id: chart.id, version: chart.version }, token)
  if (token) await call('logout', {}, token)
}
