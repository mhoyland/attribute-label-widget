import type { ImmutableObject } from 'jimu-core'

/** Where a label goes: the feature's label point (inside a polygon, on a line), or exactly where the map was clicked. */
export type PlaceAt = 'centre' | 'click'

export type JoinWith = 'newline' | 'space' | 'comma' | 'dash'

export type TextAlign = 'left' | 'center' | 'right'

/** The parts of a 2D TextSymbol the widget lets people change. Colours are CSS colour strings. */
export interface LabelStyle {
  fontFamily: string
  /** Points. */
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
  halo: boolean
  haloColor: string
  /** Points. */
  haloSize: number
  background: boolean
  backgroundColor: string
  align: TextAlign
  /** Degrees, clockwise. */
  angle: number
}

/** Written to this widget's mutableStateProps.labelRequest by Map Context Menu before it opens the widget. */
export interface LabelRequest {
  requestId: string
  /** 'text' starts free text at the point instead of looking for features. */
  mode?: 'feature' | 'text'
  sourceWidgetId?: string
  source?: string
  latitude: number
  longitude: number
  mapX?: number
  mapY?: number
  wkid?: number
}

/** A named style people save in the widget; kept in the browser. */
export interface StylePreset {
  name: string
  style: LabelStyle
}

export interface Config {
  placeAt: PlaceAt
  defaultStyle: LabelStyle
  defaultJoin: JoinWith
  showFieldNames: boolean
  /**
   * Let a feature get more than one label (useful on large features). A second label goes where the map is
   * clicked, even when labels are placed at the feature centre.
   */
  allowMultiplePerFeature: boolean
  /** List text drawn with the Draw widget too, so it can be edited here. */
  includeDrawText: boolean
  /** Keep the last layer, fields and style in this browser. */
  rememberChoices: boolean
  /** Pixels around the point used to find point and line features. */
  tolerance: number
}

export type IMConfig = ImmutableObject<Config>
