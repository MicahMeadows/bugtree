import { useEffect, useMemo, useState } from 'react'
import { flashcardDeck, shuffleCards } from './flashcard-deck'
import { Icon } from './Icons'

export default function Flashcards({ nodes, photos, onEdit }) {
  const cards = useMemo(() => flashcardDeck(nodes), [nodes])
  const [order, setOrder] = useState(() => cards.map((card) => card.id))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const deck = order.map((id) => cards.find((card) => card.id === id)).filter(Boolean)
  const card = deck[index % Math.max(1, deck.length)]
  const photo = card && photos[card.photo]
  useEffect(() => { setImageFailed(false) }, [card?.id, photo])
  function move(direction) {
    if (!deck.length) return
    setIndex((index) => (index + direction + deck.length) % deck.length)
    setRevealed(false)
  }
  function shuffle() {
    setOrder(shuffleCards(cards).map((card) => card.id))
    setIndex(0); setRevealed(false)
  }
  useEffect(() => {
    function keydown(event) {
      if (event.target.closest?.('input, textarea, select') || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [deck.length])
  if (!card) return <section className="flashcards flashcards-empty" aria-label="Flash cards"><Icon name="image" size={42} /><h2>No photos to study yet</h2><p>Add photos to your tree to create flash cards.</p><button className="primary" onClick={onEdit}><Icon name="edit" size={16} /> Edit tree</button></section>
  return <section className="flashcards" aria-label="Flash cards">
    <div className="flashcards-bar"><span role="status">Card {index + 1} of {deck.length}</span><button className="quiet" onClick={shuffle} disabled={deck.length < 2}><Icon name="shuffle" size={16} /> Shuffle</button></div>
    <div className="flashcards-progress" aria-hidden="true"><span style={{ width: `${(index + 1) / deck.length * 100}%` }} /></div>
    <button className={`flashcard ${revealed ? 'revealed' : ''}`} aria-label={revealed ? 'Next flash card' : 'Reveal insect name'} aria-pressed={revealed} onClick={() => { if (revealed) move(1); else setRevealed(true) }}>
      <div className="flashcard-image">{photo && !imageFailed ? <img src={photo} alt="Insect to identify" draggable={false} onError={() => setImageFailed(true)} /> : <div className="flashcard-missing"><Icon name="image" size={40} /><span>Photo unavailable</span></div>}</div>
      {card.bullets.some((note) => note.trim()) && <ul className="flashcard-details">{card.bullets.filter((note) => note.trim()).map((note, index) => <li key={index}>{note}</li>)}</ul>}
      <div className="flashcard-answer" aria-live="polite">{revealed ? <h2>{card.name}</h2> : <span>Tap to reveal the name</span>}</div>
    </button>
    <div className="flashcards-navigation"><button className="secondary" onClick={() => move(-1)} disabled={deck.length < 2}><Icon name="back" size={16} /> Previous</button></div>
  </section>
}
