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
    let settled: 'before' | 'inside' | 'after' | null = null
    let lastWidth = window.visualViewport?.width ?? window.innerWidth

    const measure = (force: boolean) => {
      const stageHeight = stage?.offsetHeight ?? 0
      const travel = Math.max(runway.offsetHeight - stageHeight, 0)
      const start = runway.getBoundingClientRect().top + window.scrollY
      const heightChanged = stageHeight !== metrics.stageHeight || Math.abs(travel - metrics.travel) > 0.5
      metrics.stageHeight = stageHeight
      metrics.travel = travel
      metrics.start = start
      if (stageHeight > 0) {
        runway.style.setProperty('--stage', `${stageHeight}px`)
      }
      if (force || heightChanged) {
        settled = null
        lastScrollY = Number.NaN
      }
    }

    const apply = () => {
      const scrollY = window.scrollY
      if (scrollY === lastScrollY && settled !== null) {
        return
      }
      lastScrollY = scrollY

      const reduced = motion.matches
      const cards = cardRefs.current

      if (reduced || count < 2 || metrics.stageHeight <= 0) {
        runway.classList.remove('popup-runway--settled')
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
        settled = 'inside'
        return
      }

      const raw = scrollY - metrics.start
      const nextSettled = raw <= 0 ? 'before' : raw >= metrics.travel ? 'after' : 'inside'
      if (nextSettled !== 'inside' && nextSettled === settled) {
        return
      }
      settled = nextSettled
      runway.classList.toggle('popup-runway--settled', nextSettled === 'after')

      const segment = metrics.travel / (count - 1)
      const traveled = clamp(raw, 0, metrics.travel)
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

    const remeasure = (force: boolean) => {
      measure(force)
      apply()
    }

    const onWidthChange = () => {
      const width = window.visualViewport?.width ?? window.innerWidth
      if (Math.abs(width - lastWidth) < 1) {
        return
      }
      lastWidth = width
      remeasure(true)
    }

    remeasure(true)

    const observer = new ResizeObserver(() => {
      remeasure(false)
    })
    observer.observe(runway)
    if (stage) {
      observer.observe(stage)
    }

    const onMotionChange = () => {
      remeasure(true)
    }

    window.addEventListener('scroll', apply, { passive: true })
    window.addEventListener('resize', onWidthChange)
    window.visualViewport?.addEventListener('resize', onWidthChange)
    motion.addEventListener('change', onMotionChange)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', apply)
      window.removeEventListener('resize', onWidthChange)
      window.visualViewport?.removeEventListener('resize', onWidthChange)
      motion.removeEventListener('change', onMotionChange)
    }
  }, [count])

  return { runwayRef, setCardRef }
}
