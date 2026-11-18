import Point from 'esri/geometry/Point'
import Extent from 'esri/geometry/Extent'
import SpatialReference from 'esri/geometry/SpatialReference'
import * as webMercatorUtils from 'esri/geometry/support/webMercatorUtils'
import * as labelPointOperator from 'esri/geometry/operators/labelPointOperator'
import type { LabelRequest } from '../config'

/** A visible layer or map image sublayer that can be labelled. */
export interface LayerTarget {
  key: string
  title: string
  parentTitle?: string
  layer: any
}

export interface FieldOption {
  name: string
  alias: string
}

const WGS84 = new SpatialReference({ wkid: 4326 })

// Layer types whose features can be queried at a location.
const QUERYABLE_TYPES = new Set(['feature', 'csv', 'geojson', 'ogc-feature', 'wfs', 'scene', 'subtype-group'])

// Field types and names that never make a useful label.
const HIDDEN_FIELD_TYPES = new Set(['geometry', 'blob', 'raster', 'xml', 'global-id', 'guid'])
const HIDDEN_FIELD_NAMES = /^(shape|shape[._]?(area|length|len)|st_area\(.*\)|st_length\(.*\))$/i

const NUMBER_TYPES = new Set(['double', 'single', 'integer', 'small-integer', 'big-integer', 'long', 'oid'])
const DECIMAL_TYPES = new Set(['double', 'single'])

const isVisibleAtScale = (minScale: number | undefined, maxScale: number | undefined, scale: number | undefined): boolean => {
  if (!Number.isFinite(scale)) return true
  if (minScale && scale > minScale) return false
  if (maxScale && scale < maxScale) return false
  return true
}

/** Lat/lon of a point in any spatial reference webMercatorUtils can handle. */
export const pointToLatLon = (point: __esri.Point): { latitude: number, longitude: number } => {
  if (!point) return { latitude: NaN, longitude: NaN }
  if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
    return { latitude: point.latitude, longitude: point.longitude }
  }
  try {
    if (webMercatorUtils.canProject(point, WGS84)) {
      const projected = webMercatorUtils.project(point, WGS84) as __esri.Point
      if (projected) return { latitude: projected.y, longitude: projected.x }
    }
  } catch (err) {
    console.warn('Attribute Label: coordinate conversion failed.', err)
  }
  return { latitude: NaN, longitude: NaN }
}

