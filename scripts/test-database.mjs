import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

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
let token, id
try {
  assert.ok((await db.from('todos').select()).error, 'Direct public reads must be denied')
  assert.ok((await db.from('todos').insert({ title: 'Unauthorized' })).error, 'Direct writes must be denied')
  assert.ok((await db.from('site_credentials').select()).error, 'Credentials must be inaccessible')
  assert.ok((await db.from('site_sessions').select()).error, 'Sessions must be inaccessible')
  assert.equal((await call('list')).status, 401)
  assert.equal((await call('list', {}, '0'.repeat(64))).status, 401)
  assert.equal((await call('login', { password: 'wrong-password' })).status, 401)
  const login = await call('login', { password: process.env.SITE_TEST_PASSWORD })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  token = login.body.token
  const duration = Date.parse(login.body.expiresAt) - Date.now()
  assert.ok(duration > 7 * 86400000 - 60000 && duration <= 7 * 86400000)
  const added = await call('add', { title: `Protected smoke test ${crypto.randomUUID()}` }, token)
  assert.equal(added.status, 200)
  id = added.body.data.id
  const loaded = await call('list', {}, token)
  assert.ok(loaded.body.data.some((todo) => todo.id === id), 'A separate request must load the persisted todo')
  const completed = await call('toggle', { id, completed: true }, token)
  assert.equal(completed.body.data.completed, true)
  assert.equal((await call('add', { title: ' ' }, token)).status, 400)
  assert.equal((await call('delete', { id }, token)).status, 200)
  id = undefined
  assert.equal((await call('logout', {}, token)).status, 200)
  assert.equal((await call('list', {}, token)).status, 401)
  console.log('PASS: password gate, seven-day session, protected CRUD, public access denied, logout revocation')
} finally {
  if (id) await call('delete', { id }, token)
  if (token) await call('logout', {}, token)
}
