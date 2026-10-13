import { descendants } from '../supabase/functions/site-api/tree-model.js'

export function parentOptions(nodes, id) {
  const selected = nodes.find((node) => node.id === id)
  if (!selected || selected.parentId === null) return []
  const branch = descendants(nodes, id)
  return nodes.filter((node) => !branch.has(node.id) && node.id !== selected.parentId && node.type !== 'redirect')
}

export function reparentBranch(nodes, id, parentId) {
  const selected = nodes.find((node) => node.id === id)
  if (!selected || selected.parentId === null || selected.parentId === parentId || !nodes.some((node) => node.id === parentId) || descendants(nodes, id).has(parentId)) return nodes
  // Attach at the new parent's normal layout position; keep the subtree intact.
  return nodes.map((node) => node.id === id ? { ...node, parentId, offsetX: 0, offsetY: 0 } : node)
}
