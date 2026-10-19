export const MAX_NODES = 200
export const MAX_DEPTH = 12
export const COLORS = ['rose', 'sage', 'sand', 'sky', 'lavender']
export const RANKS = ['Phylum', 'Subphylum', 'Class', 'Order', 'Suborder', 'Infraorder', 'Superfamily', 'Family', 'Subfamily', 'Tribe', 'Genus', 'Species', 'Group']
export const CARD_RANKS = ['Phylum', 'Subphylum', 'Class', 'Order', 'Suborder', 'Infraorder', 'Superfamily', 'Family', 'Subfamily']
export const NODE_TYPES = ['taxon', 'simple', 'suborder', 'redirect']
export function isCircle(node) { return node.type === 'redirect' || node.type === 'simple' || node.type === 'suborder' }
export function newNode(parentId = null, name = 'New taxon', rank = 'Group', color = 'lavender') {
  return { id: crypto.randomUUID(), parentId, name, rank, bullets: [], photo: '', photoAlt: '', color, type: 'taxon', offsetX: 0, offsetY: 0 }
}
export function descendants(nodes, id) {
  const result = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    for (const n of nodes) if (result.has(n.parentId) && !result.has(n.id)) { result.add(n.id); changed = true }
  }
  return result
}
export function validateNodes(nodes, chartId) {
  if (!Array.isArray(nodes) || nodes.length < 1 || nodes.length > MAX_NODES) return 'A chart needs between 1 and 200 taxa.'
  const ids = new Set()
  for (const n of nodes) {
    if (!n || typeof n !== 'object' || typeof n.id !== 'string' || !/^[a-f0-9-]{36}$/.test(n.id) || ids.has(n.id)) return 'Each taxon needs a unique ID.'
    ids.add(n.id)
    if (n.type !== undefined && !NODE_TYPES.includes(n.type)) return 'Invalid node type.'
    if ((n.offsetX !== undefined && (!Number.isFinite(n.offsetX) || Math.abs(n.offsetX) > 10000)) || (n.offsetY !== undefined && (!Number.isFinite(n.offsetY) || Math.abs(n.offsetY) > 10000))) return 'Invalid redirect position.'
    if (typeof n.name !== 'string' || (!n.name.trim() && n.type !== 'redirect' && n.type !== 'suborder' && n.type !== 'simple') || n.name.length > 200) return 'Give each taxon a name (up to 200 characters).'
    if (typeof n.rank !== 'string' || n.rank.length > 80) return 'Taxonomic ranks must be under 80 characters.'
    if (!COLORS.includes(n.color)) return 'Invalid label color.'
    if (!Array.isArray(n.bullets) || n.bullets.length > 30 || n.bullets.some((b) => typeof b !== 'string' || b.length > 500)) return 'Use up to 30 notes of 500 characters per taxon.'
    if (typeof n.photoAlt !== 'string' || n.photoAlt.length > 500) return 'Photo captions must be under 500 characters.'
    if (typeof n.photo !== 'string' || (n.photo && !new RegExp(`^${chartId}/[a-f0-9-]{36}/[a-f0-9-]{36}\\.(jpg|png|webp)$`).test(n.photo))) return 'Invalid photo reference.'
  }
  if (nodes.filter((n) => n.parentId === null).length !== 1) return 'A tree needs exactly one root.'
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const n of nodes) {
    const seen = new Set([n.id])
    let current = n
    let depth = 0
    while (current.parentId !== null) {
      if (!ids.has(current.parentId)) return 'Every branch needs an existing parent.'
      if (seen.has(current.parentId)) return 'Branches cannot form a loop.'
      seen.add(current.parentId)
      current = byId.get(current.parentId)
      if (current.type !== 'redirect') depth++
      if (depth >= MAX_DEPTH) return 'Use at most 12 layers per tree.'
    }
  }
  return null
}
export function reorderNode(nodes, id, direction) {
  const selected = nodes.find((n) => n.id === id)
  const siblings = nodes.filter((n) => n.parentId === selected.parentId)
  const index = siblings.findIndex((n) => n.id === id)
  const other = siblings[index + direction]
  if (!other) return nodes
  const a = nodes.findIndex((n) => n.id === id), b = nodes.findIndex((n) => n.id === other.id)
  const next = [...nodes]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}
