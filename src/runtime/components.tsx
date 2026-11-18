import { React, classNames } from 'jimu-core'
import { Button, Checkbox, NumericInput, Option, Select, Slider } from 'jimu-ui'
import { ColorPicker } from 'jimu-ui/basic/color-picker'
import { BoldOutlined } from 'jimu-icons/outlined/editor/bold'
import { ItalicOutlined } from 'jimu-icons/outlined/editor/italic'
import { UnderscoreOutlined } from 'jimu-icons/outlined/editor/underscore'
import { TextLeftOutlined } from 'jimu-icons/outlined/editor/text-left'
import { TextCenterOutlined } from 'jimu-icons/outlined/editor/text-center'
import { TextRightOutlined } from 'jimu-icons/outlined/editor/text-right'
import type { JoinWith, LabelStyle, TextAlign } from '../config'
import { FONT_FAMILIES, JOIN_OPTIONS, MAX_FONT_SIZE, MAX_HALO_SIZE, MIN_FONT_SIZE, clamp } from './label'
import { formatValue, type FieldOption } from './layers'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'

type Translate = (id: string, values?: any) => string

const JOIN_KEYS: Record<JoinWith, string> = { newline: 'alJoinNewline', space: 'alJoinSpace', comma: 'alJoinComma', dash: 'alJoinDash' }
const ALIGN_ICONS: Record<TextAlign, React.ComponentType<any>> = { left: TextLeftOutlined, center: TextCenterOutlined, right: TextRightOutlined }
const ALIGN_KEYS: Record<TextAlign, string> = { left: 'alAlignLeft', center: 'alAlignCenter', right: 'alAlignRight' }

/** A small row of toggle buttons where exactly one is pressed. */
export function Segmented<T extends string> (props: { value: T, options: Array<{ value: T, label: string, icon?: React.ComponentType<any> }>, label: string, onChange: (value: T) => void }) {
  return (
    <div className='al-seg' role='group' aria-label={props.label}>
      {props.options.map(option => {
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type='button'
            className={classNames({ 'is-icon': !!Icon })}
            aria-pressed={props.value === option.value}
            title={option.label}
            aria-label={Icon ? option.label : undefined}
            onClick={() => { props.onChange(option.value) }}
          >
            {Icon ? <Icon size={14} /> : option.label}
          </button>
        )
      })}
    </div>
  )
}

interface FieldListProps {
  idPrefix: string
  layer: any
  fields: FieldOption[]
  /** A feature of the layer, for sample values. */
  sample: __esri.Graphic | null
  selected: string[]
  translate: Translate
  onToggle: (name: string) => void
}

/** Field checkboxes with a sample value under each; ticked fields show their position in the label. */
export function FieldList (props: FieldListProps) {
  const { selected, translate } = props
  return (
    <div className='al-fields' role='group' aria-label={translate('alFields')}>
      {props.fields.map(field => {
        const order = selected.indexOf(field.name)
        const id = `${props.idPrefix}-field-${field.name}`
        const sample = props.sample ? formatValue(props.layer, props.sample, field.name) : ''
        return (
          <label key={field.name} className='al-field' htmlFor={id}>
            <Checkbox id={id} checked={order > -1} onChange={() => { props.onToggle(field.name) }} />
            <span className='al-field-name'>
              <span className='al-field-alias'>{field.alias}</span>
              {field.alias !== field.name && <span className='al-mono al-hint'>{field.name}</span>}
            </span>
            {order > -1 && selected.length > 1 && (
              <span className='al-field-order' title={translate('alFieldOrder', { n: order + 1 })}>{order + 1}</span>
            )}
            {sample && <span className='al-field-value'>{sample}</span>}
          </label>
        )
      })}
    </div>
  )
}

/** A bordered section with a header button that opens and closes it, and a summary shown either way. */
export function Collapsible (props: { title: string, summary?: React.ReactNode, open: boolean, onToggle: () => void, children: React.ReactNode }) {
  return (
    <div className={classNames('al-collapse', { 'is-open': props.open })}>
      <button type='button' className='al-collapse-head' aria-expanded={props.open} onClick={props.onToggle}>
        <RightOutlined size={12} className='al-chev' />
        <span className='al-collapse-title'>{props.title}</span>
        {props.summary}
      </button>
      {props.open && <div className='al-collapse-body'>{props.children}</div>}
    </div>
  )
}

export function JoinPicker (props: { value: JoinWith, translate: Translate, onChange: (join: JoinWith) => void }) {
  return (
    <Segmented
      value={props.value}
      label={props.translate('alJoinWith')}
      options={JOIN_OPTIONS.map(join => ({ value: join, label: props.translate(JOIN_KEYS[join]) }))}
      onChange={props.onChange}
    />
  )
}

