import { useCallback, useLayoutEffect, useRef } from 'react'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const FRONT_REVEAL = 0.55

export function usePopupReveal(count: number) {
  const runwayRef = useRef<HTMLElement>(null)
  const cardRefs = useRef<Array<HTMLElement | null>>([])

  const setCardRef = useCallback((index: number, node: HTMLElement | null) => {
    cardRefs.current[index] = node
  }, [])

  useLayoutEffect(() => {
    const runway = runwayRef.current
    if (!runway || count <= 0) {
      return
    }

    const stage = runway.querySelector<HTMLElement>('.popup-stage')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const metrics = { stageHeight: 0, travel: 0, start: 0 }
    let lastScrollY = Number.NaN

    const measure = () => {
      const stageHeight = stage?.offsetHeight ?? 0
      metrics.stageHeight = stageHeight
      metrics.travel = Math.max(runway.offsetHeight - stageHeight, 0)
      metrics.start = runway.getBoundingClientRect().top + window.scrollY
      if (stageHeight > 0) {
        runway.style.setProperty('--stage', `${stageHeight}px`)
      }
    }

    const apply = () => {
      const scrollY = window.scrollY
      if (scrollY === lastScrollY) {
        return
      }
      lastScrollY = scrollY

      const reduced = motion.matches
      const cards = cardRefs.current

      if (reduced || count < 2 || metrics.stageHeight <= 0) {
        for (let index = 0; index < count; index += 1) {
          const card = cards[index]
          if (!card) {
            continue
          }
          card.style.setProperty('--reveal', '1')
          card.style.setProperty('--cover', '0')
          card.setAttribute('aria-hidden', 'false')
        }
        runway.style.setProperty('--lead', '0')
        return
      }

      const segment = metrics.travel / (count - 1)
      const traveled = clamp(window.scrollY - metrics.start, 0, metrics.travel)
      runway.style.setProperty('--lead', segment === 0 ? '0' : clamp(traveled / segment, 0, 1).toFixed(4))

      let front = 0
      const reveals: number[] = []
      for (let index = 0; index < count; index += 1) {
        const reveal =
          index === 0 || segment === 0 ? 1 : clamp((traveled - segment * (index - 1)) / segment, 0, 1)
        reveals[index] = reveal
        if (reveal >= FRONT_REVEAL) {
          front = index
        }
      }

      for (let index = 0; index < count; index += 1) {
        const card = cards[index]
        const reveal = reveals[index]
        if (!card || reveal === undefined) {
          continue
        }
        const cover =
          index === count - 1 || segment === 0 ? 0 : clamp((traveled - segment * index) / segment, 0, 1)
        card.style.setProperty('--reveal', reveal.toFixed(4))
        card.style.setProperty('--cover', cover.toFixed(4))
        card.setAttribute('aria-hidden', index === front ? 'false' : 'true')
      }
    }

    const onResize = () => {
      lastScrollY = Number.NaN
      measure()
      apply()
    }

    measure()
    apply()

    const observer = new ResizeObserver(onResize)
    observer.observe(runway)
    if (stage) {
      observer.observe(stage)
    }

    window.addEventListener('scroll', apply, { passive: true })
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    motion.addEventListener('change', onResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', apply)
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      motion.removeEventListener('change', onResize)
    }
  }, [count])

  return { runwayRef, setCardRef }
}
