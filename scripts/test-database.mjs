import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
let id
try {
  const title = `CRUD smoke test ${crypto.randomUUID()}`
  const inserted = await db.from('todos').insert({ title }).select().single()
  assert.ifError(inserted.error)
  id = inserted.data.id
  assert.equal(inserted.data.completed, false)
  const loaded = await db.from('todos').select().eq('id', id).single()
  assert.ifError(loaded.error)
  assert.equal(loaded.data.title, title)
  const updated = await db.from('todos').update({ completed: true }).eq('id', id).select().single()
  assert.ifError(updated.error)
  assert.equal(updated.data.completed, true)
  const invalid = await db.from('todos').insert({ title: '   ' })
  assert.ok(invalid.error, 'Blank titles must be rejected')
  const forbidden = await db.from('todos').update({ title: 'Modified' }).eq('id', id)
  assert.ok(forbidden.error, 'Public clients may only update completion')
  const deleted = await db.from('todos').delete().eq('id', id).select().single()
  assert.ifError(deleted.error)
  const absent = await db.from('todos').select().eq('id', id)
  assert.ifError(absent.error)
  assert.equal(absent.data.length, 0)
  console.log('PASS: public CRUD, reload persistence, title constraint, column grants')
} finally {
  if (id) {
    const cleanup = await db.from('todos').delete().eq('id', id)
    assert.ifError(cleanup.error)
  }
}
