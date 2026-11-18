import type { JoinWith, LabelStyle, TextAlign } from '../config'

/**
 * Esri hosted fonts (the ones the Draw widget offers) that have regular, bold, italic and bold italic,
 * so the B / I toggles always work. A family without a variant falls back silently on the map.
 */
export const FONT_FAMILIES = ['Arial', 'Avenir Next LT Pro', 'BellTopo Sans', 'Alegreya', 'Josefin Slab']

// Matches the Draw widget's own text default, apart from the size, which suits a short label better.
export const DEFAULT_STYLE: LabelStyle = {
  fontFamily: 'Arial',
  fontSize: 12,
  bold: false,
  italic: false,
  underline: false,
  color: '#000000',
  halo: true,
  haloColor: '#ffffff',
  haloSize: 1,
  background: false,
  backgroundColor: '#ffffff',
  align: 'center',
  angle: 0
}

export const MIN_FONT_SIZE = 6
export const MAX_FONT_SIZE = 72
export const MAX_HALO_SIZE = 4
export const DEFAULT_TOLERANCE = 6

const SEPARATORS: Record<JoinWith, string> = { newline: '\n', space: ' ', comma: ', ', dash: ' – ' }
export const JOIN_OPTIONS = Object.keys(SEPARATORS) as JoinWith[]

export const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/** Fills in anything missing or out of range, so old or hand-edited config and stored choices are safe to use. */
export const normaliseStyle = (style: Partial<LabelStyle> | null | undefined): LabelStyle => {
  const s = { ...DEFAULT_STYLE, ...(style ?? {}) }
  const align: TextAlign = ['left', 'center', 'right'].includes(s.align) ? s.align : 'center'
  return {
    // Any family is kept: a label restyled in Draw may use one of its other hosted fonts.
    fontFamily: typeof s.fontFamily === 'string' && s.fontFamily.trim() ? s.fontFamily : DEFAULT_STYLE.fontFamily,
    fontSize: clamp(s.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_STYLE.fontSize),
    bold: !!s.bold,
    italic: !!s.italic,
    underline: !!s.underline,
    color: s.color || DEFAULT_STYLE.color,
    halo: !!s.halo,
    haloColor: s.haloColor || DEFAULT_STYLE.haloColor,
    haloSize: clamp(s.haloSize, 0, MAX_HALO_SIZE, DEFAULT_STYLE.haloSize),
    background: !!s.background,
    backgroundColor: s.backgroundColor || DEFAULT_STYLE.backgroundColor,
    align,
    angle: clamp(s.angle, -180, 180, 0)
  }
}

export const normaliseJoin = (join: unknown): JoinWith => (JOIN_OPTIONS.includes(join as JoinWith) ? join as JoinWith : 'newline')

export interface LabelPart {
  /** Field alias, shown before the value when field names are on. */
  label: string
  value: string
}

/** The label text: one part per ticked field, in the order they were ticked. Empty values are left out. */
export const buildLabelText = (parts: LabelPart[], join: JoinWith, showFieldNames: boolean): string =>
  parts
    .filter(part => part.value !== '')
    .map(part => (showFieldNames ? `${part.label}: ${part.value}` : part.value))
    .join(SEPARATORS[normaliseJoin(join)])

/** Adds a field to the end of the order, or takes it out. */
export const toggleField = (fields: string[], name: string): string[] =>
  fields.includes(name) ? fields.filter(f => f !== name) : [...fields, name]

/**
 * Autocast properties for a 2D TextSymbol. Kept to plain values so it can be tested and stored;
 * the caller passes it to `new TextSymbol()`.
 */
export const toTextSymbolProperties = (style: LabelStyle, text: string, opacity = 1) => {
  const s = normaliseStyle(style)
  return {
    type: 'text' as const,
    text,
    color: withOpacity(s.color, opacity),
    haloColor: s.halo && s.haloSize > 0 ? withOpacity(s.haloColor, opacity) : null,
    haloSize: s.halo ? s.haloSize : 0,
    backgroundColor: s.background ? withOpacity(s.backgroundColor, opacity) : null,
    borderLineColor: s.background ? withOpacity('rgba(0,0,0,0.25)', opacity) : null,
    borderLineSize: s.background ? 0.75 : null,
    horizontalAlignment: s.align,
    verticalAlignment: 'middle' as const,
    angle: s.angle,
    font: {
      family: s.fontFamily,
      size: s.fontSize,
      weight: s.bold ? 'bold' as const : 'normal' as const,
      style: s.italic ? 'italic' as const : 'normal' as const,
      decoration: s.underline ? 'underline' as const : 'none' as const
    }
  }
}

