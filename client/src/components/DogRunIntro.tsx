import { useEffect, type AnimationEvent } from 'react'
import { useNavigate } from 'react-router-dom'

const PAWS = [
  { at: '14%', delay: '1076ms' },
  { at: '30%', delay: '1803ms' },
  { at: '46%', delay: '2530ms' },
  { at: '62%', delay: '3257ms' },
  { at: '76%', delay: '3893ms' },
]

function PawPrint({ at, delay }: { at: string; delay: string }) {
  return (
    <svg className="dog-paw" style={{ left: at, animationDelay: delay }} viewBox="0 0 16 16" aria-hidden="true">
      <ellipse cx="8" cy="11.2" rx="3.1" ry="2.5" />
      <circle cx="4.4" cy="6.2" r="1.45" />
      <circle cx="8" cy="4.6" r="1.55" />
      <circle cx="11.6" cy="6.2" r="1.45" />
    </svg>
  )
}

function ShihTzuRun() {
  return (
    <div className="dog-bob">
      <span className="dog-figure">
        <img className="dog-part" src="/shih-tzu-body.png" alt="" />
        <img className="dog-part dog-head" src="/shih-tzu-head.png" alt="" />
        <img className="dog-part dog-leg dog-leg--left" src="/shih-tzu-leg-left.png" alt="" />
        <img className="dog-part dog-leg dog-leg--right" src="/shih-tzu-leg-right.png" alt="" />
      </span>
      <svg className="dog-kisses" viewBox="0 0 64 64" aria-hidden="true">
        <path className="dog-heart" d="M24 30c0-4 5.2-6.6 8-2.6 2.8-4 8-1.4 8 2.6 0 6.2-8 11.4-8 11.4s-8-5.2-8-11.4z" />
        <path
          className="dog-heart dog-heart--small"
          d="M36 18c0-2.6 3.4-4.4 5.2-1.8 1.8-2.6 5.2-.8 5.2 1.8 0 4-5.2 7.4-5.2 7.4s-5.2-3.4-5.2-7.4z"
        />
      </svg>
    </div>
  )
}

export function DogRunIntro() {
  const navigate = useNavigate()

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  function onAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.animationName !== 'dog-scene') {
      return
    }

    navigate('/questionnaire')
  }

  return (
    <div className="dog-scene" onAnimationEnd={onAnimationEnd}>
      <div className="dog-scene__body" role="status" aria-live="polite">
        <p className="dog-scene__caption">רק רגע</p>
        <div className="dog-stage">
          <div className="dog-runner">
            <div className="dog-pose">
              <ShihTzuRun />
            </div>
          </div>
          <div className="dog-track" aria-hidden="true">
            <div className="dog-track__fill" />
          </div>
          {PAWS.map((paw) => (
            <PawPrint key={paw.at} at={paw.at} delay={paw.delay} />
          ))}
        </div>
      </div>
    </div>
  )
}
