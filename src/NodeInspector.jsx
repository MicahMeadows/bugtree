import { Icon } from './Icons'

// Study view only. Editing controls live directly on InlineTaxonCard.
export default function NodeInspector({ node, nodes, photos, onClose, onSelectAncestor }) {
  const ancestors = []
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const seen = new Set([node.id])
  let parent = byId.get(node.parentId)
  while (parent && !seen.has(parent.id)) {
    ancestors.unshift(parent)
    seen.add(parent.id)
    parent = byId.get(parent.parentId)
  }
  return <aside className="inspector" aria-label="Study notes">
    <div className="inspector-heading"><div><h2>{node.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close side panel"><Icon name="close" /></button></div>
    <div className="inspector-body study-notes">
      {node.rank && node.rank.trim().toLowerCase() !== 'group' && <span className={`rank-tag ${node.color}`}>{node.rank}</span>}
      {node.photo && photos[node.photo] && <figure><img src={photos[node.photo]} alt={node.photoAlt || node.name} />{node.photoAlt && <figcaption>{node.photoAlt}</figcaption>}</figure>}
      <h3>Identification notes</h3>
      {node.bullets.length ? <ul>{node.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul> : <p className="muted">No notes yet.</p>}
      <div className="study-lineage"><span className="eyebrow">BRANCHES FROM</span>{ancestors.length ? <ol className="ancestor-list">{ancestors.map((ancestor) => <li key={ancestor.id}><button onClick={() => onSelectAncestor(ancestor.id)}>{ancestor.name}</button></li>)}</ol> : <p className="muted">Root of this tree</p>}</div>
    </div>
  </aside>
}
