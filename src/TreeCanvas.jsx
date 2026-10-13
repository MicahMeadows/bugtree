import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { layoutTree, NODE_WIDTH } from './tree-layout'
import { Icon } from './Icons'
import { isCircle, descendants } from '../supabase/functions/site-api/tree-model'
import antPattern from './assets/ant-pattern.svg?no-inline'
import { zoomAt, fitCamera, wheelZoom, pinchCamera } from './canvas-camera'

export default function TreeCanvas({ nodes, photos, selectedId, onSelect, mode, busy, onAddChild, onAddSibling, onMoveNode, onAddRedirect, onDeleteRedirect, renderEditor }) {
  const [layoutUnlocked, setLayoutUnlocked] = useState(false)
  useEffect(() => { setLayoutUnlocked(false); setReordering(null) }, [mode])
  const [columnOnly, setColumnOnly] = useState(false)
  const [expandedSize, setExpandedSize] = useState({ id: null, height: 0 })
  const onHeightChange = useCallback((id, height) => setExpandedSize((previous) => previous.id === id && previous.height === height ? previous : { id, height }), [])
  const layout = useMemo(() => layoutTree(nodes, mode === 'edit' && nodes.find((n) => n.id === selectedId)?.type !== 'redirect' ? selectedId : null, expandedSize.id === selectedId ? expandedSize.height : 0, columnOnly), [nodes, selectedId, mode, expandedSize, columnOnly])
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: .8 })
  const [panning, setPanning] = useState(false)
  const [reordering, setReordering] = useState(null)
  const canMove = mode === 'edit' && layoutUnlocked && !columnOnly && !busy
  const viewport = useRef(null)
  const cameraRef = useRef(camera)
  const layoutRef = useRef(layout)
  const size = useRef({ width: 0, height: 0 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const didFit = useRef(false)
  layoutRef.current = layout
  function updateCamera(next) { cameraRef.current = next; setCamera(next) }
  function startingCamera(tree, width, height) {
    const first = tree.items.find((item) => item.isLeaf)
    if (!first) return fitCamera(tree.width, tree.height, width, height)
    const zoom = Math.min(1, Math.max(.1, (width - 48) / NODE_WIDTH))
    return { zoom, x: width - 40 - (first.x + first.width) * zoom, y: 32 - first.y * zoom }
  }
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
        updateCamera(startingCamera(tree, width, height))
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
    if (!item || !el || item.type === 'redirect') return
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
      gesture.current = { type: canMove && node ? 'move' : 'pan', start, camera: cameraRef.current, moved: false, nodeId, items: layout.items }
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
    } else if (active.type === 'move' && canMove) {
      if (Math.hypot(current.x - active.start.x, current.y - active.start.y) > 4) active.moved = true
      if (active.moved) setReordering({ nodeId: active.nodeId, offsetX: (current.x - active.start.x) / active.camera.zoom, offsetY: (current.y - active.start.y) / active.camera.zoom })
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
    if (!cancelled && canMove && active?.type === 'move' && active.moved) {
      const current = point(event)
      onMoveNode(active.nodeId, (current.x - active.start.x) / active.camera.zoom, (current.y - active.start.y) / active.camera.zoom)
    }
    if (!cancelled && ['pan', 'move'].includes(active?.type) && !active.moved && active.nodeId) onSelect(active.nodeId)
    if (!cancelled && active?.type === 'pan' && !active.moved && !active.nodeId) onSelect(null)
    setReordering(null)
    if (pointers.current.size === 1) {
      gesture.current = { type: 'pan', start: [...pointers.current.values()][0], camera: cameraRef.current, moved: true, nodeId: null }
    } else if (pointers.current.size >= 2) {
      gesture.current = { type: 'pinch', start: pinchPoints(), camera: cameraRef.current, moved: true }
    } else { gesture.current = null; setPanning(false) }
  }
  const movingBranch = reordering?.offsetX !== undefined ? descendants(nodes, reordering.nodeId) : new Set(reordering ? [reordering.nodeId] : [])
  function connection(edge) {
    if (reordering?.offsetX === undefined) return edge.d
    const child = layout.items.find((n) => n.id === edge.id)
    const parent = layout.items.find((n) => n.id === child.parentId)
    const position = (n) => ({ x: n.x + (movingBranch.has(n.id) ? reordering.offsetX : 0), y: n.y + (movingBranch.has(n.id) ? reordering.offsetY : 0) })
    const a = position(parent), b = position(child), sx = a.x + (parent.type === 'redirect' ? parent.width / 2 : parent.width)
    return `M ${sx} ${a.y + parent.height / 2} H ${sx + 45} V ${b.y + child.height / 2} H ${b.x + (child.type === 'redirect' ? child.width / 2 : -6)}`
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
          <svg className="tree-connections" width={layout.width} height={layout.height} aria-hidden={mode === 'edit' ? undefined : true}><defs><marker id="branch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#9b89b2" /></marker></defs>{layout.edges.map((edge) => <g key={edge.id}><path d={connection(edge)} fill="none" stroke="#9b89b2" strokeWidth="1.6" strokeLinejoin="round" markerEnd={nodes.find((n) => n.id === edge.id)?.type === 'redirect' ? undefined : 'url(#branch-arrow)'} />{mode === 'edit' && !columnOnly && <path className="connector-hit-area" d={connection(edge)} fill="none" stroke="transparent" strokeWidth="16" role="button" tabIndex={0} aria-label="Add redirect on this branch" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); if (busy) return; const p = point(e); onAddRedirect(edge.id, { x: (p.x - cameraRef.current.x) / cameraRef.current.zoom, y: (p.y - cameraRef.current.y) / cameraRef.current.zoom }, layout) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) { const child = layout.items.find((n) => n.id === edge.id); onAddRedirect(edge.id, { x: child.x - 45, y: child.y + child.height / 2 }, layout) } } }}><title>Click to add redirect</title></path>}</g>)}</svg>
          {layout.items.filter((node) => mode === 'edit' || node.type !== 'redirect').map((node) => <div key={node.id} role={mode === 'edit' && node.type !== 'redirect' && selectedId === node.id ? 'group' : 'button'} tabIndex={0} aria-label={`${node.name || (node.type === 'redirect' ? 'Redirect' : 'Simple Node')}${node.rank && node.rank.trim().toLowerCase() !== 'group' ? `, ${node.rank}` : ''}. ${mode === 'edit' ? 'Edit taxon' : 'Read study notes'}`} aria-pressed={mode === 'edit' && node.type !== 'redirect' && selectedId === node.id ? undefined : selectedId === node.id} data-node-id={node.id} title={isCircle(node) && node.type !== 'redirect' ? node.name || 'Simple Node' : undefined} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(node.id) } }} className={`taxon-card ${node.color} ${node.type === 'redirect' ? `redirect-node ${canMove ? 'draggable' : ''}` : ''} ${isCircle(node) && !(mode === 'edit' && node.type !== 'redirect' && selectedId === node.id) ? 'circle-node' : ''} ${node.photo || node.bullets.length ? 'detailed' : 'group-node'} ${selectedId === node.id ? 'selected' : ''} ${mode === 'edit' && node.type !== 'redirect' && selectedId === node.id ? 'editing-card' : ''} ${reordering?.nodeId === node.id ? 'reordering-card' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height, transform: movingBranch.has(node.id) ? `translate(${reordering.offsetX || 0}px, ${reordering.offsetY}px)` : undefined }}>
            {canMove && node.type !== 'redirect' && <button data-reorder-handle className="card-drag-handle" disabled={busy} aria-label={`Move ${node.name || 'Simple Node'} and children`} title="Drag to move this branch"><span>⠿</span></button>}
            {node.type === 'redirect' && selectedId === node.id && <button className="redirect-delete" disabled={busy} aria-label="Delete redirect" title="Delete redirect" onClick={() => onDeleteRedirect(node.id)}>×</button>}
            {mode === 'edit' && node.type !== 'redirect' && selectedId === node.id ? renderEditor?.(onHeightChange) : <>
            {!isCircle(node) && <div className="taxon-label">{node.rank && node.rank.trim().toLowerCase() !== 'group' && <span>{node.rank}</span>}<h3>{node.name || 'Unnamed taxon'}</h3></div>}
            {!isCircle(node) && (node.photo || node.bullets.length > 0) && <div className={`taxon-content ${node.photo ? 'has-photo' : ''}`}>
              <ul>{node.bullets.map((point, index) => <li key={index}>{point || <span className="muted">New identification note</span>}</li>)}</ul>
              {node.photo && <div className="taxon-photo">{photos[node.photo] ? <img src={photos[node.photo]} alt={node.photoAlt || node.name} draggable={false} /> : <div className="photo-placeholder"><Icon name="image" /><span>Photo unavailable</span></div>}</div>}
            </div>}
            {mode === 'edit' && !isCircle(node) && <span className="node-edit-hint"><Icon name="edit" size={13} /></span>}
            </>}
          </div>)}
          {mode === 'edit' && layout.items.filter((n) => n.type !== 'redirect').map((node) => <div className="branch-add-markers" key={`add-${node.id}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
            {!nodes.some((child) => child.parentId === node.id) && <button className="branch-plus child-plus" style={{ left: node.width + 22, top: node.height / 2 - 13 }} disabled={busy || nodes.length >= 200} aria-label={`Add child to ${node.name}`} title={`Add child to ${node.name}`} onClick={() => onAddChild(node.id)}>+</button>}
            {node.parentId !== null && <button className="branch-plus sibling-plus" style={{ left: node.width / 2 - 13, top: node.height + 3 }} disabled={busy || nodes.length >= 200} aria-label={`Add sibling to ${node.name}`} title={`Add sibling to ${node.name}`} onClick={() => onAddSibling(node.id)}>+</button>}
          </div>)}
        </div>
    </div>
    <div className="canvas-controls">{mode === 'edit' && <><button className={`layout-lock-toggle ${layoutUnlocked ? 'active' : ''}`} aria-pressed={layoutUnlocked} disabled={busy || columnOnly || Boolean(reordering)} title={columnOnly ? 'Turn off Column mode to move nodes' : layoutUnlocked ? 'Lock node positions' : 'Unlock node dragging'} onClick={() => { if (!pointers.current.size) setLayoutUnlocked(!layoutUnlocked) }}><Icon name={layoutUnlocked ? 'unlock' : 'lock'} size={14} />{layoutUnlocked ? 'Lock layout' : 'Unlock layout'}</button><span className="control-divider" /></>}<button className={`column-mode-toggle ${columnOnly ? 'active' : ''}`} aria-pressed={columnOnly} title={columnOnly ? 'Restore saved positions and redirects' : 'Hide redirects and show aligned columns'} disabled={Boolean(reordering)} onClick={() => { if (pointers.current.size) return; setColumnOnly(!columnOnly) }}>Column</button><span className="control-divider" /><button className="icon-button" aria-label="Zoom out" onClick={() => zoomCenter(1 / 1.2)}>−</button><span>{Math.round(camera.zoom * 100)}%</span><button className="icon-button" aria-label="Zoom in" onClick={() => zoomCenter(1.2)}>+</button><span className="control-divider" /><button className="icon-button" aria-label="Fit tree to screen" title="Fit tree to screen" onClick={fit}><Icon name="fit" /></button></div>
  </div>
}
