import { layoutTree, nodeHeight } from './tree-layout.js'
import { newNode } from '../supabase/functions/site-api/tree-model.js'

export function insertRedirect(nodes, id, color = 'lavender') {
  const target = nodes.find((n) => n.id === id)
  if (!target || target.parentId === null || nodes.length >= 200) return null
  const redirect = { ...newNode(target.parentId, '', 'Group', color), type: 'redirect', offsetX: 100 }
  return { redirect, nodes: nodes.flatMap((n) => n.id === id ? [redirect, { ...n, parentId: redirect.id }] : [n]) }
}
export function removeRedirect(nodes, id) {
  const target = nodes.find((n) => n.id === id)
  if (target?.type !== 'redirect' || target.parentId === null) return nodes
  return nodes.filter((n) => n.id !== id).map((n) => n.parentId === id ? { ...n, parentId: target.parentId, offsetX: (n.offsetX || 0) + (target.offsetX || 0), offsetY: (n.offsetY || 0) + (target.offsetY || 0) } : n)
}
export function moveBranch(nodes, id, dx, dy) {
  return nodes.map((n) => n.id === id ? { ...n, offsetX: Math.max(-10000, Math.min(10000, (n.offsetX || 0) + dx)), offsetY: Math.max(-10000, Math.min(10000, (n.offsetY || 0) + dy)) } : n)
}

export const moveRedirect = moveBranch

export function insertRedirectAt(nodes, id, color, point, currentLayout = layoutTree(nodes)) {
  const result = insertRedirect(nodes, id, color)
  if (!result) return null
  result.redirect.offsetX = 0
  const expanded = currentLayout.items.find((n) => n.height > nodeHeight(n))
  const nextLayout = layoutTree(result.nodes, expanded?.id, expanded?.height || 0)
  const anchor = nextLayout.items.find((n) => n.id === result.redirect.id)
  const dx = point.x - (anchor.x + anchor.width / 2)
  const dy = point.y - (anchor.y + anchor.height / 2)
  result.redirect.offsetX = dx; result.redirect.offsetY = dy
  // The new routing point moves independently; preserve the attached branch.
  const previous = currentLayout.items.find((n) => n.id === id)
  const next = nextLayout.items.find((n) => n.id === id)
  result.nodes = result.nodes.map((n) => n.id === id ? { ...n, offsetX: (n.offsetX || 0) + previous.x - next.x - dx, offsetY: (n.offsetY || 0) + previous.y - next.y - dy } : n)
  return result
}