/** Parses #rgb, #rrggbb, #rrggbbaa and rgb()/rgba() into [r, g, b, a]. Returns null for anything else. */
export const parseColor = (color: string): [number, number, number, number] | null => {
  const c = String(color ?? '').trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.split('').map(x => x + x).join('')
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), Math.round(a * 1000) / 1000]
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])]
  return null
}

/** The colour as an [r, g, b, a] array (which TextSymbol accepts), with its alpha multiplied by opacity. */
export const withOpacity = (color: string, opacity: number): [number, number, number, number] => {
  const [r, g, b, a] = parseColor(color) ?? [0, 0, 0, 1]
  return [r, g, b, Math.round(a * opacity * 1000) / 1000]
}

/** Storage key for remembered choices. appId is null in deployed apps, so the page path is used as well. */
export const storageKey = (widgetId: string, appId?: string | null): string =>
  `exb-attribute-label:${appId || (typeof location !== 'undefined' ? location.pathname : '')}:${widgetId}`

/** [r, g, b, a] as #rrggbb when opaque, otherwise rgba(). */
export const toCssColor = (rgba: number[] | null | undefined): string | null => {
  if (!rgba || rgba.length < 3) return null
  const [r, g, b] = rgba.map(n => Math.round(Number(n) || 0))
  const a = rgba[3] === undefined ? 1 : Number(rgba[3])
  if (a >= 1) return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')
  return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`
}

const colorArray = (color: any): number[] | null =>
  !color ? null : Array.isArray(color) ? color : typeof color.toRgba === 'function' ? color.toRgba() : null

/**
 * The style of an existing TextSymbol (ours, or one restyled with the Draw widget), so it can be edited.
 * Takes the symbol loosely typed so it can be tested with plain objects.
 */
export const styleFromSymbol = (symbol: any): LabelStyle => {
  const font = symbol?.font ?? {}
  const haloColor = toCssColor(colorArray(symbol?.haloColor))
  const backgroundColor = toCssColor(colorArray(symbol?.backgroundColor))
  const haloSize = Number(symbol?.haloSize) || 0
  return normaliseStyle({
    fontFamily: font.family,
    fontSize: Number(font.size),
    bold: font.weight === 'bold' || font.weight === 'bolder',
    italic: font.style === 'italic' || font.style === 'oblique',
    underline: font.decoration === 'underline',
    color: toCssColor(colorArray(symbol?.color)) ?? DEFAULT_STYLE.color,
    halo: !!haloColor && haloSize > 0,
    haloColor: haloColor ?? DEFAULT_STYLE.haloColor,
    haloSize: haloSize || DEFAULT_STYLE.haloSize,
    background: !!backgroundColor,
    backgroundColor: backgroundColor ?? DEFAULT_STYLE.backgroundColor,
    align: symbol?.horizontalAlignment,
    angle: Number(symbol?.angle) || 0
  })
}

export interface LabelBox {
  /** Screen position of the label's point. */
  x: number
  y: number
  text: string
  /** Points. */
  fontSize: number
  align: TextAlign
  /** Degrees, clockwise. */
  angle: number
}

/**
 * Whether a screen point is on a label, from an estimate of the text's size (average glyph width 0.6 em,
 * line height 1.2 em). It is synchronous, so a drag can be claimed before the map starts to pan.
 */
export const isOnLabel = (px: number, py: number, box: LabelBox, padding = 4): boolean => {
  const em = (Number(box.fontSize) || DEFAULT_STYLE.fontSize) * 4 / 3
  const lines = String(box.text ?? '').split('\n')
  const width = Math.max(...lines.map(line => line.length)) * em * 0.6
  const height = lines.length * em * 1.2
  // Undo the rotation so the box can be tested unrotated.
  const rad = -(Number(box.angle) || 0) * Math.PI / 180
  const dx = px - box.x
  const dy = py - box.y
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad)
  const left = box.align === 'left' ? 0 : box.align === 'right' ? -width : -width / 2
  return rx >= left - padding && rx <= left + width + padding && Math.abs(ry) <= height / 2 + padding
}

/**
 * Every label this widget adds carries these attributes. They survive Graphic.toJSON / fromJSON, so a label
 * saved and restored by Save Experience State (or Draw's export / import) is still recognised as ours.
 */
export const LABEL_SOURCE = 'attribute-label'

export const labelAttributes = (key: string | null) => ({ alSource: LABEL_SOURCE, alKind: key ? 'feature' : 'text', alKey: key })

export const isOwnLabel = (attributes: any): boolean => attributes?.alSource === LABEL_SOURCE

/** The labelled feature's key (layer + object ID), or null for free text and other text. */
export const labelKeyOf = (attributes: any): string | null =>
  isOwnLabel(attributes) && attributes.alKey ? String(attributes.alKey) : null