interface StyleEditorProps {
  style: LabelStyle
  translate: Translate
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onChange: (patch: Partial<LabelStyle>) => void
}

/** Font, size, B / I / U and colour always; halo, background, alignment and angle behind a link. */
export function StyleEditor (props: StyleEditorProps) {
  const { style, translate, onChange } = props

  const toggle = (key: 'bold' | 'italic' | 'underline', Icon: React.ComponentType<any>, labelKey: string) => (
    <Button
      size='sm'
      icon
      type={style[key] ? 'primary' : 'default'}
      variant={style[key] ? 'outlined' : undefined}
      className='al-icon-btn'
      aria-pressed={style[key]}
      title={translate(labelKey)}
      aria-label={translate(labelKey)}
      onClick={() => { onChange({ [key]: !style[key] }) }}
    >
      <Icon size={14} />
    </Button>
  )

  return (
    <div className='al-style'>
      <div className='al-grid2'>
        <div>
          <span className='al-k'>{translate('alFont')}</span>
          <Select size='sm' value={style.fontFamily} aria-label={translate('alFont')} onChange={(event) => { onChange({ fontFamily: event.target.value }) }}>
            {(FONT_FAMILIES.includes(style.fontFamily) ? FONT_FAMILIES : [...FONT_FAMILIES, style.fontFamily])
              .map(family => <Option key={family} value={family}>{family}</Option>)}
          </Select>
        </div>
        <div>
          <span className='al-k'>{translate('alSize')}</span>
          <NumericInput
            size='sm'
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            value={style.fontSize}
            aria-label={translate('alSize')}
            onChange={(value) => { onChange({ fontSize: clamp(value, MIN_FONT_SIZE, MAX_FONT_SIZE, style.fontSize) }) }}
          />
        </div>
      </div>

      <div className='al-row'>
        {toggle('bold', BoldOutlined, 'alBold')}
        {toggle('italic', ItalicOutlined, 'alItalic')}
        {toggle('underline', UnderscoreOutlined, 'alUnderline')}
        <span className='al-spacer' />
        <ColorPicker color={style.color} aria-label={translate('alTextColour')} title={translate('alTextColour')} onChange={(color) => { onChange({ color }) }} />
      </div>

      <button type='button' className='al-link' aria-expanded={props.expanded} onClick={() => { props.onExpandedChange(!props.expanded) }}>
        {translate(props.expanded ? 'alLessStyle' : 'alMoreStyle')}
      </button>

      {props.expanded && (
        <>
          <div className='al-grid2'>
            <div>
              <span className='al-k'>{translate('alHalo')}</span>
              <div className='al-row'>
                <Checkbox checked={style.halo} aria-label={translate('alHalo')} onChange={(_e, checked) => { onChange({ halo: checked }) }} />
                <ColorPicker color={style.haloColor} aria-label={translate('alHaloColour')} title={translate('alHaloColour')} onChange={(haloColor) => { onChange({ haloColor }) }} />
                <NumericInput
                  size='sm'
                  min={0}
                  max={MAX_HALO_SIZE}
                  step={0.5}
                  value={style.haloSize}
                  disabled={!style.halo}
                  aria-label={translate('alHaloSize')}
                  onChange={(value) => { onChange({ haloSize: clamp(value, 0, MAX_HALO_SIZE, style.haloSize) }) }}
                />
              </div>
            </div>
            <div>
              <span className='al-k'>{translate('alBackground')}</span>
              <div className='al-row'>
                <Checkbox checked={style.background} aria-label={translate('alBackground')} onChange={(_e, checked) => { onChange({ background: checked }) }} />
                <ColorPicker color={style.backgroundColor} aria-label={translate('alBackgroundColour')} title={translate('alBackgroundColour')} onChange={(backgroundColor) => { onChange({ backgroundColor }) }} />
              </div>
            </div>
          </div>
          <div className='al-grid2'>
            <div>
              <span className='al-k'>{translate('alAlignment')}</span>
              <Segmented<TextAlign>
                value={style.align}
                label={translate('alAlignment')}
                options={(['left', 'center', 'right'] as TextAlign[]).map(align => ({ value: align, label: translate(ALIGN_KEYS[align]), icon: ALIGN_ICONS[align] }))}
                onChange={(align) => { onChange({ align }) }}
              />
            </div>
            <div>
              <span className='al-k'>{translate('alAngle', { angle: style.angle })}</span>
              <Slider
                min={-90}
                max={90}
                step={5}
                value={style.angle}
                aria-label={translate('alAngle', { angle: style.angle })}
                onChange={(event) => { onChange({ angle: Number(event.target.value) }) }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
