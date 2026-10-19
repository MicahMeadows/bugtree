import { useEffect, useMemo, useRef, useState } from 'react'
import { siteApi } from './supabase'
import { combineFlashcardTrees, flashcardDeck } from './flashcard-deck'
import Flashcards from './Flashcards'

export default function FlashcardQuiz({ chart, photos, onEdit, onAuthError }) {
  const [trees, setTrees] = useState([{ id: chart.id, name: chart.name }])
  const [selected, setSelected] = useState([chart.id])
  const [loaded, setLoaded] = useState({})
  const [pending, setPending] = useState({})
  const [errors, setErrors] = useState({})
  const [listError, setListError] = useState('')
  const [listing, setListing] = useState(true)
  const alive = useRef(true)
  const requests = useRef(new Map())
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function fail(error) { if (error.status === 401) onAuthError?.(error) }
  async function listTrees() {
    setListing(true); setListError('')
    try {
      const result = await siteApi('charts-list')
      if (alive.current) setTrees([{ id: chart.id, name: chart.name }, ...result.data.filter((tree) => tree.id !== chart.id)])
    } catch (error) { if (alive.current) { setListError(error.message); fail(error) } }
    finally { if (alive.current) setListing(false) }
  }
  async function loadTree(id) {
    if (requests.current.has(id)) return requests.current.get(id)
    setPending((current) => ({ ...current, [id]: true }))
    setErrors((current) => ({ ...current, [id]: '' }))
    const request = (async () => {
      try {
        const result = await siteApi('chart-load', { id })
        if (alive.current) setLoaded((current) => ({ ...current, [id]: { chart: result.data, photos: result.photoUrls, loadedAt: Date.now() } }))
      } catch (error) { if (alive.current) { setErrors((current) => ({ ...current, [id]: error.message })); fail(error) } }
      finally { requests.current.delete(id); if (alive.current) setPending((current) => ({ ...current, [id]: false })) }
    })()
    requests.current.set(id, request)
    return request
  }
  useEffect(() => { void listTrees() }, [])
  useEffect(() => {
    for (const id of selected) if (id !== chart.id && (!loaded[id] || Date.now() - loaded[id].loadedAt >= 50 * 60 * 1000) && !errors[id]) void loadTree(id)
    const timer = setInterval(() => { for (const id of selected) if (id !== chart.id) void loadTree(id) }, 50 * 60 * 1000)
    return () => clearInterval(timer)
  }, [selected, chart.id])
  const included = selected.map((id) => id === chart.id ? { chart, photos } : loaded[id]).filter(Boolean)
  const waitingForCards = !included.length && selected.some((id) => !errors[id])
  const combined = useMemo(() => combineFlashcardTrees(included), [chart, photos, selected, loaded])
  // Restart the quiz when its selected trees finish loading or change versions.
  const deckKey = included.map(({ chart: tree }) => `${tree.id}:${tree.version}`).join('|')
  return <div className="flashcards-workspace">
    <aside className="flashcards-tree-picker" aria-label="Trees in flash card quiz">
      <h2>Trees</h2>
      {listing && <p className="field-help" role="status">Loading trees…</p>}
      {listError && <div className="error" role="alert">{listError}<button className="quiet" onClick={listTrees}>Retry</button></div>}
      <div className="flashcards-tree-list">{trees.map((tree) => {
        const data = tree.id === chart.id ? chart : loaded[tree.id]?.chart
        return <div className="flashcards-tree-option" key={tree.id}>
          <label><input type="checkbox" checked={selected.includes(tree.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, tree.id] : current.filter((id) => id !== tree.id))} /><span>{tree.id === chart.id ? chart.name : tree.name}{data && <small>{flashcardDeck(data.nodes).length} cards</small>}</span></label>
          {selected.includes(tree.id) && pending[tree.id] && <small role="status">Loading cards…</small>}
          {selected.includes(tree.id) && errors[tree.id] && <div className="error" role="alert">{errors[tree.id]}<button className="quiet" onClick={() => loadTree(tree.id)}>Retry</button></div>}
        </div>
      })}</div>
    </aside>
    {!selected.length ? <section className="flashcards flashcards-empty"><h2>Select trees to study</h2></section> : waitingForCards ? <section className="flashcards flashcards-empty" role="status">Loading cards…</section> : <Flashcards key={deckKey} nodes={combined.nodes} photos={combined.photos} onEdit={onEdit} />}
  </div>
}