/** Map Context Menu payload → a point in the view's spatial reference. Map coordinates win when the wkid matches. */
export const requestToViewPoint = (request: LabelRequest, view: __esri.MapView | __esri.SceneView): __esri.Point | null => {
  const viewSR = view?.spatialReference
  if (!viewSR) return null

  const { mapX, mapY, wkid, latitude, longitude } = request ?? ({} as LabelRequest)
  if (Number.isFinite(mapX) && Number.isFinite(mapY) && wkid && viewSR.wkid === wkid) {
    return new Point({ x: mapX, y: mapY, spatialReference: viewSR })
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const geographic = new Point({ latitude, longitude, spatialReference: WGS84 })
  if (viewSR.isWGS84) return geographic
  if (webMercatorUtils.canProject(geographic, viewSR)) return webMercatorUtils.project(geographic, viewSR) as __esri.Point
  return null
}

/**
 * Every layer the user can see at the current scale, top of the layer list first. Group layers and map image
 * sublayers are expanded. Layers hidden from the layer list are skipped, which also skips the Draw widget's
 * layers and other widgets' graphics.
 */
export const collectTargets = (map: __esri.Map, scale: number, includeHidden = false): LayerTarget[] => {
  const targets: LayerTarget[] = []
  // includeHidden also walks layers that are turned off or out of scale, to find a remembered layer.
  const shown = (item: any) => includeHidden || (item.visible && isVisibleAtScale(item.minScale, item.maxScale, scale))

  const walkSublayers = (sublayers: __esri.Collection<any>, rootId: string, parentTitle: string) => {
    sublayers?.toArray().forEach((sublayer: any) => {
      if (!shown(sublayer)) return
      if (sublayer.sublayers?.length) {
        walkSublayers(sublayer.sublayers, rootId, parentTitle)
        return
      }
      if (typeof sublayer.queryFeatures !== 'function' || sublayer.isTable) return
      targets.push({ key: `${rootId}::${sublayer.id}`, title: sublayer.title, parentTitle, layer: sublayer })
    })
  }

  const walk = (layers: __esri.Collection<any>, parentTitle?: string) => {
    // Map layer collections are ordered bottom first; reverse so the list follows the layer list.
    layers?.toArray().slice().reverse().forEach((layer: any) => {
      if (layer.listMode === 'hide' || !shown(layer)) return
      if (layer.type === 'group') {
        walk(layer.layers, layer.title)
      } else if (layer.type === 'map-image') {
        walkSublayers(layer.sublayers, layer.id, layer.title)
      } else if (QUERYABLE_TYPES.has(layer.type) && !layer.isTable && typeof layer.queryFeatures === 'function') {
        targets.push({ key: layer.id, title: layer.title, parentTitle, layer })
      }
    })
  }

  walk(map?.layers as any)
  return targets
}

/** Fields offered for labelling: the popup's visible fields when it has any, otherwise every useful field. */
export const fieldOptions = (layer: any): FieldOption[] => {
  const fieldInfos: any[] = layer.popupTemplate?.fieldInfos ?? []
  const visibleInfos = fieldInfos.filter(info => info?.visible !== false && info?.fieldName && !String(info.fieldName).startsWith('expression/'))
  const fromPopup = visibleInfos
    .map(info => {
      const field = layer.fieldsIndex?.get?.(info.fieldName)
      return field ? { name: field.name as string, alias: (info.label || field.alias || field.name) as string } : null
    })
    .filter(Boolean)
  if (fromPopup.length) return fromPopup

  return (layer.fields ?? [])
    .filter((f: any) => !HIDDEN_FIELD_TYPES.has(f.type) && !HIDDEN_FIELD_NAMES.test(f.name))
    .map((f: any) => ({ name: f.name, alias: f.alias || f.name }))
}

/** The field most likely to make a good label: the display field, else the first offered field. */
export const defaultField = (layer: any, fields: FieldOption[]): string | undefined => {
  const display = layer.displayField && fields.find(f => f.name.toLowerCase() === String(layer.displayField).toLowerCase())
  return display?.name ?? fields[0]?.name
}

const popupFieldFormat = (layer: any, fieldName: string): any => {
  const name = fieldName.toLowerCase()
  return layer.popupTemplate?.fieldInfos?.find((info: any) => String(info?.fieldName ?? '').toLowerCase() === name)?.format ?? null
}

/** A value as people expect to read it: coded value names, local dates, and the popup's number format. */
export const formatValue = (layer: any, graphic: __esri.Graphic, fieldName: string): string => {
  const value = graphic?.attributes?.[fieldName]
  if (value === null || value === undefined || value === '') return ''
  const field = layer.fieldsIndex?.get?.(fieldName)

  let domain: any
  try {
    domain = layer.getFieldDomain?.(fieldName, { feature: graphic }) ?? field?.domain
  } catch {
    domain = field?.domain
  }
  if (domain?.type === 'coded-value') {
    const coded = domain.codedValues?.find((c: any) => c.code === value)
    if (coded) return String(coded.name)
  }

  if (field?.type === 'date' && Number.isFinite(Number(value))) return new Date(Number(value)).toLocaleDateString()
  if (typeof value === 'number' && NUMBER_TYPES.has(field?.type)) {
    const format = popupFieldFormat(layer, fieldName)
    if (format && (format.digitSeparator !== undefined || Number.isInteger(format.places))) {
      const places = Number.isInteger(format.places) && format.places >= 0 ? Math.min(format.places, 20) : undefined
      return value.toLocaleString(undefined, places === undefined
        ? { useGrouping: !!format.digitSeparator, maximumFractionDigits: 6 }
        : { useGrouping: !!format.digitSeparator, minimumFractionDigits: places, maximumFractionDigits: places })
    }
    if (!DECIMAL_TYPES.has(field.type)) return String(value)
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return String(value)
}

/** A box of `tolerancePx` around the point, so points and lines can be hit. Polygons use the point itself. */
const toleranceExtent = (view: __esri.MapView | __esri.SceneView, point: __esri.Point, tolerancePx: number): __esri.Extent | null => {
  if (view.type === '2d' && point.spatialReference?.equals?.(view.spatialReference)) {
    const r = (view as __esri.MapView).resolution * tolerancePx
    return new Extent({ xmin: point.x - r, ymin: point.y - r, xmax: point.x + r, ymax: point.y + r, spatialReference: point.spatialReference })
  }
  return null
}

/** Loads the layer (so its fields are known) and returns the fields offered for labelling. */
export const loadFields = async (target: LayerTarget): Promise<FieldOption[]> => {
  if (typeof target.layer.load === 'function') await target.layer.load()
  return fieldOptions(target.layer)
}

/** Any one feature of the layer, for the sample values next to each field. */
export const querySample = async (target: LayerTarget): Promise<__esri.Graphic | null> => {
  const { layer } = target
  const query = typeof layer.createQuery === 'function' ? layer.createQuery() : ({} as any)
  if (!query.where) query.where = '1=1'
  query.outFields = ['*']
  query.returnGeometry = false
  query.num = 1
  const featureSet = await layer.queryFeatures(query)
  return featureSet?.features?.[0] ?? null
}

/** The top feature of one layer at the point, with its geometry in the view's spatial reference. */
export const queryFeatureAt = async (
  view: __esri.MapView | __esri.SceneView, target: LayerTarget, point: __esri.Point, tolerancePx: number
): Promise<__esri.Graphic | null> => {
  const { layer } = target
  if (typeof layer.load === 'function') await layer.load()
  const extent = toleranceExtent(view, point, tolerancePx)
  const query = typeof layer.createQuery === 'function' ? layer.createQuery() : ({} as any)
  query.geometry = layer.geometryType === 'polygon' || !extent ? point : extent
  query.spatialRelationship = 'intersects'
  query.outFields = ['*']
  query.returnGeometry = true
  query.outSpatialReference = view.spatialReference
  query.num = 1
  if (!query.where) query.where = '1=1'
  const featureSet = await layer.queryFeatures(query)
  return featureSet?.features?.[0] ?? null
}

/** A stable id for a feature, so the same feature isn't labelled twice. */
export const featureKey = (target: LayerTarget, graphic: __esri.Graphic): string | null => {
  const oidField = target.layer.objectIdField
  const oid = oidField ? graphic.attributes?.[oidField] : undefined
  return oid === undefined || oid === null ? null : `${target.key}:${oid}`
}

/**
 * Where a label sits at the feature's centre: inside the polygon (not its centroid, which can fall outside),
 * on the line, or the point itself. Falls back to the extent centre.
 */
export const labelPointFor = (geometry: __esri.Geometry): __esri.Point | null => {
  if (!geometry) return null
  if (geometry.type === 'point') return geometry as __esri.Point
  try {
    const point = labelPointOperator.execute(geometry as any)
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return point
  } catch {
    // Fall through to the extent centre.
  }
  return geometry.extent?.center ?? null
}
