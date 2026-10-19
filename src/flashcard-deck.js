export function flashcardDeck(nodes) {
  return nodes.filter((node) => Boolean(node.photo))
}
export function shuffleCards(cards, random = Math.random) {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function combineFlashcardTrees(trees) {
  const seen = new Set()
  const nodes = [], photos = {}
  for (const tree of trees) {
    if (!tree || seen.has(tree.chart.id)) continue
    seen.add(tree.chart.id)
    for (const node of tree.chart.nodes) nodes.push({ ...node, id: `${tree.chart.id}:${node.id}` })
    Object.assign(photos, tree.photos)
  }
  return { nodes, photos }
}
