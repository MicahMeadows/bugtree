import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icons'

export default function DeleteDialog({ name, kind, description, onConfirm, onCancel, requireName = true }) {
  const dialog = useRef(null)
  const pending = useRef(false)
  const id = useId()
  const [answer, setAnswer] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const matches = !requireName || (Boolean(name.trim()) && answer === name)
  useEffect(() => { dialog.current.showModal() }, [])
  async function submit(event) {
    event.preventDefault()
    if (!matches || pending.current) return
    pending.current = true; setDeleting(true); setError('')
    try {
      await onConfirm()
      onCancel()
    } catch (error) { setError(error.message) }
    finally { pending.current = false; setDeleting(false) }
  }
  return <dialog ref={dialog} className="create-dialog delete-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); if (!pending.current) onCancel() }}>
    <button className="icon-button dialog-close" aria-label="Cancel deletion" disabled={deleting} onClick={onCancel}><Icon name="close" /></button>
    <h2 id={`${id}-title`}>Delete {kind}?</h2>
    <p id={`${id}-description`}>{description}</p>
    <div className="delete-target-name">{name || 'Unnamed taxon'}</div>
    <form onSubmit={submit}>
      {requireName && <>
      <label htmlFor={`${id}-name`}>Type the exact name to confirm</label>
      <input id={`${id}-name`} value={answer} onChange={(event) => setAnswer(event.target.value)} autoFocus autoComplete="off" spellCheck={false} disabled={deleting} aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className="field-help">{name.trim() ? 'The name must match, including capitalization.' : 'Give this taxon a name before deleting it.'}</p>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="delete-dialog-actions"><button type="button" className="secondary" onClick={onCancel} disabled={deleting}>Cancel</button><button type="submit" className="delete-confirm" disabled={!matches || deleting}><Icon name="trash" size={16} />{deleting ? 'Deleting…' : `Delete ${kind}`}</button></div>
    </form>
  </dialog>
}
