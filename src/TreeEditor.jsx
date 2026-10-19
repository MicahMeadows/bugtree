import { useEffect, useRef, useState } from 'react'
import { siteApi } from './supabase'
import { AUTOSAVE_DELAY, AUTOSAVE_RETRY_DELAY, reconcileSave } from './autosave'
import { newNode, descendants, validateNodes, MAX_NODES, COLORS } from '../supabase/functions/site-api/tree-model'
import { layoutTree } from './tree-layout'
import { insertRedirectAt, removeRedirect as unwrapRedirect, moveBranch } from './tree-routing'
import { reparentBranch } from './tree-reparent'
import { isDefaultTaxon } from './tree-order'
import { Beetle, Icon } from './Icons'
import TreeCanvas from './TreeCanvas'
import InlineTaxonCard from './InlineTaxonCard'
import DeleteDialog from './DeleteDialog'
import FlashcardQuiz from './FlashcardQuiz'

async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.')
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a photo under 25 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [.85, .65, .45]) { const data = canvas.toDataURL('image/jpeg', quality); if (data.length <= 1400000) return data }
    throw new Error('This photo is too large. Try a smaller image.')
  } finally { URL.revokeObjectURL(url) }
}
export default function TreeEditor({ initialChart, initialPhotos, initialMode, onBack, onAuthError }) {
  const [chart, setChart] = useState(initialChart)
  const [photos, setPhotos] = useState(initialPhotos || {})
  const [mode, setMode] = useState(initialMode)
  const [selectedId, setSelectedId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailure, setSaveFailure] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [deletingRedirect, setDeletingRedirect] = useState(null)
  const [deletingNode, setDeletingNode] = useState(null)
  const chartRef = useRef(chart)
  const locked = useRef(false)
  chartRef.current = chart
  const selected = chart.nodes.find((n) => n.id === selectedId)
  const layout = layoutTree(chart.nodes)
  function fail(error) { setError(error.message); if (error.status === 401) onAuthError(error) }
  useEffect(() => {
    if (!dirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  useEffect(() => {
    const timer = setInterval(async () => {
      const current = chartRef.current
      const paths = current.nodes.map((n) => n.photo).filter(Boolean)
      if (!paths.length) return
      try { const result = await siteApi('photo-urls', { id: current.id, paths }); setPhotos((photos) => ({ ...photos, ...result.photoUrls })) } catch (error) { fail(error) }
    }, 50 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!dirty || mode !== 'edit' || busy || saving || [400, 401, 404, 409].includes(saveFailure)) return
    if (!chart.name.trim() || validateNodes(chart.nodes, chart.id)) return
    const timer = setTimeout(() => { void save({ automatic: true }) }, saveFailure ? AUTOSAVE_RETRY_DELAY : AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
  }, [chart, dirty, mode, busy, saving, saveFailure])

  function change(patch, structural = false) {
    if (busy) return false
    const next = { ...chart, ...patch }
    if (structural) {
      // Allow an in-progress blank name, but still validate topology and depth.
      const invalid = validateNodes(next.nodes.map((n) => ({ ...n, name: n.name.trim() || 'Unnamed taxon' })), chart.id)
      if (invalid) { setError(invalid); return false }
    }
    setHistory((history) => [...history.slice(-29), chart])
    chartRef.current = next
    setChart(next); setDirty(true); setError('')
    setSaveFailure((status) => status === 409 || status === 404 ? status : null)
    return true
  }
  function updateNode(patch) { change({ nodes: chart.nodes.map((n) => n.id === selectedId ? { ...n, ...patch } : n) }) }
  function reparent(parentId) {
    const next = reparentBranch(chart.nodes, selectedId, parentId)
    if (next !== chart.nodes) change({ nodes: next }, true)
  }
  function add(parentId) {
    if (chart.nodes.length >= MAX_NODES) { setError('This tree has 200 taxa. Start another chart to keep it manageable.'); return }
    const parent = chart.nodes.find((n) => n.id === parentId)
    const node = newNode(parentId, 'New taxon', parent?.rank === 'Class' ? 'Order' : parent?.rank === 'Order' ? 'Family' : 'Group', chart.default_color || 'lavender')
    if (change({ nodes: [...chart.nodes, node] }, true)) setSelectedId(node.id)
  }
  function addRedirect(id, point, currentLayout) {
    const result = insertRedirectAt(chart.nodes, id, chart.default_color || 'lavender', point, currentLayout)
    if (result) change({ nodes: result.nodes }, true)
  }
  function confirmRemoveRedirect() {
    const next = unwrapRedirect(chart.nodes, deletingRedirect)
    if (next !== chart.nodes && !change({ nodes: next }, true)) throw new Error('Could not remove this redirect.')
    if (selectedId === deletingRedirect) setSelectedId(null)
  }
  function deleteBranch() {
    if (!selected || selected.parentId === null || busy) return
    const count = descendants(chart.nodes, selected.id).size
    setDeletingNode({ id: selected.id, name: selected.name.trim() || (selected.type === 'redirect' ? 'Redirect' : 'Suborder'), count, requireName: Boolean(selected.name.trim()) && (count > 1 || !isDefaultTaxon(selected, chart.default_color || 'lavender')) })
  }
  function confirmDeleteBranch() {
    const target = chart.nodes.find((n) => n.id === deletingNode.id)
    if (!target || target.parentId === null) throw new Error('This branch is no longer available.')
    const removed = descendants(chart.nodes, target.id)
    if (!change({ nodes: chart.nodes.filter((n) => !removed.has(n.id)) }, true)) throw new Error('Could not delete this branch. Please try again.')
    setSelectedId(target.parentId)
  }
  function undo() {
    if (!history.length || busy) return
    const previous = history[history.length - 1]
    const next = { ...previous, version: chart.version }
    chartRef.current = next
    setChart(next); setHistory(history.slice(0, -1)); setDirty(true); setError('')
    setSaveFailure((status) => status === 409 || status === 404 ? status : null)
    if (selectedId && !previous.nodes.some((n) => n.id === selectedId)) setSelectedId(null)
  }
  async function save({ automatic = false } = {}) {
    if (locked.current) return false
    const snapshot = chartRef.current
    const invalid = validateNodes(snapshot.nodes, snapshot.id)
    if (invalid) { if (!automatic) setError(invalid); return false }
    if (!snapshot.name.trim()) { if (!automatic) setError('Give your chart a name before saving.'); return false }
    locked.current = true; setSaving(true); if (!automatic) setBusy(true)
    setError('')
    try {
      const result = await siteApi('chart-save', { id: snapshot.id, name: snapshot.name, description: snapshot.description, default_color: snapshot.default_color || 'lavender', nodes: snapshot.nodes, version: snapshot.version })
      const next = reconcileSave(snapshot, chartRef.current, result.data)
      chartRef.current = next.chart
      setChart(next.chart); setDirty(next.dirty); setSaveFailure(null)
      return !next.dirty
    } catch (error) {
      setSaveFailure(error.status || 'network')
      fail(error)
      return false
    } finally {
      locked.current = false; setSaving(false); if (!automatic) setBusy(false)
    }
  }
  async function changeMode(next) {
    if (mode === next || locked.current) return
    if (next !== 'edit' && dirty && !await save()) return
    setMode(next)
  }
  async function back() {
    if (locked.current) return
    if (dirty && !await save()) return
    onBack()
  }
  function discardAndBack() {
    if (window.confirm('Discard your unsaved changes and return to the library?')) onBack()
  }
  async function upload(file) {
    if (locked.current) return
    const nodeId = selectedId
    locked.current = true; setBusy(true); setError('')
    try {
      const image = await preparePhoto(file)
      const result = await siteApi('photo-upload', { id: chart.id, nodeId, image })
      setPhotos((photos) => ({ ...photos, ...result.photoUrls }))
      setHistory((history) => [...history.slice(-29), chart])
      const next = { ...chartRef.current, nodes: chartRef.current.nodes.map((n) => n.id === nodeId ? { ...n, photo: result.path } : n) }
      chartRef.current = next
      setChart(next); setDirty(true)
    } catch (error) { fail(error) } finally { locked.current = false; setBusy(false) }
  }
  return <main className="editor-page">
    <header className="editor-header"><button className="back-button" onClick={back} disabled={busy || saving} title="Save and return to your trees"><Icon name="back" /><span>My trees</span></button><div className="editor-brand"><Beetle size={24} /></div><div className="chart-title">{mode === 'edit' ? <input aria-label="Chart name" value={chart.name} onChange={(e) => change({ name: e.target.value })} disabled={busy} maxLength={200} /> : <h1>{chart.name}</h1>}<span>{chart.nodes.length} taxa · {layout.layers.length} {layout.layers.length === 1 ? 'layer' : 'layers'}<span className={`save-state ${dirty ? 'unsaved' : ''}`} role="status">{saving ? 'Saving…' : busy ? 'Uploading…' : dirty ? (saveFailure ? 'Not saved' : 'Waiting to save…') : 'Saved'}</span></span></div><div className="editor-actions">{mode === 'edit' && <><div className="tree-default-color"><span>Default color</span><div className="color-options" role="group" aria-label="Tree default color">{COLORS.map((color) => <button key={color} type="button" className={`color-swatch ${color} ${(chart.default_color || 'lavender') === color ? 'chosen' : ''}`} aria-label={`${color} default color`} title={color} aria-pressed={(chart.default_color || 'lavender') === color} disabled={busy} onClick={() => change({ default_color: color })}>{(chart.default_color || 'lavender') === color ? '✓' : ''}</button>)}</div></div><button className="icon-button" title="Undo last edit" aria-label="Undo last edit" onClick={undo} disabled={busy || !history.length}><Icon name="undo" /></button><button className="primary save-button" onClick={() => save()} disabled={busy || saving || !dirty}><Icon name="save" size={16} /> Save</button></>}<div className="mode-toggle" aria-label="Chart mode"><button aria-pressed={mode === 'edit'} className={mode === 'edit' ? 'active' : ''} onClick={() => changeMode('edit')} disabled={busy || saving}><Icon name="edit" size={15} /> Edit</button><button aria-pressed={mode === 'view'} className={mode === 'view' ? 'active' : ''} onClick={() => changeMode('view')} disabled={busy || saving}><Icon name="eye" size={15} /> View</button><button aria-pressed={mode === 'flashcards'} className={mode === 'flashcards' ? 'active' : ''} onClick={() => changeMode('flashcards')} disabled={busy || saving}><Icon name="cards" size={15} /> Flash cards</button></div></div></header>
    {error && <div className="editor-error error" role="alert"><span>{error}</span><div>{dirty && <button className="text-button" onClick={discardAndBack} disabled={busy || saving}>Discard & return</button>}<button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" size={16} /></button></div></div>}
    <div className="editor-workspace">
      {mode === 'flashcards' ? <FlashcardQuiz chart={chart} photos={photos} onAuthError={onAuthError} onEdit={() => changeMode('edit')} /> : <TreeCanvas nodes={chart.nodes} photos={photos} selectedId={selectedId} onSelect={setSelectedId} mode={mode} busy={busy} onAddRedirect={addRedirect} onDeleteRedirect={setDeletingRedirect} onMoveNode={(id, dx, dy) => change({ nodes: moveBranch(chart.nodes, id, dx, dy) }, true)} onAddChild={(id) => add(id)} onAddSibling={(id) => { const parentId = chart.nodes.find((n) => n.id === id)?.parentId; if (parentId) add(parentId) }} renderEditor={(onHeightChange) => selected && <InlineTaxonCard node={selected} nodes={chart.nodes} onReparent={reparent} photos={photos} busy={busy} photoBusy={saving} onChange={updateNode} onPhoto={upload} onDelete={deleteBranch} onClose={() => setSelectedId(null)} onHeightChange={onHeightChange} />} />}
    </div>
    {deletingRedirect && <DeleteDialog name="Redirect" kind="redirect" requireName={false} description="Remove this routing point? Its child nodes and their positions will be kept. You can undo this change." onConfirm={confirmRemoveRedirect} onCancel={() => setDeletingRedirect(null)} />}
    {deletingNode && <DeleteDialog name={deletingNode.name} requireName={deletingNode.requireName} kind="branch" description={deletingNode.count > 1 ? `This deletes the card and its ${deletingNode.count - 1} descendant taxa. You can undo it while this chart is open.` : 'This deletes the card. You can undo it while this chart is open.'} onConfirm={confirmDeleteBranch} onCancel={() => setDeletingNode(null)} />}
  </main>
}
