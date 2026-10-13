export const NODE_WIDTH = 310
export const COLUMN_GAP = 90
const ROW_GAP = 32
const PAD = 72
export function nodeHeight(node) {
  if (!node.photo && !node.bullets.length) return node.name.length > 25 ? 104 : 92
  const noteWidth = node.photo ? 18 : 36
  const notes = node.bullets.reduce((height, text) => height + Math.max(1, Math.ceil(text.length / noteWidth)) * 18 + 7, 0)
  return Math.max(node.photo ? (node.name.length > 25 ? 242 : 218) : 140, (node.name.length > 25 ? 112 : 94) + notes)
}
export function layoutTree(nodes, expandedId = null, expandedHeight = 0, layoutStyle = 'tree') {
  if (!nodes.length) return { items: [], edges: [], width: 500, height: 300, layers: [] }
  const children = new Map(nodes.map((node) => [node.id, nodes.filter((n) => n.parentId === node.id)]))
  const spans = new Map()
  const root = nodes.find((node) => node.parentId === null)
  let maxDepth = 0
  function findDepth(node, depth) {
    maxDepth = Math.max(maxDepth, depth)
    for (const child of children.get(node.id)) findDepth(child, depth + 1)
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
  function place(node, depth, top) {
    const height = heightFor(node)
    const isLeaf = children.get(node.id).length === 0
    const column = layoutStyle === 'column' && isLeaf ? maxDepth : depth
    const x = PAD + column * (NODE_WIDTH + COLUMN_GAP)
    const y = top + (spans.get(node.id) - height) / 2
    const item = { ...node, x, y, width: NODE_WIDTH, height, depth, isLeaf }
    items.push(item)
    if (!layers[depth]) layers[depth] = new Set()
    if (node.rank && node.rank.trim().toLowerCase() !== 'group') layers[depth].add(node.rank)
    const branch = children.get(node.id)
    const total = branch.reduce((sum, child) => sum + spans.get(child.id), 0) + Math.max(0, branch.length - 1) * ROW_GAP
    let nextTop = top + (spans.get(node.id) - total) / 2
    for (const child of branch) {
      const childItem = place(child, depth + 1, nextTop)
      const startX = x + NODE_WIDTH, startY = y + height / 2
      const endX = childItem.x, endY = childItem.y + childItem.height / 2
      const middle = startX + COLUMN_GAP / 2
      edges.push({ id: child.id, d: `M ${startX} ${startY} H ${middle} V ${endY} H ${endX - 6}` })
      nextTop += spans.get(child.id) + ROW_GAP
    }
    return item
  }
  place(root, 0, PAD)
  return { items, edges, layers: layers.map((ranks) => [...ranks].join(' / ')), width: PAD * 2 + (layers.length - 1) * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH, height: spans.get(root.id) + PAD * 2 }
}
