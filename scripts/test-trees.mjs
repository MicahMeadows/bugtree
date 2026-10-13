import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { newNode, validateNodes, descendants, reorderNode } from '../supabase/functions/site-api/tree-model.js'
import { layoutTree } from '../src/tree-layout.js'
import { moveSibling, siblingDrop, isDefaultTaxon } from '../src/tree-order.js'
import { reconcileSave } from '../src/autosave.js'
import { zoomAt, wheelZoom, fitCamera, pinchCamera, MIN_ZOOM, MAX_ZOOM } from '../src/canvas-camera.js'

const id = crypto.randomUUID()
const root = newNode(null, 'Insecta', 'Class')
const a = newNode(root.id, 'Branch A', 'Order'), b = newNode(root.id, 'Branch B', 'Order'), leaf = newNode(a.id, 'Leaf', 'Family')
leaf.bullets = ['An identification detail', 'Long identification note '.repeat(12)]
const nodes = [root, a, b, leaf]
assert.equal(validateNodes(nodes, id), null)
assert.deepEqual([...descendants(nodes, a.id)], [a.id, leaf.id])
assert.equal(reorderNode(nodes, b.id, -1)[1].id, b.id)
assert.ok(validateNodes(nodes.map((n) => n.id === a.id ? { ...n, parentId: leaf.id } : n), id))
assert.ok(validateNodes([...nodes, { ...leaf }], id))
assert.ok(validateNodes(nodes.map((n) => n.id === leaf.id ? { ...n, parentId: 'missing' } : n), id))
const layout = layoutTree(nodes)
assert.equal(layout.edges.length, nodes.length - 1)
assert.equal(layout.layers.length, 3)
for (const item of layout.items) {
  assert.ok(item.x >= 0 && item.y >= 0)
  assert.ok(item.x + item.width <= layout.width && item.y + item.height <= layout.height)
  for (const other of layout.items) if (item.id !== other.id && item.depth === other.depth) assert.ok(item.y + item.height <= other.y || other.y + other.height <= item.y, 'Cards must not overlap')
}
let chain = [newNode()]
for (let i = 1; i <= 12; i++) chain.push(newNode(chain.at(-1).id))
assert.ok(validateNodes(chain, id), 'Excessively deep trees must be rejected')
const reordered = moveSibling(nodes, b.id, 0)
assert.deepEqual(reordered.filter((n) => n.parentId === root.id).map((n) => n.id), [b.id, a.id])
assert.deepEqual(reordered.map((n) => [n.id, n.parentId]).sort(), nodes.map((n) => [n.id, n.parentId]).sort(), 'Reordering must preserve every parent relationship')
assert.strictEqual(reordered.find((n) => n.id === leaf.id), leaf, 'Descendants remain attached to the original branch')
assert.strictEqual(moveSibling(nodes, root.id, 1), nodes, 'Root cannot be reordered')
assert.strictEqual(moveSibling(nodes, leaf.id, 1), nodes, 'Only child cannot be reordered')
assert.deepEqual(moveSibling(reordered, b.id, 99).filter((n) => n.parentId === root.id).map((n) => n.id), [a.id, b.id])
assert.equal(siblingDrop(layout.items, a.id, -10000).index, 0)
assert.equal(siblingDrop(layout.items, a.id, 10000).index, 1)
assert.equal(siblingDrop(layout.items, root.id, 100), null)
assert.equal(siblingDrop(layout.items, leaf.id, 100), null)
const fresh = newNode(root.id)
assert.equal(isDefaultTaxon(fresh), true)
assert.equal(isDefaultTaxon({ ...fresh, name: 'Apidae' }), false)
assert.equal(isDefaultTaxon({ ...fresh, bullets: [''] }), false)
assert.equal(isDefaultTaxon({ ...fresh, photo: 'a-photo.png' }), false)
assert.equal(isDefaultTaxon({ ...fresh, color: 'rose' }), false)
const columnLayout = layoutTree(nodes, null, 0, 'column')
const columnLeaves = columnLayout.items.filter((n) => n.isLeaf)
assert.equal(columnLeaves.length, 2)
assert.equal(new Set(columnLeaves.map((n) => n.x)).size, 1, 'All leaves must share one vertical column')
assert.equal(columnLayout.edges.length, nodes.length - 1)
assert.deepEqual(columnLayout.items.map((n) => [n.id, n.parentId]).sort(), layout.items.map((n) => [n.id, n.parentId]).sort())
const sortedLeaves = [...columnLeaves].sort((a, b) => a.y - b.y)
for (let i = 1; i < sortedLeaves.length; i++) assert.ok(sortedLeaves[i - 1].y + sortedLeaves[i - 1].height < sortedLeaves[i].y, 'Leaf cards cannot overlap')
const expanded = layoutTree(nodes, a.id, 440)
assert.equal(expanded.items.find((n) => n.id === a.id).height, 440)
for (const item of expanded.items) for (const other of expanded.items) if (item.id !== other.id && item.depth === other.depth) assert.ok(item.y + item.height <= other.y || other.y + other.height <= item.y, 'Inline editing must not overlap sibling cards')
const snapshot = { name: 'Before', nodes, version: 1 }
const saved = { ...snapshot, version: 2, updated_at: '2026-10-13T00:00:00Z' }
assert.deepEqual(reconcileSave(snapshot, snapshot, saved), { chart: saved, dirty: false })
const newerEdits = { ...snapshot, name: 'Edited while saving', nodes: [...nodes, newNode(root.id)] }
const reconciled = reconcileSave(snapshot, newerEdits, saved)
assert.equal(reconciled.dirty, true)
assert.equal(reconciled.chart.name, newerEdits.name)
assert.deepEqual(reconciled.chart.nodes, newerEdits.nodes)
assert.equal(reconciled.chart.version, 2, 'The next autosave must use the new server version')
const camera = { x: -480, y: 250, zoom: .7 }
const pointer = { x: 310, y: 185 }
const world = { x: (pointer.x - camera.x) / camera.zoom, y: (pointer.y - camera.y) / camera.zoom }
for (const zoom of [.001, .4, 1.5, 100]) {
  const next = zoomAt(camera, zoom, pointer)
  assert.ok(Math.abs((pointer.x - next.x) / next.zoom - world.x) < 1e-8, 'Zoom must keep the point under the cursor fixed')
  assert.ok(Math.abs((pointer.y - next.y) / next.zoom - world.y) < 1e-8)
  assert.ok(next.zoom >= MIN_ZOOM && next.zoom <= MAX_ZOOM)
}
assert.ok(wheelZoom(camera, -100, pointer).zoom > camera.zoom)
assert.ok(wheelZoom(camera, 100, pointer).zoom < camera.zoom)
assert.deepEqual(wheelZoom(camera, 1, pointer, 1), wheelZoom(camera, 16, pointer, 0), 'Normalize wheel line units')
assert.deepEqual(wheelZoom(camera, 1, pointer, 2, 120), wheelZoom(camera, 120, pointer, 0), 'Normalize wheel page units')
const fitted = fitCamera(1800, 3200, 1000, 800)
assert.ok(fitted.x >= 24 && fitted.y >= 24)
assert.ok(fitted.x + 1800 * fitted.zoom <= 976)
assert.ok(fitted.y + 3200 * fitted.zoom <= 776)
const pinch = pinchCamera(camera, { center: pointer, distance: 100 }, { center: { x: 360, y: 235 }, distance: 200 })
assert.equal(pinch.zoom, 1.4)
assert.ok(Math.abs((360 - pinch.x) / pinch.zoom - world.x) < 1e-8, 'Pinch must combine zoom and midpoint panning')
assert.ok(Math.abs((235 - pinch.y) / pinch.zoom - world.y) < 1e-8)
const server = await createServer({ server: { middlewareMode: true } })
try {
  const { default: TreeEditor } = await server.ssrLoadModule('/src/TreeEditor.jsx')
  const { default: NodeInspector } = await server.ssrLoadModule('/src/NodeInspector.jsx')
  const studyCard = renderToStaticMarkup(createElement(NodeInspector, { node: leaf, nodes, photos: {}, onClose() {}, onSelectAncestor() {} }))
  assert.ok(studyCard.indexOf('>Insecta</button>') < studyCard.indexOf('>Branch A</button>'))
  assert.ok(!studyCard.includes('<input') && !studyCard.includes('<textarea'))
  const chart = { id, name: 'Test tree', description: '', nodes, version: 1 }
  const props = { initialChart: chart, initialPhotos: {}, onBack() {}, onAuthError() {} }
  const edit = renderToStaticMarkup(createElement(TreeEditor, { ...props, initialMode: 'edit' }))
  const view = renderToStaticMarkup(createElement(TreeEditor, { ...props, initialMode: 'view' }))
  assert.ok(!edit.includes('Taxon editor') && !edit.includes('New bullet'), 'Edit mode starts without selecting a card')
  assert.ok(!edit.includes('More options') && !edit.includes('inline-options'))
  assert.ok(edit.includes('Reorder Branch A'))
  assert.ok(!edit.includes('Add child to Insecta'))
  assert.ok(edit.includes('Add sibling to Branch A'))
  assert.ok(!edit.includes('inline-taxon') && !edit.includes('inline-inspector'))
  const { default: InlineTaxonCard } = await server.ssrLoadModule('/src/InlineTaxonCard.jsx')
  const inline = renderToStaticMarkup(createElement(InlineTaxonCard, { node: leaf, photos: {}, onChange() {}, onPhoto() {}, onDelete() {}, onClose() {}, onHeightChange() {} }))
  assert.ok(inline.includes('Taxon editor') && inline.includes('New bullet'))
  assert.ok(edit.includes('Add child to') && edit.includes('Add sibling to'))
  assert.ok(!edit.includes('canvas-add-tools'))
  assert.ok(edit.includes('Chart name') && edit.includes('aria-pressed="true"'))
  assert.ok(!edit.includes('layer-label') && !view.includes('layer-label'))
  assert.ok(view.includes('Alignment') && view.includes('>Column</button>') && view.includes('>Graph</button>'))
  assert.ok(!edit.includes('editor-subbar') && !view.includes('editor-subbar'))
  assert.ok(view.includes('Chart mode') && !view.includes('Taxon editor') && !view.includes('New bullet'))
  console.log('PASS: tree validity, branch ordering, depth limits, non-overlapping horizontal layout, edit/view rendering, autosave reconciliation, cursor-centered wheel/pinch zoom, sibling-only ordering')
} finally { await server.close() }
