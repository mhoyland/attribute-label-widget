import { React, ReactDOM } from 'jimu-core'
import type { JimuMapView } from 'jimu-arcgis'
import { bannerStyle } from './style'

interface MapBannerProps {
  jimuMapView: JimuMapView
  text: string
  actionLabel: string
  onAction: () => void
}

/**
 * A pill at the top of the map saying what a click or drag will do, with a Stop / Done button.
 * ExB 1.21 map UI lives in the <arcgis-map> shadow DOM where widget styles don't reach, so the banner is
 * portalled into a light-DOM host appended to the map component's default slot.
 */
export default function MapBanner (props: MapBannerProps) {
  const { jimuMapView } = props
  const view = jimuMapView?.view
  const [host, setHost] = React.useState<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!view) return
    const element = document.createElement('div')
    element.className = 'attribute-label-banner-host'
    element.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;'
    const mapElement = jimuMapView.mapComponent as unknown as HTMLElement
    if (mapElement) mapElement.appendChild(element); else view.ui.add(element, 'manual')
    setHost(element)
    return () => {
      setHost(null)
      if (mapElement) element.remove(); else if (!view.destroyed) view.ui.remove(element)
    }
  }, [view, jimuMapView])

  if (!host) return null
  return ReactDOM.createPortal(
    <div css={bannerStyle} className='attribute-label-banner' role='status'>
      <span>{props.text}</span>
      <button type='button' onClick={props.onAction}>{props.actionLabel}</button>
    </div>,
    host
  )
}
