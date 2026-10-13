import { useEffect, useState } from 'react'
import { siteApi, readSession, saveSession, clearSession, configured } from './supabase'


export default function App() {
  const [session, setSession] = useState(readSession)
  const [password, setPassword] = useState('')
  const [todos, setTodos] = useState([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadTodos() {
    setLoading(true)
    setError('')
    try {
      if (!configured) throw new Error('Set the Supabase values in .env.local, then restart the app.')
      const { data, error } = await siteApi('list')
      if (error) throw error
      setTodos(data)
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (session) void loadTodos(); else setLoading(false) }, [session])

  useEffect(() => {
    if (!session) return
    const timer = setTimeout(() => { clearSession(); setSession(null); setTodos([]); setError('Your login expired. Please sign in again.') }, Math.max(0, Date.parse(session.expiresAt) - Date.now()))
    return () => clearTimeout(timer)
  }, [session])

  function handleError(error) {
    if (error.status === 401) { clearSession(); setSession(null); setTodos([]) }
    setError(error.message)
  }

  async function login(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await siteApi('login', { password })
      saveSession(result)
      setSession(result)
      setPassword('')
    } catch (error) { handleError(error) } finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true)
    try { await siteApi('logout'); clearSession(); setSession(null); setTodos([]); setError('') }
    catch (error) { handleError(error) } finally { setBusy(false) }
  }

  async function mutate(operation, update) {
    setBusy(true)
    setError('')
    try {
      const { data, error } = await operation()
      if (error) throw error
      update(data)
    } catch (error) {
      handleError(error)
    } finally {
      setBusy(false)
    }
  }

  async function addTodo(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return
    await mutate(
      () => siteApi('add', { title: trimmed }),
      (todo) => { setTodos((todos) => [...todos, todo]); setTitle('') },
    )
  }

  function toggleTodo(todo) {
    void mutate(
      () => siteApi('toggle', { id: todo.id, completed: !todo.completed }),
      (updated) => setTodos((todos) => todos.map((item) => item.id === updated.id ? updated : item)),
    )
  }

  function deleteTodo(todo) {
    void mutate(
      () => siteApi('delete', { id: todo.id }),
      () => setTodos((todos) => todos.filter((item) => item.id !== todo.id)),
    )
  }

  const remaining = todos.filter((todo) => !todo.completed).length

  if (!session) return (
    <main>
      <header><span className="eyebrow">BUGTREE</span><h1>Your little list.<br />Behind one password.</h1><p>Enter the site password to continue.</p></header>
      <section className="card" aria-label="Site login">
        <form onSubmit={login}>
          <label className="sr-only" htmlFor="site-password">Site password</label>
          <input id="site-password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Site password" maxLength={256} disabled={busy} />
          <button disabled={busy || !password || !configured}>{busy ? 'Signing in…' : 'Enter'}</button>
        </form>
        {!configured && <p role="alert" className="error">Set your Supabase environment values.</p>}
        {error && <p role="alert" className="error">{error}</p>}
      </section>
      <p className="note">You’ll stay signed in on this browser for seven days.</p>
    </main>
  )

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
          <input id="new-todo" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" maxLength={200} disabled={busy || loading || !configured} />
          <button type="submit" disabled={busy || loading || !title.trim() || !configured}>Add todo</button>
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
          <button className="refresh" onClick={logout} disabled={busy || loading}>Log out</button>
          <button className="refresh" onClick={loadTodos} disabled={busy || loading}>Refresh</button>
        </footer>
      </section>
      <p className="note">Everyone with the site password shares this list.<br />Reload the page — your todos will still be here.</p>
    </main>
  )
}
