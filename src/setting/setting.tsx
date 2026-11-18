import { React, Immutable, hooks } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { NumericInput, Option, Radio, Label, Select, Switch } from 'jimu-ui'
import { ColorPicker } from 'jimu-ui/basic/color-picker'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import type { Config, IMConfig, JoinWith, LabelStyle, PlaceAt } from '../config'
import { DEFAULT_TOLERANCE, FONT_FAMILIES, JOIN_OPTIONS, MAX_FONT_SIZE, MAX_HALO_SIZE, MIN_FONT_SIZE, clamp, normaliseJoin, normaliseStyle } from '../runtime/label'
import defaultMessages from './translations/default'

const hintStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--sys-color-surface-paper-hint)' }
const JOIN_KEYS: Record<JoinWith, string> = { newline: 'alsJoinNewline', space: 'alsJoinSpace', comma: 'alsJoinComma', dash: 'alsJoinDash' }

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
  const translate = hooks.useTranslation(defaultMessages)
  const config = (props.config?.asMutable?.({ deep: true }) ?? {}) as Config
  const style = normaliseStyle(config.defaultStyle)
  const placeAt: PlaceAt = config.placeAt === 'click' ? 'click' : 'centre'

  const update = (patch: Partial<Config>) => {
    props.onSettingChange({ id: props.id, config: Immutable({ ...config, ...patch }) as IMConfig })
  }
  const updateStyle = (patch: Partial<LabelStyle>) => { update({ defaultStyle: normaliseStyle({ ...style, ...patch }) }) }

  const placeRadio = (value: PlaceAt, labelKey: string, hintKey: string) => (
    <div className='w-100 mb-2'>
      <Label className='d-flex align-items-center' style={{ cursor: 'pointer', gap: 8, margin: 0 }}>
        <Radio name={`al-place-${props.id}`} checked={placeAt === value} onChange={() => { update({ placeAt: value }) }} />
        {translate(labelKey)}
      </Label>
      <div className='text-break' style={{ ...hintStyle, paddingInlineStart: 24 }}>{translate(hintKey)}</div>
    </div>
  )

  return (
    <div className='widget-setting-attribute-label'>
      <SettingSection title={translate('alsMap')}>
        <SettingRow>
          <MapWidgetSelector
            useMapWidgetIds={props.useMapWidgetIds}
            onSelect={(useMapWidgetIds: string[]) => { props.onSettingChange({ id: props.id, useMapWidgetIds }) }}
          />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('alsMapHint')}</div>
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('alsPlaceAt')}>
        <SettingRow flow='wrap'>
          {placeRadio('centre', 'alsPlaceCentre', 'alsPlaceCentreHint')}
          {placeRadio('click', 'alsPlaceClick', 'alsPlaceClickHint')}
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('alsLabelText')}>
        <SettingRow label={translate('alsJoinWith')} flow='wrap'>
          <Select size='sm' value={normaliseJoin(config.defaultJoin)} onChange={(event) => { update({ defaultJoin: event.target.value as JoinWith }) }}>
            {JOIN_OPTIONS.map(join => <Option key={join} value={join}>{translate(JOIN_KEYS[join])}</Option>)}
          </Select>
        </SettingRow>
        <SettingRow label={translate('alsAllowMultiple')}>
          <Switch checked={config.allowMultiplePerFeature === true} aria-label={translate('alsAllowMultiple')} onChange={(event) => { update({ allowMultiplePerFeature: event.target.checked }) }} />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('alsAllowMultipleHint')}</div>
        </SettingRow>
        <SettingRow label={translate('alsShowFieldNames')}>
          <Switch checked={config.showFieldNames === true} aria-label={translate('alsShowFieldNames')} onChange={(event) => { update({ showFieldNames: event.target.checked }) }} />
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('alsDefaultStyle')}>
        <SettingRow label={translate('alsFont')} flow='wrap'>
          <Select size='sm' value={style.fontFamily} onChange={(event) => { updateStyle({ fontFamily: event.target.value }) }}>
            {FONT_FAMILIES.map(family => <Option key={family} value={family}>{family}</Option>)}
          </Select>
        </SettingRow>
        <SettingRow label={translate('alsSize')}>
          <NumericInput size='sm' style={{ width: 72 }} min={MIN_FONT_SIZE} max={MAX_FONT_SIZE} value={style.fontSize}
            aria-label={translate('alsSize')}
            onChange={(value) => { updateStyle({ fontSize: clamp(value, MIN_FONT_SIZE, MAX_FONT_SIZE, style.fontSize) }) }} />
        </SettingRow>
        <SettingRow label={translate('alsBold')}>
          <Switch checked={style.bold} aria-label={translate('alsBold')} onChange={(event) => { updateStyle({ bold: event.target.checked }) }} />
        </SettingRow>
        <SettingRow label={translate('alsItalic')}>
          <Switch checked={style.italic} aria-label={translate('alsItalic')} onChange={(event) => { updateStyle({ italic: event.target.checked }) }} />
        </SettingRow>
        <SettingRow label={translate('alsTextColour')}>
          <ColorPicker color={style.color} aria-label={translate('alsTextColour')} onChange={(color) => { updateStyle({ color }) }} />
        </SettingRow>
        <SettingRow label={translate('alsHalo')}>
          <Switch checked={style.halo} aria-label={translate('alsHalo')} onChange={(event) => { updateStyle({ halo: event.target.checked }) }} />
        </SettingRow>
        {style.halo && (
          <>
            <SettingRow label={translate('alsHaloColour')}>
              <ColorPicker color={style.haloColor} aria-label={translate('alsHaloColour')} onChange={(haloColor) => { updateStyle({ haloColor }) }} />
            </SettingRow>
            <SettingRow label={translate('alsHaloSize')}>
              <NumericInput size='sm' style={{ width: 72 }} min={0} max={MAX_HALO_SIZE} step={0.5} value={style.haloSize}
                aria-label={translate('alsHaloSize')}
                onChange={(value) => { updateStyle({ haloSize: clamp(value, 0, MAX_HALO_SIZE, style.haloSize) }) }} />
            </SettingRow>
          </>
        )}
        <SettingRow label={translate('alsBackground')}>
          <Switch checked={style.background} aria-label={translate('alsBackground')} onChange={(event) => { updateStyle({ background: event.target.checked }) }} />
        </SettingRow>
        {style.background && (
          <SettingRow label={translate('alsBackgroundColour')}>
            <ColorPicker color={style.backgroundColor} aria-label={translate('alsBackgroundColour')} onChange={(backgroundColor) => { updateStyle({ backgroundColor }) }} />
          </SettingRow>
        )}
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('alsStyleHint')}</div>
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('alsBehaviour')}>
        <SettingRow label={translate('alsIncludeDrawText')}>
          <Switch checked={config.includeDrawText !== false} aria-label={translate('alsIncludeDrawText')} onChange={(event) => { update({ includeDrawText: event.target.checked }) }} />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('alsIncludeDrawTextHint')}</div>
        </SettingRow>
        <SettingRow label={translate('alsRemember')}>
          <Switch checked={config.rememberChoices !== false} aria-label={translate('alsRemember')} onChange={(event) => { update({ rememberChoices: event.target.checked }) }} />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('alsRememberHint')}</div>
        </SettingRow>
        <SettingRow label={translate('alsTolerance')}>
          <NumericInput size='sm' style={{ width: 72 }} min={0} max={30} value={clamp(config.tolerance, 0, 30, DEFAULT_TOLERANCE)}
            aria-label={translate('alsTolerance')}
            onChange={(value) => { update({ tolerance: clamp(value, 0, 30, DEFAULT_TOLERANCE) }) }} />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('alsDrawHint')}</div>
        </SettingRow>
      </SettingSection>
    </div>
  )
}
