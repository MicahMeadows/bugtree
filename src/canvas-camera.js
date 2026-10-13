export const MIN_ZOOM = .02
export const MAX_ZOOM = 3
export const clampZoom = (zoom) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))

export function zoomAt(camera, zoom, point) {
  const nextZoom = clampZoom(zoom)
  const ratio = nextZoom / camera.zoom
  return { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, zoom: nextZoom }
}
export function fitCamera(width, height, viewportWidth, viewportHeight) {
  const zoom = clampZoom(Math.min(1, Math.max(1, viewportWidth - 48) / width, Math.max(1, viewportHeight - 48) / height))
  return { x: (viewportWidth - width * zoom) / 2, y: (viewportHeight - height * zoom) / 2, zoom }
}
export function wheelZoom(camera, delta, point, deltaMode = 0, viewportHeight = 800) {
  const pixels = delta * (deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1)
  return zoomAt(camera, camera.zoom * Math.exp(-Math.max(-250, Math.min(250, pixels)) * .002), point)
}
export function pinchCamera(camera, start, current) {
  const next = zoomAt(camera, camera.zoom * current.distance / Math.max(1, start.distance), start.center)
  return { ...next, x: next.x + current.center.x - start.center.x, y: next.y + current.center.y - start.center.y }
}
