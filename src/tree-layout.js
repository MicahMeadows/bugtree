import { isCircle } from '../supabase/functions/site-api/tree-model.js'
export const NODE_WIDTH = 370
export const COLUMN_GAP = 90
const ROW_GAP = 32
const PAD = 72
export function circleSize(node) { return node.type === 'redirect' ? 24 : 48 }
export function nodeHeight(node) {
  if (isCircle(node)) return circleSize(node)
  if (!node.photo && !node.bullets.length) return node.name.length > 25 ? 104 : 92
  const noteWidth = node.photo ? 18 : 36
  const notes = node.bullets.reduce((height, text) => height + Math.max(1, Math.ceil(text.length / noteWidth)) * 18 + 7, 0)
  return Math.max(node.photo ? (node.name.length > 25 ? 242 : 218) : 140, (node.name.length > 25 ? 112 : 94) + notes)
}
export function layoutTree(nodes, expandedId = null, expandedHeight = 0, columnOnly = false) {
  if (columnOnly) {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    nodes = nodes.filter((node) => node.type !== 'redirect').map((node) => {
      let parentId = node.parentId
      while (byId.get(parentId)?.type === 'redirect') parentId = byId.get(parentId).parentId
      return { ...node, parentId, offsetX: 0, offsetY: 0 }
    })
  }
  if (!nodes.length) return { items: [], edges: [], width: 500, height: 300, layers: [] }
  const children = new Map(nodes.map((node) => [node.id, nodes.filter((n) => n.parentId === node.id)]))
  const spans = new Map()
  const root = nodes.find((node) => node.parentId === null)
  let maxDepth = 0
  function findDepth(node, depth) {
    maxDepth = Math.max(maxDepth, depth)
    for (const child of children.get(node.id)) findDepth(child, depth + (child.type === 'redirect' ? 0 : 1))
  }
  findDepth(root, 0)
  const heightFor = (node) => node.id === expandedId ? Math.max(nodeHeight(node) + 56, expandedHeight) : nodeHeight(node)
  function measure(node) {
    const branch = children.get(node.id)
    const height = Math.max(heightFor(node), branch.reduce((sum, child) => sum + measure(child), 0) + Math.max(0, branch.length - 1) * ROW_GAP)
    spans.set(node.id, height)
    return height
  }
  measure(root)
  const items = [], edges = [], layers = []
  function place(node, depth, top, offsetX = 0, offsetY = 0) {
    const height = heightFor(node)
    const isLeaf = children.get(node.id).length === 0
    const column = isLeaf ? maxDepth : depth
    offsetX += node.offsetX || 0; offsetY += node.offsetY || 0
    const width = isCircle(node) && node.id !== expandedId ? circleSize(node) : NODE_WIDTH
    const x = PAD + column * (NODE_WIDTH + COLUMN_GAP) + offsetX + (width !== NODE_WIDTH ? (NODE_WIDTH - width) / 2 : 0)
    const y = top + (spans.get(node.id) - height) / 2 + offsetY
    const item = { ...node, x, y, width, height, depth, isLeaf }
    items.push(item)
    if (!layers[depth]) layers[depth] = new Set()
    if (node.rank && node.rank.trim().toLowerCase() !== 'group') layers[depth].add(node.rank)
    const branch = children.get(node.id)
    const total = branch.reduce((sum, child) => sum + spans.get(child.id), 0) + Math.max(0, branch.length - 1) * ROW_GAP
    let nextTop = top + (spans.get(node.id) - total) / 2
    for (const child of branch) {
      const childItem = place(child, depth + (child.type === 'redirect' ? 0 : 1), nextTop, offsetX, offsetY)
      edges.push({ id: childItem.id })
      nextTop += spans.get(child.id) + ROW_GAP
    }
    return item
  }
  place(root, 0, PAD)
  const byId = new Map(items.map((n) => [n.id, n]))
  for (const edge of edges) {
    const child = byId.get(edge.id), parent = byId.get(child.parentId)
    const sx = parent.x + (parent.type === 'redirect' ? parent.width / 2 : parent.width), sy = parent.y + parent.height / 2
    const ex = child.x + (child.type === 'redirect' ? child.width / 2 : -6), ey = child.y + child.height / 2
    const mid = sx + COLUMN_GAP / 2
    edge.d = `M ${sx} ${sy} H ${mid} V ${ey} H ${ex}`
  }
  return { items, edges, layers: layers.map((ranks) => [...ranks].join(' / ')), width: Math.max(...items.map((n) => n.x + n.width)) + PAD, height: Math.max(...items.map((n) => n.y + n.height)) + PAD }
}
