import { useEffect, useState } from 'react'
import { siteApi, readSession, saveSession, clearSession, configured } from './supabase'
import { Beetle, Icon } from './Icons'
import Library from './Library'
import TreeEditor from './TreeEditor'

export default function App() {
  const [session, setSession] = useState(readSession)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [opened, setOpened] = useState(null)
  useEffect(() => {
    if (!session) return
    const timer = setTimeout(() => { clearSession(); setSession(null); setOpened(null); setError('Your login expired. Please sign in again.') }, Math.max(0, Date.parse(session.expiresAt) - Date.now()))
    return () => clearTimeout(timer)
  }, [session])
  function handleError(error) {
    if (error.status === 401) { clearSession(); setSession(null); setOpened(null) }
    setError(error.message)
  }
  async function login(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try { const result = await siteApi('login', { password }); saveSession(result); setSession(result); setPassword('') }
    catch (error) { handleError(error) } finally { setBusy(false) }
  }
  if (!session) return (
    <div className="login-page">
      <div className="login-brand"><Beetle size={42} /><span>bugtree</span></div>
      <main className="login-card">
        <h1>What is the best bug?!</h1>
        <form onSubmit={login}>
          <label htmlFor="site-password">Your answer</label>
          <div className="password-field"><Beetle size={18} /><input id="site-password" type="text" autoComplete="off" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tell us your favorite bug" maxLength={256} disabled={busy} /></div>
          <button className="primary" disabled={busy || !password || !configured}>{busy ? 'Opening…' : 'Let’s go'}<Icon name="back" className="reverse" /></button>
        </form>
        {!configured && <p role="alert" className="error">Set your Supabase environment values.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <p className="login-note">We’ll remember your answer for seven days.</p>
      </main>
    </div>
  )
  return (
    <div className="app-shell">
      {opened ? <TreeEditor key={opened.chart.id} initialChart={opened.chart} initialPhotos={opened.photoUrls} initialMode={opened.mode} onBack={() => { setOpened(null); setError('') }} onAuthError={handleError} /> : (
        <>
          <nav className="site-nav"><a className="brand" href="#" onClick={(e) => e.preventDefault()}><Beetle /><span>bugtree</span></a></nav>
          <Library onOpen={setOpened} onAuthError={handleError} />
          {error && <p role="alert" className="error app-error">{error}</p>}
        </>
      )}
    </div>
  )
}
