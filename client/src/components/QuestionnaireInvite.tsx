import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DogRunIntro } from './DogRunIntro.tsx'

export function QuestionnaireInvite() {
  const [playing, setPlaying] = useState(false)

  return (
    <section className="questionnaire-invite" aria-labelledby="questionnaire-invite-title">
      <p className="questionnaire-invite__kicker">עוד רגע קטן</p>
      <p className="questionnaire-invite__note">שמענו שאת אוהבת כלבים, ציור ואופנה</p>
      <h2 className="questionnaire-invite__title" id="questionnaire-invite-title">
        אנחנו רוצים להכיר אותך קצת יותר טוב, מוכנה?
      </h2>
      <button
        className="questionnaire-invite__button"
        type="button"
        onClick={() => {
          setPlaying(true)
        }}
        disabled={playing}
        aria-busy={playing}
      >
        תלחצי למעבר לשאלון ההיכרות
      </button>
      {playing ? createPortal(<DogRunIntro />, document.body) : null}
    </section>
  )
}
