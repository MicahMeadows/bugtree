// Reorder only the slots occupied by this node's siblings; parent links stay intact.
export function moveSibling(nodes, id, index) {
  const node = nodes.find((n) => n.id === id)
  if (!node || node.parentId === null) return nodes
  const siblings = nodes.filter((n) => n.parentId === node.parentId)
  const from = siblings.findIndex((n) => n.id === id)
  const to = Math.max(0, Math.min(siblings.length - 1, index))
  if (from === to) return nodes
  siblings.splice(from, 1)
  siblings.splice(to, 0, node)
  let slot = 0
  return nodes.map((n) => n.parentId === node.parentId ? siblings[slot++] : n)
}

export function siblingDrop(items, id, worldY) {
  const node = items.find((n) => n.id === id)
  if (!node || node.parentId === null) return null
  const siblings = items.filter((n) => n.parentId === node.parentId && n.id !== id).sort((a, b) => a.y - b.y)
  if (!siblings.length) return null
  const index = siblings.filter((n) => worldY > n.y + n.height / 2).length
  const previous = siblings[index - 1], next = siblings[index]
  const y = previous && next ? (previous.y + previous.height + next.y) / 2 : next ? next.y - 16 : previous.y + previous.height + 16
  return { index, y, x: node.x, width: node.width }
}

export function isDefaultTaxon(node) {
  return node.name === 'New taxon' && ['Group', 'Order', 'Family'].includes(node.rank) && node.color === 'lavender' && node.bullets.length === 0 && !node.photo && !node.photoAlt
}
