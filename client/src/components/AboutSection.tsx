import { aboutSection } from '../content/story.ts'

const signalPixels = [
  { left: '82%', top: '14%', size: 4, delay: '0.15s' },
  { left: '90%', top: '20%', size: 3, delay: '0.45s' },
  { left: '78%', top: '22%', size: 3, delay: '0.75s' },
  { left: '93%', top: '11%', size: 3, delay: '1.05s' },
  { left: '86%', top: '28%', size: 3, delay: '1.35s' },
] as const

export function AboutSection() {
  return (
    <section className="about" id="about" aria-labelledby="about-title">
      <h2 className="about__title" id="about-title">
        {aboutSection.title}
      </h2>
      <p className="about__lead">{aboutSection.lead}</p>
      <figure className="about__partners">
        <div className="about__logo">
          <span className="about__pixels" aria-hidden="true">
            {signalPixels.map((pixel) => (
              <span
                className="about__pixel"
                key={`${pixel.left}-${pixel.top}`}
                style={{
                  left: pixel.left,
                  top: pixel.top,
                  width: pixel.size,
                  height: pixel.size,
                  animationDelay: pixel.delay,
                }}
              />
            ))}
          </span>
          <img
            src="/gilat-logo.png?v=2"
            alt="גילת טלקום"
            width={720}
            height={542}
          />
        </div>
        <svg className="about__link" viewBox="0 0 36 22" aria-hidden="true">
          <circle cx="12" cy="11" r="6.4" />
          <circle cx="24" cy="11" r="6.4" />
        </svg>
        <img
          className="about__wish"
          src="/LOGO-2.png"
          alt="Make-A-Wish Israel"
          width={306}
          height={108}
        />
      </figure>
      <p className="about__text">{aboutSection.intro}</p>
      <ul className="about__channels">
        {aboutSection.channels.map((channel) => (
          <li className="about__channel" key={channel.id}>
            {channel.text}
          </li>
        ))}
      </ul>
      <p className="about__close">{aboutSection.close}</p>
    </section>
  )
}
