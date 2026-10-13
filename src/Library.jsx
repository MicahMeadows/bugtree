import { useEffect, useRef, useState } from 'react'
import { siteApi } from './supabase'
import { Icon } from './Icons'
import DeleteDialog from './DeleteDialog'

function TreePreview({ count = 1 }) {
  const leaves = Math.min(4, Math.max(1, count - 1))
  return <svg className="tree-preview" viewBox="0 0 360 168" fill="none" aria-hidden="true">
    <path d="M91 84H152M152 84V39M152 39H205M152 84V128M152 128H205" stroke="#c4b5d8" strokeWidth="1.5" />
    <rect x="39" y="67" width="63" height="34" rx="6" fill="#e8dff3" stroke="#baa5d0" />
    <path d="M53 80h34M53 87h23" stroke="#a08ab9" strokeWidth="3" strokeLinecap="round" />
    {Array.from({length: leaves}, (_, i) => { const y = leaves === 1 ? 66 : 17 + i * 36; return <g key={i}><path d={`M152 84H177V${y + 15}H205`} stroke="#c4b5d8" strokeWidth="1.5" /><rect x="205" y={y} width="107" height="30" rx="5" fill={i % 2 ? '#f4ebfd' : '#eadcf6'} stroke={i % 2 ? '#d3bee8' : '#c7b1dd'} /><path d={`M217 ${y+11}h42M217 ${y+19}h27`} stroke={i % 2 ? '#b298ce' : '#ad90c5'} strokeWidth="2.5" strokeLinecap="round" /><rect x="278" y={y+5} width="26" height="20" rx="3" fill={i % 2 ? '#e6d5f5' : '#d8c0eb'} /></g> })}
  </svg>
}
export default function Library({ onOpen, onAuthError }) {
  const [charts, setCharts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingChart, setDeletingChart] = useState(null)
  const [name, setName] = useState('')
  const dialog = useRef(null)
  function fail(error) { setError(error.message); if (error.status === 401) onAuthError(error) }
  async function load() {
    setLoading(true); setError('')
    try { setCharts((await siteApi('charts-list')).data) } catch (error) { fail(error) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => { if (creating) dialog.current?.showModal() }, [creating])
  async function open(chart) {
    setBusy(true); setError('')
    try { const result = await siteApi('chart-load', { id: chart.id }); onOpen({ chart: result.data, photoUrls: result.photoUrls, mode: 'view' }) }
    catch (error) { fail(error) } finally { setBusy(false) }
  }
  async function create(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await siteApi('chart-create', { name: name.trim() }); onOpen({ chart: result.data, photoUrls: {}, mode: 'edit' }) }
    catch (error) { fail(error) } finally { setBusy(false) }
  }
  async function remove(chart) {
    setBusy(true); setError('')
    try { await siteApi('chart-delete', { id: chart.id, version: chart.version }); setCharts((charts) => charts.filter((c) => c.id !== chart.id)) }
    catch (error) { if (error.status === 401) onAuthError(error); throw error } finally { setBusy(false) }
  }
  const filtered = charts.filter((c) => `${c.name} ${c.description}`.toLowerCase().includes(search.toLowerCase()))
  return <main className="library">
    <header className="library-heading">
      <div><h1>Trees</h1></div>
      <button className="primary" onClick={() => { setCreating(true); setName(''); setError('') }} disabled={busy}><Icon name="plus" /> New tree</button>
    </header>
    <div className="library-bar"><span className="library-count"><Icon name="tree" /> {charts.length} {charts.length === 1 ? 'tree' : 'trees'}</span><div className="search-field"><Icon name="search" /><input aria-label="Search trees" placeholder="Find a tree…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="icon-button" title="Refresh library" aria-label="Refresh library" onClick={load} disabled={busy || loading}><Icon name="undo" /></button></div>
    {error && !creating && <p className="error" role="alert">{error}</p>}
    {loading ? <div className="library-empty" role="status"><h2>Loading trees…</h2></div> : charts.length === 0 ? <div className="library-empty"><div className="empty-illustration"><TreePreview count={5} /></div><h2>No trees yet</h2><button className="primary" onClick={() => setCreating(true)}><Icon name="plus" /> Create your first tree</button></div> : filtered.length === 0 ? <div className="library-empty"><h2>No matching trees.</h2><button className="quiet" onClick={() => setSearch('')}>Clear search</button></div> : <div className="chart-grid">
      {filtered.map((chart) => <article className="chart-card" key={chart.id}>
        <button className="chart-open" onClick={() => open(chart)} disabled={busy} aria-label={`Open ${chart.name} in view mode`}><div className="chart-art"><TreePreview count={chart.node_count} /></div><div className="chart-card-body"><h2>{chart.name}</h2>{chart.description && <p>{chart.description}</p>}<div className="chart-meta"><span><Icon name="tree" size={14} />{chart.node_count} {chart.node_count === 1 ? 'taxon' : 'taxa'}</span><span>Updated {new Date(chart.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div></div></button>
        <div className="chart-card-footer"><button className="icon-button" aria-label={`Delete ${chart.name}`} title="Remove tree" onClick={() => setDeletingChart(chart)} disabled={busy}><Icon name="trash" size={16} /></button></div>
      </article>)}
      <button className="new-chart-card" onClick={() => setCreating(true)} disabled={busy}><span className="plus-circle"><Icon name="plus" size={25} /></span><strong>New tree</strong></button>
    </div>}
    {deletingChart && <DeleteDialog name={deletingChart.name} kind="tree" description="This removes the entire tree from your library." onConfirm={() => remove(deletingChart)} onCancel={() => setDeletingChart(null)} />}
    {creating && <dialog ref={dialog} className="create-dialog" onCancel={(event) => { if (busy) event.preventDefault(); else setCreating(false) }} onClose={() => setCreating(false)}>
      <button className="icon-button dialog-close" aria-label="Close" disabled={busy} onClick={() => setCreating(false)}><Icon name="close" /></button><h2>New tree</h2>
      <form onSubmit={create}><label htmlFor="chart-name">Chart name</label><input id="chart-name" placeholder="e.g. Hymenoptera — families" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus disabled={busy} />{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy || !name.trim()}><Icon name="plus" />{busy ? 'Creating…' : 'Create & start editing'}</button></form>
    </dialog>}
  </main>
}
