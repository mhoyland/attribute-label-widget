import {
  React, ReactRedux, hooks, appActions, getAppStore, MutableStoreManager, WidgetState,
  type AllWidgetProps, type IMState
} from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { Button, Checkbox, Loading, LoadingType, Option, Select, TextArea, TextInput } from 'jimu-ui'
import { SelectPointOutlined } from 'jimu-icons/outlined/gis/select-point'
import { CloseOutlined } from 'jimu-icons/outlined/editor/close'
import { ZoomInOutlined } from 'jimu-icons/outlined/editor/zoom-in'
import { TrashOutlined } from 'jimu-icons/outlined/editor/trash'
import { EditOutlined } from 'jimu-icons/outlined/editor/edit'
import { MoveOutlined } from 'jimu-icons/outlined/editor/move'
import { TextOutlined } from 'jimu-icons/outlined/data/text'
import { ResetOutlined } from 'jimu-icons/outlined/editor/reset'
import Graphic from 'esri/Graphic'
import TextSymbol from 'esri/symbols/TextSymbol'
import * as reactiveUtils from 'esri/core/reactiveUtils'
import type { IMConfig, JoinWith, LabelRequest, LabelStyle, PlaceAt, StylePreset } from '../config'
import {
  DEFAULT_TOLERANCE, buildLabelText, clamp, isOnLabel, isOwnLabel, labelAttributes, labelKeyOf, normaliseJoin, normaliseStyle, parseColor, storageKey, styleFromSymbol,
  toTextSymbolProperties, toggleField
} from './label'
import {
  collectTargets, defaultField, featureKey, formatValue, labelPointFor, loadFields, queryFeatureAt, querySample, requestToViewPoint,
  type FieldOption, type LayerTarget
} from './layers'
import { ensureFallbackLayer, findDrawLayer, findFallbackLayer, findSaveStateLayer, moveFallbackToDraw } from './draw-layer'
import { Collapsible, FieldList, JoinPicker, Segmented, StyleEditor } from './components'
import MapBanner from './map-banner'
import { widgetStyle } from './style'
import defaultMessages from './translations/default'

// Map Context Menu writes one of these to this widget's mutable state before opening it.
const REQUEST_KEYS = ['labelRequest', 'mapContext'] as const
const MIN_ZOOM_TO = 17
const STATUS_MS = 3200
const UNDO_STATUS_MS = 6000
const MAX_UNDO = 50

type Tab = 'layer' | 'text'
/** What the map does for this widget: place labels on click, or let labels be dragged. */
type MapMode = 'place' | 'move' | null

interface AddedLabel {
  id: string
  graphic: __esri.Graphic
  /** Layer key + object ID of the labelled feature; null for free text. */
  key: string | null
}

interface Editing {
  id: string
  text: string
  style: LabelStyle
  /** The symbol before editing, restored on Cancel. */
  original: __esri.TextSymbol
}

interface Status {
  message: string
  /** Offer Undo / Redo in the message. */
  canUndo?: boolean
  canRedo?: boolean
}

interface UndoStep {
  /** What was done, e.g. "Label added"; shown again as "Undone: …" or "Redone: …". */
  message: string
  undo: () => void
  redo: () => void
}

const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/** Choices kept in this browser between sessions when "Remember choices" is on. */
interface Remembered {
  tab?: Tab
  layerKey?: string
  layerTitle?: string
  fields?: string[]
  join?: JoinWith
  showFieldNames?: boolean
  placeAt?: PlaceAt
  freeText?: string
  style?: Partial<LabelStyle>
}

const readStored = <T, >(key: string, fallback: T): T => {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const writeStored = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be full or blocked; remembering is only a convenience.
  }
}

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const labelOf = (graphic: __esri.Graphic): string => ((graphic.symbol as __esri.TextSymbol)?.text ?? '')
const firstLine = (text: string) => text.split('\n')[0]
const targetLabel = (target: LayerTarget) => (target.parentTitle ? `${target.parentTitle} › ${target.title}` : target.title)

/**
 * The label's symbol with the widget's style and text applied. Starts from the existing symbol so anything
 * the widget doesn't edit (e.g. a border set in Draw) is kept.
 */
const restyle = (symbol: __esri.TextSymbol, style: LabelStyle, text: string): __esri.TextSymbol => {
  const next = symbol.clone()
  const { type: _type, ...properties } = toTextSymbolProperties(style, text)
  Object.assign(next, properties)
  return next
}

/** The app theme's primary colour as [r, g, b, a], for highlighting a label on the map. */
const themePrimary = (): number[] => {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--sys-color-primary-main').trim()
    return parseColor(value) ?? [7, 111, 229, 1]
  } catch {
    return [7, 111, 229, 1]
  }
}

