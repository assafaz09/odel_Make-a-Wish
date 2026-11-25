import type { CSSProperties } from 'react'
import { popups } from '../content/popups.ts'
import { usePopupReveal } from '../hooks/usePopupReveal.ts'
import { PopupCard } from './PopupCard.tsx'

export function PopupStack() {
  const { runwayRef, setCardRef } = usePopupReveal(popups.length)

  return (
    <section
      ref={runwayRef}
      className="popup-runway"
      style={{ '--popup-count': popups.length } as CSSProperties}
    >
      <div className="popup-stage" aria-live="polite" aria-atomic="true">
        <div className="popup-stack">
          {popups.map((popup, index) => (
            <PopupCard
              key={popup.id}
              text={popup.text}
              scene={popup.id}
              index={index}
              bindRef={setCardRef}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
