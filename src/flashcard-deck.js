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
