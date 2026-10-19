import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { newNode, isCircle, validateNodes, descendants, reorderNode } from '../supabase/functions/site-api/tree-model.js'
import { layoutTree } from '../src/tree-layout.js'
import { moveSibling, siblingDrop, isDefaultTaxon } from '../src/tree-order.js'
import { insertRedirect, insertRedirectAt, removeRedirect, moveRedirect, moveBranch } from '../src/tree-routing.js'
import { parentOptions, reparentBranch } from '../src/tree-reparent.js'
import { flashcardDeck, shuffleCards, combineFlashcardTrees } from '../src/flashcard-deck.js'
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
const coloredFresh = newNode(root.id, 'New taxon', 'Group', 'sage')
assert.equal(coloredFresh.color, 'sage')
assert.equal(isDefaultTaxon(coloredFresh, 'sage'), true)
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
const circle = { ...newNode(root.id, '', 'Group', 'sage'), type: 'simple' }
assert.equal(isCircle(circle), true)
assert.equal(isCircle({ ...circle, type: 'taxon', rank: 'Suborder', name: 'Named suborder' }), false, 'Suborder is a rank, not a circle style')
assert.equal(isCircle({ ...circle, type: 'suborder' }), true, 'Legacy simple nodes retain their shape')
assert.equal(validateNodes([root, circle], id), null)
assert.equal(isCircle({ ...circle, name: 'Named suborder' }), true)
assert.ok(validateNodes([root, { ...circle, type: 'taxon', rank: 'Family' }], id))
const routed = insertRedirect(nodes, a.id, 'sage')
assert.equal(validateNodes(routed.nodes, id), null)
assert.equal(routed.nodes.find((n) => n.id === a.id).parentId, routed.redirect.id)
const twice = insertRedirect(routed.nodes, a.id, 'sage')
assert.equal(validateNodes(twice.nodes, id), null)
const beforeMove = layoutTree(twice.nodes)
const moved = layoutTree(moveRedirect(twice.nodes, routed.redirect.id, 120, 80))
for (const childId of [routed.redirect.id, twice.redirect.id, a.id, leaf.id]) {
  const before = beforeMove.items.find((n) => n.id === childId), after = moved.items.find((n) => n.id === childId)
  assert.equal(after.x - before.x, 120, 'Redirect moves the entire subsection horizontally')
  assert.equal(after.y - before.y, 80, 'Redirect moves the entire subsection vertically')
}
assert.deepEqual(removeRedirect(routed.nodes, routed.redirect.id).map(n=>[n.id,n.parentId]), nodes.map(n=>[n.id,n.parentId]), 'Removing routing point preserves descendants')
assert.ok(validateNodes(routed.nodes.map((n) => n.id === routed.redirect.id ? { ...n, offsetX: Infinity } : n), id))
const freelyMoved = layoutTree(moveBranch(nodes, a.id, 75, 65))
for (const childId of [a.id, leaf.id]) {
  const previous = layout.items.find(n=>n.id===childId), next = freelyMoved.items.find(n=>n.id===childId)
  assert.equal(next.x - previous.x, 75)
  assert.equal(next.y - previous.y, 65)
}
const negativeMove = layoutTree(moveBranch(nodes, root.id, -500, -300))
for (const child of layout.items) {
 const next = negativeMove.items.find(n=>n.id===child.id)
 assert.equal(next.x - child.x,-500,'Dragging must allow negative coordinates')
 assert.equal(next.y - child.y,-300)
}
const clickedPoint = { x: 450, y: 210 }
const onLine = insertRedirectAt(nodes, a.id, 'sage', clickedPoint)
const insertedLayout = layoutTree(onLine.nodes)
const insertedPoint = insertedLayout.items.find(n=>n.id===onLine.redirect.id)
assert.equal(insertedPoint.x + insertedPoint.width / 2, clickedPoint.x)
assert.equal(insertedPoint.y + insertedPoint.height / 2, clickedPoint.y)
for (const childId of [a.id, leaf.id]) {
  const previous=layout.items.find(n=>n.id===childId), next=insertedLayout.items.find(n=>n.id===childId)
  assert.equal(next.x,previous.x,'Inserting on a line keeps child positions')
  assert.equal(next.y,previous.y)
}
const removedLayout = layoutTree(removeRedirect(onLine.nodes,onLine.redirect.id))
for (const childId of [a.id,leaf.id]) {
 const previous=insertedLayout.items.find(n=>n.id===childId),next=removedLayout.items.find(n=>n.id===childId)
 assert.equal(next.x,previous.x,'Deleting redirect preserves positions');assert.equal(next.y,previous.y)
}
const circleLayout=layoutTree([root,circle])
assert.equal(circleLayout.items.find(n=>n.id===circle.id).width,48)
assert.equal(circleLayout.items.find(n=>n.id===circle.id).height,48)
assert.equal(insertedPoint.width,24)
const positioned = moveBranch(twice.nodes, a.id, 155, 90)
const beforeColumn = JSON.stringify(positioned)
const cleanColumn = layoutTree(positioned, null, 0, true)
assert.ok(cleanColumn.items.every(n=>n.type !== 'redirect'))
assert.deepEqual(cleanColumn.items.map(n=>[n.id,n.parentId,n.x,n.y,n.width,n.height]).sort(), layout.items.map(n=>[n.id,n.parentId,n.x,n.y,n.width,n.height]).sort(), 'Column toggle restores the original layout without redirects or offsets')
assert.equal(JSON.stringify(positioned),beforeColumn,'Column mode must not change saved positions or routing')
const adopted = reparentBranch(nodes, a.id, b.id)
assert.equal(adopted.find(n=>n.id===a.id).parentId,b.id)
assert.strictEqual(adopted.find(n=>n.id===leaf.id),leaf,'Descendant data and parent links must survive moving the branch')
assert.equal(validateNodes(adopted,id),null)
assert.strictEqual(reparentBranch(nodes,a.id,leaf.id),nodes,'Cannot reparent under a descendant')
assert.strictEqual(reparentBranch(nodes,a.id,a.id),nodes,'Cannot reparent under itself')
assert.strictEqual(reparentBranch(nodes,root.id,b.id),nodes,'The root cannot change parents')
assert.strictEqual(reparentBranch(nodes,a.id,'missing'),nodes)
assert.deepEqual(parentOptions(nodes,a.id).map(n=>n.id),[b.id])
const positionedBranch = moveBranch(nodes,a.id,150,100)
const repositioned = reparentBranch(positionedBranch,a.id,b.id).find(n=>n.id===a.id)
assert.equal(repositioned.offsetX,0);assert.equal(repositioned.offsetY,0)
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
const studyNodes = [{ ...root }, { ...a, name: 'Hidden taxon answer', photo: 'test-photo', bullets: ['Distinctive wing venation', 'Elbowed antennae', ''] }, { ...b, photo: 'second-photo' }, { ...leaf }]
assert.deepEqual(flashcardDeck(studyNodes).map((n) => n.id), [a.id, b.id], 'Skip cards without photos')
const secondTreeNode = { ...a, name: 'Second tree insect', photo: 'second-tree-photo' }
const firstTree = { chart: { id: 'first-tree', nodes: studyNodes }, photos: { 'test-photo': 'first-url' } }
const secondTree = { chart: { id: 'second-tree', nodes: [secondTreeNode] }, photos: { 'second-tree-photo': 'second-url' } }
const mixedQuiz = combineFlashcardTrees([firstTree, secondTree, firstTree])
assert.equal(flashcardDeck(mixedQuiz.nodes).length, 3, 'Selected trees combine without duplicate trees')
assert.equal(new Set(mixedQuiz.nodes.map(n=>n.id)).size, mixedQuiz.nodes.length, 'Same node IDs in different trees remain distinct quiz cards')
assert.equal(mixedQuiz.photos['second-tree-photo'],'second-url')
assert.equal(flashcardDeck(combineFlashcardTrees([secondTree]).nodes).length,1,'Unchecking a tree removes all of its cards')
assert.deepEqual(combineFlashcardTrees([]),{nodes:[],photos:{}})
assert.equal(secondTreeNode.id,a.id,'Combining decks does not change source nodes')
const shuffled = shuffleCards(flashcardDeck(studyNodes), () => 0)
assert.deepEqual(shuffled.map((n) => n.id), [b.id, a.id])
assert.deepEqual(flashcardDeck(studyNodes).map((n) => n.id), [a.id, b.id], 'Shuffle cannot modify the tree order')
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
  const flash = renderToStaticMarkup(createElement(TreeEditor, { ...props, initialChart: { ...chart, nodes: studyNodes }, initialPhotos: { 'test-photo': 'https://example.com/photo.png', 'second-photo': 'https://example.com/photo2.png' }, initialMode: 'flashcards' }))
  assert.ok(flash.includes('Trees in flash card quiz') && flash.includes('type="checkbox"') && flash.includes('Test tree'))
  assert.ok(flash.includes('Flash cards') && flash.includes('Card 1 of 2'))
  assert.ok(flash.includes('Insect to identify') && flash.includes('Tap to reveal the name'))
  assert.ok(flash.includes('Distinctive wing venation') && flash.includes('Elbowed antennae'), 'Identification details are visible before revealing the name')
  assert.ok(!flash.includes('<li></li>'), 'Blank notes should not appear')
  assert.ok(!flash.includes('Hidden taxon answer'), 'The answer cannot leak in the initial flash card markup or image alt text')
  assert.ok(!flash.includes('tree-stage'), 'Flash cards replace the graph')
  const emptyStudy = renderToStaticMarkup(createElement(TreeEditor, { ...props, initialMode: 'flashcards' }))
  assert.ok(emptyStudy.includes('No photos to study yet'))
  const view = renderToStaticMarkup(createElement(TreeEditor, { ...props, initialMode: 'view' }))
  assert.ok(!edit.includes('Taxon editor') && !edit.includes('New bullet'), 'Edit mode starts without selecting a card')
  assert.ok(!edit.includes('More options') && !edit.includes('inline-options'))
  assert.ok(edit.includes('Unlock layout') && !edit.includes('Move Branch A and children'), 'Edit mode starts with node dragging locked')
  assert.ok(!view.includes('Unlock layout'))
  assert.ok(!edit.includes('Add child to Insecta'))
  assert.ok(edit.includes('Add sibling to Branch A'))
  assert.ok(!edit.includes('inline-taxon') && !edit.includes('inline-inspector'))
  const { default: InlineTaxonCard } = await server.ssrLoadModule('/src/InlineTaxonCard.jsx')
  const inline = renderToStaticMarkup(createElement(InlineTaxonCard, { node: leaf, nodes, onReparent() {}, photos: {}, onChange() {}, onPhoto() {}, onDelete() {}, onClose() {}, onHeightChange() {} }))
  assert.ok(inline.includes('Move branch under another node') && inline.includes('Choose new parent…'))
  assert.ok(inline.includes('Taxon editor') && inline.includes('New bullet'))
  assert.ok(inline.includes('>Suborder</option>') && inline.includes('>Simple Node</option>') && inline.includes('>Infraorder</option>') && inline.includes('>Superfamily</option>') && inline.includes('>Subfamily</option>') && !inline.includes('>Taxon</option>') && !inline.includes('circle if untitled') && !inline.includes('Redirect before this node'))
  const routeProps = { ...props, initialChart: { ...chart, nodes: routed.nodes } }
  const routeEdit = renderToStaticMarkup(createElement(TreeEditor, { ...routeProps, initialMode: 'edit' }))
  const routeView = renderToStaticMarkup(createElement(TreeEditor, { ...routeProps, initialMode: 'view' }))
  assert.ok(!routeEdit.includes('Delete redirect') && routeEdit.includes('Add redirect on this branch'), 'Redirect delete is hidden until selected')
  const { default: TreeCanvas } = await server.ssrLoadModule('/src/TreeCanvas.jsx')
  const selectedRoute = renderToStaticMarkup(createElement(TreeCanvas, { nodes: routed.nodes, photos: {}, selectedId: routed.redirect.id, mode: 'edit' }))
  assert.ok(selectedRoute.includes('Delete redirect'), 'Selecting a redirect exposes its delete button')
  assert.ok(!selectedRoute.includes('Taxon editor'), 'Redirect selection must keep it as a draggable circle')
  assert.ok(!routeView.includes('redirect-node') && !routeView.includes('Delete redirect') && !routeView.includes('Add redirect on this branch'))
  assert.ok(edit.includes('Add child to') && edit.includes('Add sibling to'))
  assert.ok(!edit.includes('canvas-add-tools'))
  assert.ok(edit.includes('Chart name') && edit.includes('aria-pressed="true"'))
  assert.ok(!edit.includes('layer-label') && !view.includes('layer-label'))
  assert.ok(!view.includes('Alignment') && !view.includes('>Graph</button>'))
  assert.ok(!edit.includes('editor-subbar') && !view.includes('editor-subbar'))
  assert.ok(view.includes('Chart mode') && !view.includes('Taxon editor') && !view.includes('New bullet'))
  console.log('PASS: tree validity, branch ordering, depth limits, non-overlapping horizontal layout, edit/view rendering, autosave reconciliation, cursor-centered wheel/pinch zoom, sibling-only ordering')
} finally { await server.close() }
