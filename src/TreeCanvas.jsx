import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { layoutTree, NODE_WIDTH, COLUMN_GAP } from './tree-layout'
import { Icon } from './Icons'
import { siblingDrop } from './tree-order'
import antPattern from './assets/ant-pattern.svg?no-inline'
import { zoomAt, fitCamera, wheelZoom, pinchCamera } from './canvas-camera'

export default function TreeCanvas({ nodes, photos, selectedId, onSelect, mode, busy, onAddChild, onAddSibling, onReorder, renderEditor }) {
  const [expandedSize, setExpandedSize] = useState({ id: null, height: 0 })
  const onHeightChange = useCallback((id, height) => setExpandedSize((previous) => previous.id === id && previous.height === height ? previous : { id, height }), [])
  const layout = useMemo(() => layoutTree(nodes, mode === 'edit' ? selectedId : null, expandedSize.id === selectedId ? expandedSize.height : 0), [nodes, selectedId, mode, expandedSize])
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: .8 })
  const [panning, setPanning] = useState(false)
  const [reordering, setReordering] = useState(null)
  const viewport = useRef(null)
  const cameraRef = useRef(camera)
  const layoutRef = useRef(layout)
  const size = useRef({ width: 0, height: 0 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const didFit = useRef(false)
  layoutRef.current = layout
  function updateCamera(next) { cameraRef.current = next; setCamera(next) }
  function fit() {
    const el = viewport.current
    if (el) updateCamera(fitCamera(layout.width, layout.height, el.clientWidth, el.clientHeight))
  }
  function zoomCenter(factor) {
    const el = viewport.current
    if (el) updateCamera(zoomAt(cameraRef.current, cameraRef.current.zoom * factor, { x: el.clientWidth / 2, y: el.clientHeight / 2 }))
  }
  useEffect(() => {
    const el = viewport.current
    function measure() {
      const width = el.clientWidth, height = el.clientHeight
      if (!width || !height) return
      if (!didFit.current) {
        const tree = layoutRef.current
        updateCamera(fitCamera(tree.width, tree.height, width, height))
        didFit.current = true
      } else {
        const current = cameraRef.current
        updateCamera({ ...current, x: current.x + (width - size.current.width) / 2, y: current.y + (height - size.current.height) / 2 })
      }
      size.current = { width, height }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    function wheel(event) {
      if (event.target.closest('textarea, select') && !event.ctrlKey) return
      event.preventDefault()
      if (pointers.current.size) return
      const rect = el.getBoundingClientRect()
      updateCamera(wheelZoom(cameraRef.current, event.deltaY || event.deltaX, { x: event.clientX - rect.left, y: event.clientY - rect.top }, event.deltaMode, el.clientHeight))
    }
    // React wheel listeners are passive; attach directly so canvas zoom replaces page scrolling.
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { observer.disconnect(); el.removeEventListener('wheel', wheel) }
  }, [])
  useEffect(() => {
    if (mode !== 'edit' || !selectedId || !didFit.current) return
    const item = layout.items.find((n) => n.id === selectedId)
    const el = viewport.current, current = cameraRef.current
    if (!item || !el) return
    const zoom = Math.max(current.zoom, Math.min(1, (el.clientHeight - 100) / item.height))
    updateCamera({ zoom, x: el.clientWidth / 2 - (item.x + item.width / 2) * zoom, y: 60 + (el.clientHeight - 100 - item.height * zoom) / 2 - item.y * zoom })
  }, [selectedId, mode])
  function point(event) {
    const rect = viewport.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  function pinchPoints() {
    const [a, b] = [...pointers.current.values()]
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(b.x - a.x, b.y - a.y) }
  }
  function pointerDown(event) {
    const handle = event.target.closest('[data-reorder-handle]')
    if (!handle && event.target.closest('[data-card-editor], button, input, textarea, select, label')) return
    if (event.button !== 0 && event.button !== 1) return
    event.preventDefault()
    const start = point(event)
    pointers.current.set(event.pointerId, start)
    viewport.current.setPointerCapture(event.pointerId)
    if (pointers.current.size === 1) {
      const nodeId = event.button === 0 ? event.target.closest('.taxon-card')?.dataset.nodeId : null
      const node = nodes.find((n) => n.id === nodeId)
      const sortable = mode === 'edit' && !busy && node?.parentId !== null && node && nodes.filter((n) => n.parentId === node.parentId).length > 1
      gesture.current = { type: sortable ? 'reorder' : 'pan', start, camera: cameraRef.current, moved: false, nodeId, items: layout.items }
      if (handle) event.target.blur()
    } else if (pointers.current.size === 2) {
      gesture.current = { type: 'pinch', start: pinchPoints(), camera: cameraRef.current, moved: true }
      setReordering(null)
      setPanning(true)
    }
  }
  function pointerMove(event) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    const current = point(event)
    pointers.current.set(event.pointerId, current)
    const active = gesture.current
    if (active.type === 'pinch' && pointers.current.size >= 2) {
      updateCamera(pinchCamera(active.camera, active.start, pinchPoints()))
    } else if (active.type === 'reorder') {
      const dy = current.y - active.start.y
      if (Math.abs(dy) > 4) active.moved = true
      if (active.moved) {
        const worldY = (current.y - active.camera.y) / active.camera.zoom
        setReordering({ nodeId: active.nodeId, offsetY: dy / active.camera.zoom, drop: siblingDrop(active.items, active.nodeId, worldY) })
      }
    } else if (active.type === 'pan') {
      const dx = current.x - active.start.x, dy = current.y - active.start.y
      if (Math.hypot(dx, dy) > 4) active.moved = true
      if (active.moved) { setPanning(true); updateCamera({ ...active.camera, x: active.camera.x + dx, y: active.camera.y + dy }) }
    }
  }
  function pointerUp(event, cancelled = false) {
    if (!pointers.current.has(event.pointerId)) return
    const active = gesture.current
    pointers.current.delete(event.pointerId)
    if (viewport.current.hasPointerCapture(event.pointerId)) viewport.current.releasePointerCapture(event.pointerId)
    if (!cancelled && active?.type === 'reorder' && active.moved) {
      const current = point(event)
      const drop = siblingDrop(active.items, active.nodeId, (current.y - active.camera.y) / active.camera.zoom)
      if (drop) onReorder(active.nodeId, drop.index)
    }
    if (!cancelled && ['pan', 'reorder'].includes(active?.type) && !active.moved && active.nodeId) onSelect(active.nodeId)
    setReordering(null)
    if (pointers.current.size === 1) {
      gesture.current = { type: 'pan', start: [...pointers.current.values()][0], camera: cameraRef.current, moved: true, nodeId: null }
    } else if (pointers.current.size >= 2) {
      gesture.current = { type: 'pinch', start: pinchPoints(), camera: cameraRef.current, moved: true }
    } else { gesture.current = null; setPanning(false) }
  }
  const grid = 48 * camera.zoom
  const fadeProgress = Math.max(0, Math.min(1, (camera.zoom - .7) / .6))
  const dotOpacity = 1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress)
  const patternPosition = `${camera.x}px ${camera.y}px`
  const patternSize = `${grid}px ${grid}px`
  return <div className="canvas-shell">

    <div className={`canvas ${panning ? 'panning' : ''}`} ref={viewport} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={(event) => pointerUp(event, true)} onLostPointerCapture={(event) => pointerUp(event, true)}>
        <div className="canvas-pattern" aria-hidden="true" style={{ backgroundImage: `url("${antPattern}")`, backgroundPosition: patternPosition, backgroundSize: patternSize, opacity: 1 - dotOpacity }} />
        <div className="canvas-pattern" aria-hidden="true" style={{ backgroundImage: `radial-gradient(circle at 50% 50%, #838584 ${2.4 * camera.zoom}px, transparent ${3 * camera.zoom}px)`, backgroundPosition: patternPosition, backgroundSize: patternSize, opacity: dotOpacity }} />
        <div className="tree-stage" style={{ width: layout.width, height: layout.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          {layout.layers.map((label, depth) => <div className="layer-label" key={depth} style={{ left: 72 + depth * (NODE_WIDTH + COLUMN_GAP), width: NODE_WIDTH }}><span>LAYER {depth + 1}</span><strong>{label}</strong></div>)}
          <svg className="tree-connections" width={layout.width} height={layout.height} aria-hidden="true"><defs><marker id="branch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#9b89b2" /></marker></defs>{layout.edges.map((edge) => <path key={edge.id} d={edge.d} fill="none" stroke="#9b89b2" strokeWidth="1.6" strokeLinejoin="round" markerEnd="url(#branch-arrow)" />)}</svg>
          {layout.items.map((node) => <div key={node.id} role={mode === 'edit' && selectedId === node.id ? 'group' : 'button'} tabIndex={0} aria-label={`${node.name}${node.rank && node.rank.trim().toLowerCase() !== 'group' ? `, ${node.rank}` : ''}. ${mode === 'edit' ? 'Edit taxon' : 'Read study notes'}`} aria-pressed={mode === 'edit' && selectedId === node.id ? undefined : selectedId === node.id} data-node-id={node.id} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(node.id) } }} className={`taxon-card ${node.color} ${node.photo || node.bullets.length ? 'detailed' : 'group-node'} ${selectedId === node.id ? 'selected' : ''} ${mode === 'edit' && selectedId === node.id ? 'editing-card' : ''} ${reordering?.nodeId === node.id ? 'reordering-card' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height, transform: reordering?.nodeId === node.id ? `translateY(${reordering.offsetY}px)` : undefined }}>
            {mode === 'edit' && node.parentId !== null && nodes.filter((n) => n.parentId === node.parentId).length > 1 && <button data-reorder-handle className="card-drag-handle" disabled={busy} aria-label={`Reorder ${node.name}`} title="Drag to reorder; arrow keys move up or down" onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); const siblings = nodes.filter((n) => n.parentId === node.parentId); onReorder(node.id, siblings.findIndex((n) => n.id === node.id) + (event.key === 'ArrowUp' ? -1 : 1)) } }}><span>⠿</span></button>}
            {mode === 'edit' && selectedId === node.id ? renderEditor?.(onHeightChange) : <>
            <div className="taxon-label">{node.rank && node.rank.trim().toLowerCase() !== 'group' && <span>{node.rank}</span>}<h3>{node.name || 'Unnamed taxon'}</h3></div>
            {(node.photo || node.bullets.length > 0) && <div className={`taxon-content ${node.photo ? 'has-photo' : ''}`}>
              <ul>{node.bullets.map((point, index) => <li key={index}>{point || <span className="muted">New identification note</span>}</li>)}</ul>
              {node.photo && <div className="taxon-photo">{photos[node.photo] ? <img src={photos[node.photo]} alt={node.photoAlt || node.name} draggable={false} /> : <div className="photo-placeholder"><Icon name="image" /><span>Photo unavailable</span></div>}</div>}
            </div>}
            {mode === 'edit' && <span className="node-edit-hint"><Icon name="edit" size={13} /></span>}
            </>}
          </div>)}
          {reordering?.drop && <div className="sibling-drop-line" style={{ left: reordering.drop.x - 8, top: reordering.drop.y, width: reordering.drop.width + 16 }} />}
          {mode === 'edit' && layout.items.map((node) => <div className="branch-add-markers" key={`add-${node.id}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
            {!nodes.some((child) => child.parentId === node.id) && <button className="branch-plus child-plus" style={{ left: node.width + 22, top: node.height / 2 - 13 }} disabled={busy || nodes.length >= 200} aria-label={`Add child to ${node.name}`} title={`Add child to ${node.name}`} onClick={() => onAddChild(node.id)}>+</button>}
            {node.parentId !== null && <button className="branch-plus sibling-plus" style={{ left: node.width / 2 - 13, top: node.height + 3 }} disabled={busy || nodes.length >= 200} aria-label={`Add sibling to ${node.name}`} title={`Add sibling to ${node.name}`} onClick={() => onAddSibling(node.id)}>+</button>}
          </div>)}
        </div>
    </div>
    <div className="canvas-controls"><button className="icon-button" aria-label="Zoom out" onClick={() => zoomCenter(1 / 1.2)}>−</button><span>{Math.round(camera.zoom * 100)}%</span><button className="icon-button" aria-label="Zoom in" onClick={() => zoomCenter(1.2)}>+</button><span className="control-divider" /><button className="icon-button" aria-label="Fit tree to screen" title="Fit tree to screen" onClick={fit}><Icon name="fit" /></button></div>
  </div>
}
