import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const columns = 'id,title,completed,created_at'

export default function App() {
  const [todos, setTodos] = useState([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadTodos() {
    setLoading(true)
    setError('')
    try {
      if (!supabase) throw new Error('Set the Supabase values in .env.local, then restart the app.')
      const { data, error } = await supabase.from('todos').select(columns).order('id')
      if (error) throw error
      setTodos(data)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadTodos() }, [])

  async function mutate(operation, update) {
    setBusy(true)
    setError('')
    try {
      const { data, error } = await operation()
      if (error) throw error
      update(data)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function addTodo(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return
    await mutate(
      () => supabase.from('todos').insert({ title: trimmed }).select(columns).single(),
      (todo) => { setTodos((todos) => [...todos, todo]); setTitle('') },
    )
  }

  function toggleTodo(todo) {
    void mutate(
      () => supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id).select(columns).single(),
      (updated) => setTodos((todos) => todos.map((item) => item.id === updated.id ? updated : item)),
    )
  }

  function deleteTodo(todo) {
    void mutate(
      () => supabase.from('todos').delete().eq('id', todo.id).select('id').single(),
      () => setTodos((todos) => todos.filter((item) => item.id !== todo.id)),
    )
  }

  const remaining = todos.filter((todo) => !todo.completed).length

  return (
    <main>
      <header>
        <span className="eyebrow">BUGTREE / HELLO WORLD</span>
        <h1>A little list.<br />A clearer day.</h1>
        <p>A shared todo list, saved in Supabase.</p>
      </header>
      <section className="card" aria-label="Todo list">
        <form onSubmit={addTodo}>
          <label className="sr-only" htmlFor="new-todo">New todo</label>
          <input id="new-todo" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" maxLength={200} disabled={busy || loading || !supabase} />
          <button type="submit" disabled={busy || loading || !title.trim() || !supabase}>Add todo</button>
        </form>
        {error && <p role="alert" className="error">{error}</p>}
        {loading ? <p role="status" className="empty">Loading your list…</p> : todos.length === 0 ? <p className="empty">Nothing here yet. Add your first todo.</p> : (
          <ul>
            {todos.map((todo) => (
              <li key={todo.id}>
                <label className={todo.completed ? 'completed' : ''}>
                  <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo)} disabled={busy || loading} />
                  <span>{todo.title}</span>
                </label>
                <button className="delete" onClick={() => deleteTodo(todo)} disabled={busy || loading} aria-label={`Delete ${todo.title}`}>×</button>
              </li>
            ))}
          </ul>
        )}
        <footer>
          <span aria-live="polite">{remaining} {remaining === 1 ? 'task' : 'tasks'} left</span>
          <button className="refresh" onClick={loadTodos} disabled={busy || loading}>Refresh</button>
        </footer>
      </section>
      <p className="note">Everyone shares this list and can edit it. Use demo tasks only.<br />Reload the page — your todos will still be here.</p>
    </main>
  )
}