export default function Widget (props: AllWidgetProps<IMConfig>) {
  const translate = hooks.useTranslation(defaultMessages)
  const config = props.config
  const tolerance = clamp(config?.tolerance, 0, 30, DEFAULT_TOLERANCE)
  const rememberChoices = config?.rememberChoices !== false
  const allowMultiple = config?.allowMultiplePerFeature === true
  const includeDrawText = config?.includeDrawText !== false
  const configStyle = React.useMemo(() => normaliseStyle(config?.defaultStyle?.asMutable?.() ?? (config?.defaultStyle as any)), [config?.defaultStyle])
  const configPlaceAt: PlaceAt = config?.placeAt === 'click' ? 'click' : 'centre'

  const appId = ReactRedux.useSelector((state: IMState) => (state as any).appId as string)
  const memoryKey = storageKey(props.id, appId)
  const remembered = React.useMemo<Remembered>(() => (rememberChoices ? readStored(memoryKey, {}) : {}), [rememberChoices, memoryKey])

  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const view = jimuMapView?.view
  const is3d = view?.type === '3d'
  const mapWidgetId = props.useMapWidgetIds?.[0]
  const autoControlWidgetId = ReactRedux.useSelector((state: IMState) =>
    mapWidgetId ? state.mapWidgetsInfo?.[mapWidgetId]?.autoControlWidgetId : undefined)

  // ---------- settings chosen before clicking ----------
  const [tab, setTab] = React.useState<Tab>(remembered.tab === 'text' ? 'text' : 'layer')
  const [targets, setTargets] = React.useState<LayerTarget[]>([])
  const [target, setTarget] = React.useState<LayerTarget>(null)
  const [fieldOptions, setFieldOptions] = React.useState<FieldOption[]>([])
  const [sample, setSample] = React.useState<__esri.Graphic>(null)
  const [fieldsLoading, setFieldsLoading] = React.useState(false)
  const [fields, setFields] = React.useState<string[]>(remembered.fields ?? [])
  const [join, setJoin] = React.useState<JoinWith>(normaliseJoin(remembered.join ?? config?.defaultJoin))
  const [showFieldNames, setShowFieldNames] = React.useState<boolean>(remembered.showFieldNames ?? config?.showFieldNames === true)
  const [placeAt, setPlaceAt] = React.useState<PlaceAt>(remembered.placeAt ?? configPlaceAt)
  const [freeText, setFreeText] = React.useState<string>(remembered.freeText ?? '')
  const [style, setStyle] = React.useState<LabelStyle>(() => normaliseStyle(remembered.style ?? configStyle))
  const [presets, setPresets] = React.useState<StylePreset[]>(() => readStored(`${memoryKey}:presets`, []))
  const [presetName, setPresetName] = React.useState<string>(null)
  // The Layer and fields (or Text) section: open to start, and opened again whenever a tab is clicked.
  const [sourceOpen, setSourceOpen] = React.useState(true)
  const [styleOpen, setStyleOpen] = React.useState(false)
  const [moreStyle, setMoreStyle] = React.useState(false)

  // ---------- map and labels ----------
  const [mapMode, setMapMode] = React.useState<MapMode>(null)
  const [added, setAdded] = React.useState<AddedLabel[]>([])
  const [listOpen, setListOpen] = React.useState(true)
  const [hoverId, setHoverId] = React.useState<string>(null)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [editMoreStyle, setEditMoreStyle] = React.useState(false)
  const [status, setStatus] = React.useState<Status>(null)
  const [drawLayer, setDrawLayer] = React.useState<__esri.GraphicsLayer>(null)
  const [, setLayerChanges] = React.useState(0)
  const [layersVersion, setLayersVersion] = React.useState(0)
  /** Graphics already in the list (or added and since undone), so they are never picked up twice. */
  const trackedRef = React.useRef(new WeakSet<__esri.Graphic>())
  const [queued, setQueued] = React.useState<{ point: __esri.Point, tab: Tab } | null>(null)

  const hadMapControlRef = React.useRef(false)
  const targetTitleRef = React.useRef<string>(remembered.layerTitle ?? null)
  const placing = mapMode === 'place'
  const moving = mapMode === 'move'

  const flash = React.useCallback((message: string) => { setStatus({ message }) }, [])
  React.useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => { setStatus(null) }, status.canUndo || status.canRedo ? UNDO_STATUS_MS : STATUS_MS)
    return () => { window.clearTimeout(timer) }
  }, [status])

  // ---------- undo / redo: buttons in the message, Ctrl+Z, and Ctrl+Y or Ctrl+Shift+Z (Cmd on a Mac) ----------
  const undoStackRef = React.useRef<UndoStep[]>([])
  const redoStackRef = React.useRef<UndoStep[]>([])
  /** Records a step that can be undone and says what happened, with Undo. A new step clears Redo. */
  const record = React.useCallback((message: string, undo: () => void, redo: () => void) => {
    undoStackRef.current = [...undoStackRef.current, { message, undo, redo }].slice(-MAX_UNDO)
    redoStackRef.current = []
    setStatus({ message, canUndo: true })
  }, [])
  const undoLast = React.useCallback(() => {
    const step = undoStackRef.current.pop()
    if (!step) return
    step.undo()
    redoStackRef.current.push(step)
    setStatus({ message: translate('alUndone', { action: step.message }), canUndo: undoStackRef.current.length > 0, canRedo: true })
  }, [translate])
  const redoLast = React.useCallback(() => {
    const step = redoStackRef.current.pop()
    if (!step) return
    step.redo()
    undoStackRef.current.push(step)
    setStatus({ message: translate('alRedone', { action: step.message }), canUndo: true, canRedo: redoStackRef.current.length > 0 })
  }, [translate])

  const widgetOpen = props.state !== WidgetState.Closed
  React.useEffect(() => {
    if (!widgetOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTyping(event.target)) return
      const key = event.key.toLowerCase()
      const isRedo = key === 'y' || (key === 'z' && event.shiftKey)
      const isUndo = key === 'z' && !event.shiftKey
      // Leave the keys to the page when there is nothing of ours to undo or redo.
      if (isUndo && undoStackRef.current.length) {
        event.preventDefault()
        undoLast()
      } else if (isRedo && redoStackRef.current.length) {
        event.preventDefault()
        redoLast()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [widgetOpen, undoLast, redoLast])

  // ---------- remember choices ----------
  React.useEffect(() => {
    if (!rememberChoices) return
    writeStored(memoryKey, {
      // Until the layer is chosen on load, keep what was remembered rather than writing it away.
      tab, layerKey: target?.key ?? remembered.layerKey, layerTitle: target?.title ?? targetTitleRef.current, fields, join, showFieldNames, placeAt, freeText, style
    } as Remembered)
  }, [rememberChoices, memoryKey, tab, target, fields, join, showFieldNames, placeAt, freeText, style])

  React.useEffect(() => { writeStored(`${memoryKey}:presets`, presets) }, [memoryKey, presets])

  // ---------- layers that can be labelled ----------
  const refreshTargets = React.useCallback(() => {
    if (!view?.map) return
    setTargets(collectTargets(view.map, view.scale))
  }, [view])

  // Layer visibility and scale ranges change what can be labelled; refresh when the map settles.
  React.useEffect(() => {
    if (!view) return
    refreshTargets()
    const handle = reactiveUtils.watch(
      () => [view.stationary, view.map?.allLayers?.length, view.map?.allLayers?.filter((l: any) => l.visible).length],
      () => { if (view.stationary) refreshTargets() }
    )
    return () => { handle.remove() }
  }, [view, refreshTargets])

  const chooseTarget = React.useCallback(async (next: LayerTarget, keepFields?: string[]) => {
    setTarget(next)
    targetTitleRef.current = next?.title ?? null
    setFieldOptions([])
    setSample(null)
    if (!next) return
    setFieldsLoading(true)
    try {
      const options = await loadFields(next)
      setFieldOptions(options)
      const valid = (keepFields ?? []).filter(name => options.some(f => f.name === name))
      const first = defaultField(next.layer, options)
      setFields(valid.length ? valid : (first ? [first] : []))
      setSample(await querySample(next).catch(() => null))
    } catch (err) {
      console.warn(`Attribute Label: could not load "${next.title}".`, err)
    } finally {
      setFieldsLoading(false)
    }
  }, [])

  // First choice: the remembered layer (by key, then title), even when it is turned off or out of scale right
  // now, so the remembered layer and fields aren't replaced. Otherwise the top visible layer.
  React.useEffect(() => {
    if (target || !view?.map) return
    if (remembered.layerKey || remembered.layerTitle) {
      const all = collectTargets(view.map, view.scale, true)
      const match = all.find(t => t.key === remembered.layerKey) ?? all.find(t => t.title === remembered.layerTitle)
      if (match) {
        void chooseTarget(match, remembered.fields)
        return
      }
    }
    if (targets.length) void chooseTarget(targets[0])
    // Only the first choice matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, view])

  // Keep the chosen layer in the list even when it is hidden or out of scale, so the choice isn't lost.
  const targetHidden = !!target && !targets.some(t => t.key === target.key)
  const targetOptions = target && !targets.some(t => t.key === target.key) ? [target, ...targets] : targets

  // ---------- adding labels ----------
  const addGraphics = React.useCallback((items: Array<{ point: __esri.Point, text: string, key: string | null }>) => {
    if (!view || !items.length) return
    const layer = drawLayer ?? ensureFallbackLayer(view, props.id, translate('alFallbackLayerTitle'))
    const labels = items.map(item => ({
      id: makeId(),
      key: item.key,
      graphic: new Graphic({
        geometry: item.point.clone(),
        symbol: new TextSymbol(toTextSymbolProperties(style, item.text) as any),
        attributes: labelAttributes(item.key)
      })
    }))
    labels.forEach(l => { trackedRef.current.add(l.graphic) })
    layer.addMany(labels.map(l => l.graphic))
    setAdded(list => [...list, ...labels])
    record(translate('alAdded'), () => {
      labels.forEach(l => { (l.graphic.layer as __esri.GraphicsLayer)?.remove(l.graphic) })
      setAdded(list => list.filter(l => !labels.includes(l)))
    }, () => {
      if (!layer.destroyed) layer.addMany(labels.map(l => l.graphic))
      setAdded(list => [...list, ...labels])
    })
  }, [view, drawLayer, props.id, style, record, translate])

  /** One click: place free text, or label the chosen layer's feature at the point. */
  const place = async (point: __esri.Point, placeTab: Tab) => {
    if (!view) return
    if (placeTab === 'text') {
      if (!freeText.trim()) {
        flash(translate('alNeedText'))
        return
      }
      addGraphics([{ point, text: freeText, key: null }])
      return
    }

    if (!target || !fields.length) {
      flash(translate('alNeedLayer'))
      return
    }
    let feature: __esri.Graphic
    try {
      feature = await queryFeatureAt(view, target, point, tolerance)
    } catch (err) {
      console.warn(`Attribute Label: could not query "${target.title}".`, err)
      flash(translate('alQueryFailed', { layer: target.title }))
      return
    }
    if (!feature) {
      flash(translate('alNoFeatureHere', { layer: target.title }))
      return
    }
    const key = featureKey(target, feature)
    const alreadyLabelled = !!key && added.some(l => l.key === key && l.graphic.layer)
    if (alreadyLabelled && !allowMultiple) {
      flash(translate('alAlreadyLabelled'))
      return
    }
    const parts = fields
      .map(name => {
        const field = fieldOptions.find(f => f.name === name)
        return field ? { label: field.alias, value: formatValue(target.layer, feature, name) } : null
      })
      .filter(Boolean)
    const text = buildLabelText(parts, join, showFieldNames)
    if (!text) {
      flash(translate('alEmptyValues'))
      return
    }
    // A second label on the same feature goes where the map was clicked, so it doesn't sit on the first.
    const at = placeAt === 'centre' && !alreadyLabelled ? (labelPointFor(feature.geometry) ?? point) : point
    addGraphics([{ point: at, text, key }])
  }
  // Map handlers are registered once per mode; they call the latest place() through this ref.
  const placeRef = React.useRef(place)
  placeRef.current = place

  // ---------- Map Context Menu hand-off ----------
  const mutableState = (props as any).mutableStateProps
  const pendingKey = REQUEST_KEYS.find(key => mutableState?.[key])
  const pendingRequest = pendingKey ? (mutableState[pendingKey] as LabelRequest) : null

  React.useEffect(() => {
    if (!pendingRequest || !view) return
    // Clear the request first so a re-render or remount does not run it again.
    const store = MutableStoreManager.getInstance()
    REQUEST_KEYS.forEach(key => { if (mutableState?.[key]) store.updateStateValue(props.id, key, null) })

    const requestPoint = requestToViewPoint(pendingRequest, view)
    if (!requestPoint) {
      flash(translate('alInvalidRequest'))
      return
    }
    const requestTab: Tab = pendingRequest.mode === 'text' ? 'text' : 'layer'
    setTab(requestTab)
    // The widget may have just opened: wait until the layer and its fields are ready.
    setQueued({ point: requestPoint, tab: requestTab })
    // Only the request's identity matters; mutableState is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest, view])

  React.useEffect(() => {
    if (!queued) return
    if (queued.tab === 'layer' && (fieldsLoading || (!target && targets.length > 0))) return
    setQueued(null)
    void placeRef.current(queued.point, queued.tab)
  }, [queued, fieldsLoading, target, targets])

  // ---------- place mode: every click adds a label until Esc or Stop ----------
  const tabRef = React.useRef(tab)
  tabRef.current = tab

  React.useEffect(() => {
    if (!placing || !view) return
    const container = view.container as HTMLElement
    const previousCursor = container?.style.cursor
    if (container) container.style.cursor = 'crosshair'

    const handle = view.on('click', (event: __esri.ViewClickEvent) => {
      // Stop the map's own popup from opening for this click.
      event.stopPropagation()
      if (event.mapPoint) void placeRef.current(event.mapPoint, tabRef.current)
    })
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMapMode(null) }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      handle.remove()
      document.removeEventListener('keydown', onKeyDown)
      if (container) container.style.cursor = previousCursor
    }
  }, [placing, view])

  // ---------- move mode: drag any label added here; dragging anywhere else still pans ----------
  const recordRef = React.useRef(record)
  recordRef.current = record
  const labelsRef = React.useRef<AddedLabel[]>([])
  labelsRef.current = added

  React.useEffect(() => {
    if (!moving || !view) return
    const container = view.container as HTMLElement
    const previousCursor = container?.style.cursor ?? ''

    /** The top label under a screen point. Labels added last are drawn on top, so test from the end. */
    const labelAt = (x: number, y: number): __esri.Graphic | null => {
      const labels = labelsRef.current
      for (let i = labels.length - 1; i >= 0; i--) {
        const graphic = labels[i].graphic
        const symbol = graphic.symbol as __esri.TextSymbol
        if (!graphic.layer || !graphic.geometry || symbol?.type !== 'text') continue
        const screen = view.toScreen(graphic.geometry as __esri.Point)
        if (screen && isOnLabel(x, y, {
          x: screen.x, y: screen.y, text: symbol.text, fontSize: symbol.font?.size, align: symbol.horizontalAlignment as any, angle: symbol.angle
        })) return graphic
      }
      return null
    }

    // The offset keeps the label from jumping so its anchor sits under the pointer.
    let dragging: { graphic: __esri.Graphic, dx: number, dy: number, from: __esri.Geometry } | null = null
    const handles = [
      view.on('pointer-move', (event) => {
        if (!dragging && container) container.style.cursor = labelAt(event.x, event.y) ? 'move' : previousCursor
      }),
      view.on('drag', (event) => {
        if (event.action === 'start') {
          const graphic = labelAt(event.origin.x, event.origin.y)
          if (!graphic) return
          const screen = view.toScreen(graphic.geometry as __esri.Point)
          dragging = { graphic, dx: screen.x - event.origin.x, dy: screen.y - event.origin.y, from: graphic.geometry.clone() }
        }
        if (!dragging) return
        // Claiming the drag stops the map from panning.
        event.stopPropagation()
        const mapPoint = view.toMap({ x: event.x + dragging.dx, y: event.y + dragging.dy } as any)
        if (mapPoint) dragging.graphic.geometry = mapPoint
        if (event.action === 'end') {
          const { graphic, from } = dragging
          const to = graphic.geometry.clone()
          recordRef.current(translate('alLabelMoved'), () => { graphic.geometry = from }, () => { graphic.geometry = to })
          dragging = null
        }
      }),
      // Clicking a label shouldn't open the popup of the feature underneath.
      view.on('click', (event) => { if (labelAt(event.x, event.y)) event.stopPropagation() })
    ]
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMapMode(null) }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      handles.forEach(h => { h.remove() })
      document.removeEventListener('keydown', onKeyDown)
      if (container) container.style.cursor = previousCursor
    }
  }, [moving, view, translate])

  // Take map interaction ownership while placing or moving, and give it back afterwards if we still have it.
  const anyMode = mapMode !== null
  React.useEffect(() => {
    if (!anyMode || !mapWidgetId) return
    getAppStore().dispatch(appActions.requestAutoControlMapWidget(mapWidgetId, props.id))
    return () => {
      const owner = getAppStore().getState().mapWidgetsInfo?.[mapWidgetId]?.autoControlWidgetId
      if (owner === props.id) getAppStore().dispatch(appActions.releaseAutoControlMapWidget(mapWidgetId))
    }
  }, [anyMode, mapWidgetId, props.id])

  // Another widget took over the map: leave the mode quietly.
  React.useEffect(() => {
    if (!anyMode) {
      hadMapControlRef.current = false
      return
    }
    if (autoControlWidgetId === props.id) hadMapControlRef.current = true
    else if (hadMapControlRef.current) setMapMode(null)
  }, [anyMode, autoControlWidgetId, props.id])

  // Closing the widget (e.g. in a Widget Controller) ends placing or moving, and puts a label being edited back.
  React.useEffect(() => {
    if (props.state === WidgetState.Closed) {
      setMapMode(null)
      cancelEditRef.current()
    }
  }, [props.state])

  // ---------- Draw widget layer ----------
  // Draw adds its layer when it first opens; watch for it, and move any fallback labels across.
  React.useEffect(() => {
    if (!view || !jimuMapView) return
    const check = () => {
      const layer = findDrawLayer(view, jimuMapView.id)
      setDrawLayer(layer)
      setLayersVersion(n => n + 1)
      if (layer) {
        const moved = moveFallbackToDraw(view, props.id, layer)
        if (moved) flash(translate('alMoved', { count: moved }))
      }
    }
    check()
    const handle = reactiveUtils.watch(() => view.map?.allLayers?.length, check)
    return () => { handle.remove() }
  }, [view, jimuMapView, props.id, flash, translate])

  // Labels that appear on the map without being added here join the list, so they can be edited here:
  // ours restored by Save Experience State (recognised by their attributes), and text drawn with Draw.
  const adopt = React.useCallback((graphics: __esri.Graphic[], drawText: boolean) => {
    const picked = graphics.filter(g =>
      !trackedRef.current.has(g) && (g.symbol as any)?.type === 'text' && !!(g.symbol as any).text && (isOwnLabel(g.attributes) || drawText))
    if (!picked.length) return
    picked.forEach(g => { trackedRef.current.add(g) })
    // A restore replaces the labels the undo history refers to.
    if (picked.some(g => isOwnLabel(g.attributes))) {
      undoStackRef.current = []
      redoStackRef.current = []
    }
    setAdded(list => [...list, ...picked.map(graphic => ({ id: makeId(), graphic, key: labelKeyOf(graphic.attributes) }))])
  }, [])

  // Watch Draw's layer, Save Experience State's holding layer and our own; also re-render when labels change
  // elsewhere (deleted or edited with the Draw widget).
  React.useEffect(() => {
    if (!view || !jimuMapView) return
    const sources = [
      { layer: drawLayer, drawText: includeDrawText },
      { layer: findSaveStateLayer(view, jimuMapView.id), drawText: includeDrawText },
      { layer: findFallbackLayer(view, props.id), drawText: false }
    ].filter(source => source.layer)
    sources.forEach(source => { adopt(source.layer.graphics.toArray(), source.drawText) })
    const handles = sources.map(source => source.layer.graphics.on('change', (event) => {
      if (event.added?.length) adopt(event.added, source.drawText)
      setLayerChanges(n => n + 1)
    }))
    return () => { handles.forEach(h => { h.remove() }) }
  }, [view, jimuMapView, drawLayer, includeDrawText, added, props.id, adopt, layersVersion])

  // Remove the fallback layer when the widget goes away; Draw's layer is Draw's to manage.
  React.useEffect(() => {
    if (!view) return
    return () => {
      const fallback = findFallbackLayer(view, props.id)
      if (fallback && !view.destroyed) {
        view.map.remove(fallback)
        fallback.destroy()
      }
    }
  }, [view, props.id])

  // Hovering a row marks its label on the map: a copy with transparent text, no halo, and a lightly tinted box
  // with a thin outline in the theme colour.
  React.useEffect(() => {
    const label = added.find(l => l.id === hoverId)
    const symbol = label?.graphic.symbol as __esri.TextSymbol
    if (!view || !label?.graphic.layer || !symbol) return
    const [r, g, b] = themePrimary()
    const outline = symbol.clone()
    outline.color = [0, 0, 0, 0] as any
    outline.haloColor = null
    outline.haloSize = 0
    outline.backgroundColor = [r, g, b, 0.12] as any
    outline.borderLineColor = [r, g, b, 0.9] as any
    outline.borderLineSize = 1.5
    const highlight = new Graphic({ geometry: label.graphic.geometry, symbol: outline })
    view.graphics.add(highlight)
    return () => { if (!view.destroyed) view.graphics.remove(highlight) }
  }, [view, hoverId, added])

  // ---------- label list actions ----------
  const zoomTo = (label: AddedLabel) => {
    if (!view || !label.graphic.geometry) return
    void view.goTo({ target: label.graphic.geometry, zoom: Math.max(view.zoom ?? 0, MIN_ZOOM_TO) })
  }

  const deleteLabel = (label: AddedLabel) => {
    if (editing?.id === label.id) setEditing(null)
    if (hoverId === label.id) setHoverId(null)
    const layer = label.graphic.layer as __esri.GraphicsLayer
    const index = added.indexOf(label)
    layer?.remove(label.graphic)
    setAdded(list => list.filter(l => l.id !== label.id))
    record(translate('alDeleted'), () => {
      if (layer && !layer.destroyed) layer.add(label.graphic)
      setAdded(list => [...list.slice(0, index), label, ...list.slice(index)])
    }, () => {
      (label.graphic.layer as __esri.GraphicsLayer)?.remove(label.graphic)
      setAdded(list => list.filter(l => l.id !== label.id))
    })
  }

  const clearAll = (labels: AddedLabel[]) => {
    cancelEditRef.current()
    setMapMode(current => (current === 'move' ? null : current))
    const removed = labels.map(label => ({ label, layer: label.graphic.layer as __esri.GraphicsLayer }))
    removed.forEach(({ label, layer }) => { layer?.remove(label.graphic) })
    setAdded(list => list.filter(l => !labels.includes(l)))
    record(translate('alCleared', { count: labels.length }), () => {
      removed.forEach(({ label, layer }) => { if (layer && !layer.destroyed) layer.add(label.graphic) })
      setAdded(list => [...list, ...labels])
    }, () => {
      labels.forEach(label => { (label.graphic.layer as __esri.GraphicsLayer)?.remove(label.graphic) })
      setAdded(list => list.filter(l => !labels.includes(l)))
    })
  }

  // ---------- editing an added label: text and style, shown live on the map ----------
  const startEdit = (label: AddedLabel) => {
    cancelEditRef.current()
    const symbol = label.graphic.symbol as __esri.TextSymbol
    if (!symbol) return
    setEditing({ id: label.id, text: symbol.text ?? '', style: styleFromSymbol(symbol), original: symbol.clone() })
  }

  const changeEdit = (patch: { text?: string, style?: Partial<LabelStyle> }) => {
    if (!editing) return
    const next = { ...editing, text: patch.text ?? editing.text, style: patch.style ? normaliseStyle({ ...editing.style, ...patch.style }) : editing.style }
    setEditing(next)
    const label = added.find(l => l.id === next.id)
    // An empty text box would make the label vanish; keep the last text on the map until there is some.
    if (label) label.graphic.symbol = restyle(next.original, next.style, next.text.trim() ? next.text : next.original.text)
  }

  const cancelEdit = () => {
    if (!editing) return
    const label = added.find(l => l.id === editing.id)
    if (label?.graphic.layer) label.graphic.symbol = editing.original
    setEditing(null)
  }
  const cancelEditRef = React.useRef(cancelEdit)
  cancelEditRef.current = cancelEdit

  const saveEdit = () => {
    if (!editing?.text.trim()) return
    const label = added.find(l => l.id === editing.id)
    if (label) {
      const original = editing.original
      const edited = restyle(original, editing.style, editing.text)
      label.graphic.symbol = edited
      record(translate('alLabelEdited'), () => { label.graphic.symbol = original }, () => { label.graphic.symbol = edited })
    }
    setEditing(null)
  }

  // ---------- style ----------
  const updateStyle = (patch: Partial<LabelStyle>) => { setStyle(current => normaliseStyle({ ...current, ...patch })) }

  const savePreset = () => {
    const name = (presetName ?? '').trim() || translate('alPresetDefaultName', { n: presets.length + 1 })
    setPresets(list => [...list.filter(p => p.name !== name), { name, style }])
    setPresetName(null)
    flash(translate('alStyleSaved'))
  }

  const styleSummary = [style.fontFamily, `${style.fontSize} pt`, style.bold && translate('alBold'), style.italic && translate('alItalic'), style.halo && translate('alHalo')]
    .filter(Boolean).join(' · ')

  // ---------- render ----------
  // Labels removed with Draw's own tools have no layer any more.
  const liveLabels = added.filter(l => l.graphic.layer)
  const inFallback = liveLabels.some(l => (l.graphic.layer as any)?.id !== drawLayer?.id)
  const canPlace = tab === 'text' ? !!freeText.trim() : !!target && fields.length > 0 && !fieldsLoading

  const fieldSummary = target
    ? `${target.title} · ${translate(fields.length === 1 ? 'alOneField' : 'alFieldCount', { count: fields.length })}`
    : translate('alChooseLayer')

  const layerTab = (
    <Collapsible
      title={translate('alLayerAndFields')}
      open={sourceOpen}
      onToggle={() => { setSourceOpen(!sourceOpen) }}
      summary={<span className='al-summary' title={fieldSummary}>{fieldSummary}</span>}
    >
      <div className='al-section'>
        <div className='al-section-title'>{translate('alLayer')}</div>
        {targetOptions.length
          ? (
            <Select
              size='sm'
              value={target?.key ?? ''}
              aria-label={translate('alLayer')}
              placeholder={translate('alChooseLayer')}
              onClick={refreshTargets}
              onChange={(event) => { void chooseTarget(targetOptions.find(t => t.key === event.target.value) ?? null) }}
            >
              {targetOptions.map(t => (
                <Option key={t.key} value={t.key}>
                  {targets.some(v => v.key === t.key) ? targetLabel(t) : translate('alNotVisible', { title: targetLabel(t) })}
                </Option>
              ))}
            </Select>
            )
          : <div className='al-hint'>{translate('alNoVisibleLayers')}</div>}
        {targetHidden && <div className='al-hint'>{translate('alNotVisibleHint')}</div>}
      </div>

      {target && (
        <div className='al-section'>
          <div className='al-section-title'>
            {translate('alFields')}
            <label>
              <Checkbox checked={showFieldNames} onChange={(_e, checked) => { setShowFieldNames(checked) }} />
              {translate('alShowFieldNames')}
            </label>
          </div>
          {fieldsLoading
            ? <div className='al-row al-hint'><Loading type={LoadingType.Donut} width={16} height={16} />{translate('alLoadingFields')}</div>
            : (
              <FieldList
                idPrefix={`al-${props.id}`}
                layer={target.layer}
                fields={fieldOptions}
                sample={sample}
                selected={fields}
                translate={translate}
                onToggle={(name) => { setFields(current => toggleField(current, name)) }}
              />
              )}
          {fields.length > 1 && (
            <div className='al-row'>
              <span className='al-hint' style={{ flex: 'none' }}>{translate('alJoinWith')}</span>
              <JoinPicker value={join} translate={translate} onChange={setJoin} />
            </div>
          )}
        </div>
      )}

      <div className='al-section'>
        <div className='al-section-title'>{translate('alPlaceAt')}</div>
        <div>
          <Segmented<PlaceAt>
            value={placeAt}
            label={translate('alPlaceAt')}
            options={[{ value: 'centre', label: translate('alPlaceCentre') }, { value: 'click', label: translate('alPlaceClick') }]}
            onChange={setPlaceAt}
          />
        </div>
      </div>
    </Collapsible>
  )

  const textSummary = firstLine(freeText.trim()) || translate('alFreeTextPlaceholder')
  const textTab = (
    <Collapsible
      title={translate('alText')}
      open={sourceOpen}
      onToggle={() => { setSourceOpen(!sourceOpen) }}
      summary={<span className='al-summary' title={freeText}>{textSummary}</span>}
    >
      <TextArea
        height={72}
        value={freeText}
        placeholder={translate('alFreeTextPlaceholder')}
        aria-label={translate('alText')}
        onChange={(event) => { setFreeText(event.target.value) }}
      />
      <span className='al-hint'>{translate('alTextHint')}</span>
    </Collapsible>
  )

  const styleSection = (
    <Collapsible
      title={translate('alLabelStyle')}
      open={styleOpen}
      onToggle={() => { setStyleOpen(!styleOpen) }}
      summary={
        <>
          <span className='al-summary' title={styleSummary}>{styleSummary}</span>
          <span
            className='al-aa'
            aria-hidden='true'
            style={{
              fontFamily: `'${style.fontFamily}', Arial, sans-serif`,
              fontWeight: style.bold ? 700 : 400,
              fontStyle: style.italic ? 'italic' : 'normal',
              color: style.color,
              textShadow: style.halo ? `0 0 2px ${style.haloColor}, 0 0 2px ${style.haloColor}` : 'none'
            }}
          >
            Aa
          </span>
        </>
      }
    >
      <div className='al-presets'>
        {presets.map(preset => (
          <span className='al-chip' key={preset.name}>
            <button
              type='button'
              title={translate('alApplyPreset', { name: preset.name })}
              onClick={() => { setStyle(normaliseStyle(preset.style)); flash(translate('alPresetApplied', { name: preset.name })) }}
            >
              {preset.name}
            </button>
            <button
              type='button'
              className='al-chip-x'
              title={translate('alDeletePreset', { name: preset.name })}
              aria-label={translate('alDeletePreset', { name: preset.name })}
              onClick={() => { setPresets(list => list.filter(p => p !== preset)) }}
            >
              <CloseOutlined size={10} />
            </button>
          </span>
        ))}
        {presetName === null && (
          <span className='al-chip is-new'>
            <button type='button' onClick={() => { setPresetName('') }}>{translate('alSaveStyle')}</button>
          </span>
        )}
        <Button size='sm' type='tertiary' icon className='al-mini-btn' title={translate('alResetStyle')} aria-label={translate('alResetStyle')} onClick={() => { setStyle(configStyle) }}>
          <ResetOutlined size={14} />
        </Button>
      </div>
      {presetName !== null && (
        <div className='al-preset-name'>
          <TextInput
            size='sm'
            className='flex-grow-1'
            autoFocus
            value={presetName}
            placeholder={translate('alPresetDefaultName', { n: presets.length + 1 })}
            aria-label={translate('alPresetName')}
            onChange={(event) => { setPresetName(event.target.value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') savePreset()
              if (event.key === 'Escape') setPresetName(null)
            }}
          />
          <Button size='sm' onClick={() => { setPresetName(null) }}>{translate('alCancel')}</Button>
          <Button size='sm' type='primary' onClick={savePreset}>{translate('alSave')}</Button>
        </div>
      )}
      <StyleEditor style={style} translate={translate} expanded={moreStyle} onExpandedChange={setMoreStyle} onChange={updateStyle} />
    </Collapsible>
  )

  const labelsSection = liveLabels.length > 0 && (
    <Collapsible
      title={translate('alLabelsOnMap')}
      open={listOpen}
      onToggle={() => { setListOpen(!listOpen) }}
      summary={<><span className='al-spacer' /><span className='al-count'>{liveLabels.length}</span></>}
    >
      <div className='al-row'>
        <Button
          size='sm'
          type={moving ? 'primary' : 'default'}
          aria-pressed={moving}
          disabled={!view}
          onClick={() => { setMapMode(moving ? null : 'move') }}
        >
          <MoveOutlined size={14} />
          <span className='ml-1'>{translate(moving ? 'alDone' : 'alMove')}</span>
        </Button>
        <span className='al-spacer' />
        <Button size='sm' type='tertiary' onClick={() => { clearAll(liveLabels) }}>
          <TrashOutlined size={14} />
          <span className='ml-1'>{translate('alClearAll')}</span>
        </Button>
      </div>
      <div className='al-list'>
        {liveLabels.map((label, index) => {
          const text = labelOf(label.graphic)
          if (editing?.id === label.id) {
            return (
              <div className='al-edit' key={label.id}>
                <div className='al-row'>
                  <span className='al-n'>{index + 1}</span>
                  <span className='al-hint'>{translate('alEditing', { n: index + 1 })}</span>
                </div>
                <TextArea
                  height={72}
                  value={editing.text}
                  aria-label={translate('alLabelText')}
                  autoFocus
                  onChange={(event) => { changeEdit({ text: event.target.value }) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') cancelEdit()
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) saveEdit()
                  }}
                />
                <StyleEditor
                  style={editing.style}
                  translate={translate}
                  expanded={editMoreStyle}
                  onExpandedChange={setEditMoreStyle}
                  onChange={(patch) => { changeEdit({ style: patch }) }}
                />
                <div className='al-edit-actions'>
                  <Button size='sm' onClick={cancelEdit}>{translate('alCancel')}</Button>
                  <Button size='sm' type='primary' disabled={!editing.text.trim()} onClick={saveEdit}>{translate('alSave')}</Button>
                </div>
              </div>
            )
          }
          return (
            <div
              className='al-list-row'
              key={label.id}
              onMouseEnter={() => { setHoverId(label.id) }}
              onMouseLeave={() => { setHoverId(current => (current === label.id ? null : current)) }}
              onFocus={() => { setHoverId(label.id) }}
              onBlur={() => { setHoverId(current => (current === label.id ? null : current)) }}
            >
              <span className='al-n'>{index + 1}</span>
              <span className='al-list-text' title={text}>{firstLine(text)}</span>
              <span className='al-list-actions'>
                <Button size='sm' type='tertiary' icon className='al-mini-btn' title={translate('alEditText')} aria-label={translate('alEditText')} onClick={() => { startEdit(label) }}>
                  <EditOutlined size={14} />
                </Button>
                <Button size='sm' type='tertiary' icon className='al-mini-btn' title={translate('alZoomTo')} aria-label={translate('alZoomTo')} onClick={() => { zoomTo(label) }}>
                  <ZoomInOutlined size={14} />
                </Button>
                <Button size='sm' type='tertiary' icon className='al-mini-btn' title={translate('alDelete')} aria-label={translate('alDelete')} onClick={() => { deleteLabel(label) }}>
                  <TrashOutlined size={14} />
                </Button>
              </span>
            </div>
          )
        })}
      </div>
      <span className='al-hint'>{translate('alListHint')}</span>
      {inFallback && <span className='al-hint'>{translate('alNotInDraw')}</span>}
    </Collapsible>
  )

  let body: React.ReactNode
  if (!mapWidgetId) {
    body = <div className='al-empty'>{translate('alNoMap')}</div>
  } else if (is3d) {
    body = <div className='al-empty'>{translate('al3dNote')}</div>
  } else {
    body = (
      <>
        <div className='al-tabs' role='tablist' aria-label={translate('alSource')}>
          <button type='button' role='tab' aria-selected={tab === 'layer'} onClick={() => { setTab('layer'); setSourceOpen(true) }}>
            <SelectPointOutlined size={14} />{translate('alTabLayer')}
          </button>
          <button type='button' role='tab' aria-selected={tab === 'text'} onClick={() => { setTab('text'); setSourceOpen(true) }}>
            <TextOutlined size={14} />{translate('alTabText')}
          </button>
        </div>
        {tab === 'layer' ? layerTab : textTab}
        {styleSection}
        {labelsSection}
      </>
    )
  }

  const bannerText = moving ? translate('alBannerMove') : translate(tab === 'text' ? 'alBannerText' : 'alBannerLayer')

  return (
    <div css={widgetStyle} className='jimu-widget widget-attribute-label'>
      {mapWidgetId && (
        <JimuMapViewComponent useMapWidgetId={mapWidgetId} onActiveViewChange={setJimuMapView} />
      )}

      <div className='al-body'>{body}</div>

      {status && (
        <div className='al-status' role='status'>
          <span>{status.message}</span>
          {status.canUndo && <button type='button' title={translate('alUndoKeys')} onClick={undoLast}>{translate('alUndo')}</button>}
          {status.canRedo && <button type='button' title={translate('alRedoKeys')} onClick={redoLast}>{translate('alRedo')}</button>}
        </div>
      )}

      {mapWidgetId && !is3d && (
        <div className='al-footer is-stacked'>
          {placing && (
            <span className='al-placing'><span className='al-dot' />{translate(tab === 'text' ? 'alPlacingText' : 'alPlacingLayer')}</span>
          )}
          <Button
            size='sm'
            type={placing ? 'default' : 'primary'}
            disabled={!view || (!placing && !canPlace)}
            onClick={() => { setMapMode(placing ? null : 'place') }}
          >
            {placing ? <CloseOutlined size={14} /> : <SelectPointOutlined size={14} />}
            <span className='ml-1'>{translate(placing ? 'alStopPlacing' : 'alStartPlacing')}</span>
          </Button>
        </div>
      )}

      {anyMode && jimuMapView && (
        <MapBanner
          jimuMapView={jimuMapView}
          text={bannerText}
          actionLabel={translate(moving ? 'alDone' : 'alStop')}
          onAction={() => { setMapMode(null) }}
        />
      )}

    </div>
  )
}
