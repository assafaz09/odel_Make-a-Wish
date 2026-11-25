import { storyIntro } from '../content/story.ts'

export function StoryIntro() {
  return (
    <section className="story-intro" id="story-intro" aria-labelledby="story-intro-title">
      <div className="story-intro__rule" aria-hidden="true" />
      <h1 className="story-intro__lead" id="story-intro-title">
        {storyIntro.lead}
      </h1>
    </section>
  )
}
