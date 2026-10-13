import { useEffect, useLayoutEffect, useRef } from 'react'
import { Icon } from './Icons'
import { COLORS } from '../supabase/functions/site-api/tree-model'

function Bullet({ value, index, busy, onChange, onDelete }) {
  const input = useRef(null)
  useLayoutEffect(() => { const el = input.current; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }, [value])
  return <div className="inline-bullet"><span>•</span><textarea ref={input} aria-label={`Identification note ${index + 1}`} value={value} maxLength={500} rows={1} placeholder="Add a note…" disabled={busy} onChange={(e) => onChange(e.target.value)} /><button className="icon-button" disabled={busy} aria-label={`Delete note ${index + 1}`} title="Delete bullet" onClick={onDelete}><Icon name="close" size={13} /></button></div>
}
export default function InlineTaxonCard({ node, photos, busy, photoBusy, onChange, onPhoto, onDelete, onClose, onHeightChange }) {
  const container = useRef(null)
  useEffect(() => {
    const el = container.current
    const measure = () => onHeightChange(node.id, Math.ceil(el.offsetHeight) + 22)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [node.id, onHeightChange])
  return <div ref={container} className="inline-taxon" data-card-editor aria-label="Taxon editor">
    <div className="inline-title taxon-label">
      {node.rank && node.rank.toLowerCase() !== 'group' && <span>{node.rank}</span>}
      <input aria-label="Taxon name" title="Click to edit title" value={node.name} maxLength={200} disabled={busy} onChange={(e) => onChange({ name: e.target.value })} placeholder={node.type === 'redirect' ? 'Redirect (optional)' : 'Taxon name'} />
      <button className="inline-done icon-button" title="Finish editing" aria-label="Finish editing card" onClick={onClose}><Icon name="close" size={14} /></button>
    </div>
    <label className="node-type-control">Type<select aria-label="Node type" value={node.type === 'suborder' || node.rank === 'Suborder' ? 'suborder' : 'taxon'} disabled={busy} onChange={(e) => onChange({ type: e.target.value, rank: e.target.value === 'suborder' ? 'Suborder' : (node.rank === 'Suborder' ? 'Group' : node.rank) })}><option value="taxon">Taxon</option><option value="suborder">Suborder (circle if untitled)</option></select></label>
    <div className="inline-card-content">
      <div className="inline-notes">
        {node.bullets.map((bullet, i) => <Bullet key={i} value={bullet} index={i} busy={busy} onChange={(value) => onChange({ bullets: node.bullets.map((b, j) => j === i ? value : b) })} onDelete={() => onChange({ bullets: node.bullets.filter((_, j) => j !== i) })} />)}
        <button className="inline-new-bullet" disabled={busy || node.bullets.length >= 30} onClick={() => onChange({ bullets: [...node.bullets, ''] })}><Icon name="plus" size={13} /> New bullet</button>
      </div>
      <label className={`inline-photo ${node.photo ? 'with-photo' : ''}`} title={node.photo ? 'Click to change photo' : 'Click to add photo'}>
        {node.photo && photos[node.photo] ? <img src={photos[node.photo]} alt={node.photoAlt || node.name} /> : <span><Icon name="image" size={24} />Add photo</span>}
        <input type="file" aria-label={node.photo ? 'Change photo' : 'Add photo'} accept="image/jpeg,image/png,image/webp" disabled={busy || photoBusy} onChange={(e) => { const file = e.target.files[0]; e.target.value = ''; if (file) onPhoto(file) }} />
        {node.photo && <span className="photo-edit-overlay"><Icon name="edit" size={14} /></span>}
      </label>
    </div>
    <div className="inline-card-footer">
      <div className="color-options" role="group" aria-label="Label color">{COLORS.map((color) => <button key={color} type="button" className={`color-swatch ${color} ${node.color === color ? 'chosen' : ''}`} aria-label={`${color} label`} title={color} aria-pressed={node.color === color} disabled={busy} onClick={() => onChange({ color })}>{node.color === color ? '✓' : ''}</button>)}</div>
      {node.parentId !== null && <button className="icon-button danger" disabled={busy} aria-label={`Delete ${node.name}`} title="Delete card & branch" onClick={onDelete}><Icon name="trash" size={14} /></button>}
    </div>
  </div>
}
