import GraphicsLayer from 'esri/layers/GraphicsLayer'

/**
 * The built-in Draw widget (JimuDraw) adds a group layer "jimu-draw-groupLayer-<mapViewId>-<time>" holding a
 * GraphicsLayer "jimu-draw-layer-<mapViewId>-<time>" when it first opens, and keeps track of it in its own
 * React state. It cannot adopt a layer someone else created, so labels go into Draw's layer when it exists.
 * Until then they go into a fallback layer and are moved across as soon as Draw's layer appears.
 */
const DRAW_LAYER_PREFIX = 'jimu-draw-layer-'

export const findDrawLayer = (view: __esri.MapView | __esri.SceneView, jimuMapViewId: string): __esri.GraphicsLayer | null => {
  const layers = view?.map?.allLayers
  if (!layers) return null
  const own = layers.find((l: any) => l.type === 'graphics' && String(l.id).startsWith(`${DRAW_LAYER_PREFIX}${jimuMapViewId}-`))
  return (own as __esri.GraphicsLayer) ?? null
}

/**
 * Save Experience State restores drawings into this layer when Draw hasn't been opened yet, and moves them into
 * Draw's layer once it appears. Restored labels are picked up from here too.
 */
export const findSaveStateLayer = (view: __esri.MapView | __esri.SceneView, jimuMapViewId: string): __esri.GraphicsLayer | null =>
  (view?.map?.findLayerById(`save-experience-state-drawings-${jimuMapViewId}`) as __esri.GraphicsLayer) ?? null

// Save Experience State captures layers with this prefix, so keep it if the id changes.
export const fallbackLayerId = (widgetId: string) => `attribute-label-${widgetId}`

export const findFallbackLayer = (view: __esri.MapView | __esri.SceneView, widgetId: string): __esri.GraphicsLayer | null =>
  (view?.map?.findLayerById(fallbackLayerId(widgetId)) as __esri.GraphicsLayer) ?? null

export const ensureFallbackLayer = (view: __esri.MapView | __esri.SceneView, widgetId: string, title: string): __esri.GraphicsLayer => {
  let layer = findFallbackLayer(view, widgetId)
  if (!layer) {
    layer = new GraphicsLayer({ id: fallbackLayerId(widgetId), title, listMode: 'hide' })
    view.map.add(layer)
  }
  return layer
}

/** Moves every fallback label into Draw's layer and removes the fallback layer. Returns how many moved. */
export const moveFallbackToDraw = (view: __esri.MapView | __esri.SceneView, widgetId: string, drawLayer: __esri.GraphicsLayer): number => {
  const fallback = findFallbackLayer(view, widgetId)
  if (!fallback || !drawLayer) return 0
  const graphics = fallback.graphics.toArray()
  fallback.removeMany(graphics)
  drawLayer.addMany(graphics)
  view.map.remove(fallback)
  fallback.destroy()
  return graphics.length
}
