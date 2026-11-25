import { useCallback } from 'react'

type PopupCardProps = {
  text: string
  scene: string
  index: number
  bindRef: (index: number, node: HTMLElement | null) => void
}

export function PopupCard({ text, scene, index, bindRef }: PopupCardProps) {
  const ref = useCallback(
    (node: HTMLElement | null) => {
      bindRef(index, node)
    },
    [bindRef, index],
  )

  return (
    <article
      ref={ref}
      className="popup-card"
      data-scene={scene}
      style={{ zIndex: index + 1 }}
    >
      <div className="popup-card__scene">
        {scene === 'welcome' ? (
          <>
            <span className="popup-card__glow popup-card__glow--pink" aria-hidden="true" />
            <span className="popup-card__glow popup-card__glow--teal" aria-hidden="true" />
            <span className="popup-card__dots" aria-hidden="true" />
          </>
        ) : null}
        {scene === 'excited' ? (
          <>
            <span className="popup-card__orb" aria-hidden="true" />
            <span className="popup-card__orb popup-card__orb--small" aria-hidden="true" />
          </>
        ) : null}
        {scene === 'soon' ? (
          <>
            <span className="popup-card__glow popup-card__glow--soon" aria-hidden="true" />
            <span className="popup-card__arc" aria-hidden="true" />
          </>
        ) : null}
        <div className="popup-card__copy">
          {scene === 'welcome' ? <span className="popup-card__rule" aria-hidden="true" /> : null}
          <p className="popup-card__text">{text}</p>
        </div>
        {scene === 'welcome' ? <span className="popup-card__hint" aria-hidden="true" /> : null}
      </div>
    </article>
  )
}
