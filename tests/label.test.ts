import { DEFAULT_STYLE, isOnLabel, isOwnLabel, labelAttributes, labelKeyOf, styleFromSymbol, toCssColor, buildLabelText, normaliseJoin, normaliseStyle, parseColor, toTextSymbolProperties, toggleField, withOpacity } from '../src/runtime/label'

describe('attribute-label label helpers', () => {
  const parts = [{ label: 'Address', value: '12 Market St' }, { label: 'Lot', value: 'LOT 1041' }]

  it('joins values in order with the chosen separator', () => {
    expect(buildLabelText(parts, 'newline', false)).toBe('12 Market St\nLOT 1041')
    expect(buildLabelText(parts, 'comma', false)).toBe('12 Market St, LOT 1041')
    expect(buildLabelText(parts, 'dash', false)).toBe('12 Market St – LOT 1041')
  })

  it('adds field names when asked and skips empty values', () => {
    expect(buildLabelText([...parts, { label: 'Owner', value: '' }], 'space', true)).toBe('Address: 12 Market St Lot: LOT 1041')
  })

  it('falls back to new line for an unknown join', () => {
    expect(normaliseJoin('pipe')).toBe('newline')
    expect(buildLabelText(parts, 'pipe' as any, false)).toBe('12 Market St\nLOT 1041')
  })

  it('keeps the order fields were ticked in', () => {
    expect(toggleField(['A'], 'C')).toEqual(['A', 'C'])
    expect(toggleField(['A', 'C', 'B'], 'C')).toEqual(['A', 'B'])
  })

  it('fills in and clamps style values', () => {
    expect(normaliseStyle(undefined)).toEqual(DEFAULT_STYLE)
    const s = normaliseStyle({ fontSize: 500, haloSize: -2, fontFamily: '', align: 'up' as any })
    expect(s.fontSize).toBe(72)
    expect(s.haloSize).toBe(0)
    expect(s.fontFamily).toBe('Arial')
    expect(normaliseStyle({ fontFamily: 'Oswald' }).fontFamily).toBe('Oswald')
    expect(s.align).toBe('center')
  })

  it('parses hex and rgb colours', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1])
    expect(parseColor('#00000080')).toEqual([0, 0, 0, 0.502])
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30, 0.5])
    expect(parseColor('red')).toBeNull()
    expect(withOpacity('#ff0000', 0.5)).toEqual([255, 0, 0, 0.5])
  })

  it('builds TextSymbol properties', () => {
    const p = toTextSymbolProperties({ ...DEFAULT_STYLE, bold: true, italic: true, underline: true, background: true, angle: 30 }, 'Hi')
    expect(p.type).toBe('text')
    expect(p.text).toBe('Hi')
    expect(p.font).toEqual({ family: 'Arial', size: 12, weight: 'bold', style: 'italic', decoration: 'underline' })
    expect(p.haloColor).toEqual([255, 255, 255, 1])
    expect(p.backgroundColor).toEqual([255, 255, 255, 1])
    expect(p.angle).toBe(30)
  })

  it('drops the halo and box when switched off', () => {
    const p = toTextSymbolProperties({ ...DEFAULT_STYLE, halo: false }, 'Hi')
    expect(p.haloColor).toBeNull()
    expect(p.haloSize).toBe(0)
    expect(p.backgroundColor).toBeNull()
  })

  it('reads a style back from a symbol', () => {
    const style = { ...DEFAULT_STYLE, fontFamily: 'Alegreya', fontSize: 18, bold: true, underline: true, color: '#ff0000', background: true, align: 'left' as const, angle: 15 }
    expect(styleFromSymbol(toTextSymbolProperties(style, 'x'))).toEqual(style)
  })

  it('reads Color objects and a symbol with no halo', () => {
    const colour = (rgba: number[]) => ({ toRgba: () => rgba })
    const s = styleFromSymbol({ color: colour([0, 0, 255, 0.5]), haloColor: null, haloSize: 0, font: { family: 'Arial', size: 22, weight: 'normal', style: 'normal' } })
    expect(s.color).toBe('rgba(0, 0, 255, 0.5)')
    expect(s.halo).toBe(false)
    expect(s.fontSize).toBe(22)
    expect(toCssColor([255, 255, 255, 1])).toBe('#ffffff')
  })

  it('finds a point on a label from its estimated box', () => {
    // 10 characters at 12 pt: about 96 px wide and 19 px tall.
    const box = { x: 100, y: 100, text: '0123456789', fontSize: 12, align: 'center' as const, angle: 0 }
    expect(isOnLabel(100, 100, box)).toBe(true)
    expect(isOnLabel(145, 105, box)).toBe(true)
    expect(isOnLabel(160, 100, box)).toBe(false)
    expect(isOnLabel(100, 120, box)).toBe(false)
    expect(isOnLabel(80, 100, { ...box, align: 'left' })).toBe(false)
    expect(isOnLabel(180, 100, { ...box, align: 'left' })).toBe(true)
    // Turned 90° clockwise, the label runs down the screen.
    expect(isOnLabel(100, 140, { ...box, angle: 90 })).toBe(true)
    expect(isOnLabel(140, 100, { ...box, angle: 90 })).toBe(false)
  })

  it('tags labels so they are recognised after a JSON round trip', () => {
    const feature = JSON.parse(JSON.stringify(labelAttributes('counties:42')))
    expect(isOwnLabel(feature)).toBe(true)
    expect(labelKeyOf(feature)).toBe('counties:42')
    expect(feature.alKind).toBe('feature')
    const text = JSON.parse(JSON.stringify(labelAttributes(null)))
    expect(isOwnLabel(text)).toBe(true)
    expect(labelKeyOf(text)).toBeNull()
    expect(text.alKind).toBe('text')
    expect(isOwnLabel({ jimuDrawId: 'abc' })).toBe(false)
    expect(isOwnLabel(null)).toBe(false)
  })
})
