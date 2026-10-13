export const AUTOSAVE_DELAY = 3000
export const AUTOSAVE_RETRY_DELAY = 10000

// A completed request must update the version without replacing newer local edits.
export function reconcileSave(snapshot, current, saved) {
  const dirty = current !== snapshot
  return { chart: dirty ? { ...current, version: saved.version, updated_at: saved.updated_at } : saved, dirty }
}
