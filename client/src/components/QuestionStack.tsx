import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { questions, yesNoChoices, type Question } from '../content/questions.ts'
import { DRAWING_REJECTED, drawingSrc, readDrawingFile, type DrawingFile } from '../questionnaire/drawing.ts'
import {
  readDraft,
  readFinished,
  readSubmittedSnapshot,
  snapshotAnswers,
  writeDraft,
  writeFinished,
  writeSubmittedSnapshot,
  type AnswerMap,
  type ProportionChoice,
  type YesNoChoice,
} from '../questionnaire/storage.ts'
import { submitAnswers } from '../questionnaire/submitAnswers.ts'

const SWIPE_THRESHOLD = 48
const ADVANCE_MS = 280

type TouchPoint = {
  x: number
  y: number
}

type CardPlace = 'front' | 'behind' | 'waiting'

function placeFor(cardIndex: number, activeIndex: number): CardPlace {
  if (cardIndex === activeIndex) {
    return 'front'
  }

  if (cardIndex < activeIndex) {
    return 'behind'
  }

  return 'waiting'
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function QuestionStack() {
  const [answers, setAnswers] = useState<AnswerMap>(readDraft)
  const [activeIndex, setActiveIndex] = useState(() => (readFinished() ? questions.length : 0))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const submittedRef = useRef(readSubmittedSnapshot())
  const pendingRef = useRef<AnswerMap | null>(null)
  const runningRef = useRef(false)
  const advanceTimerRef = useRef<number | null>(null)
  const touchRef = useRef<TouchPoint | null>(null)
  const suppressClickRef = useRef(false)
  const wheelLockRef = useRef(0)
  const stageRef = useRef<HTMLElement | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(readSubmittedSnapshot)

  useEffect(() => {
    if (readFinished()) {
      queueSave(readDraft())
    }

    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current)
      }
    }
  }, [])

  async function flushSaves(): Promise<void> {
    if (runningRef.current) {
      return
    }

    runningRef.current = true
    setSaving(true)

    try {
      while (pendingRef.current) {
        const next = pendingRef.current
        pendingRef.current = null
        const snapshot = snapshotAnswers(next)
        if (snapshot === submittedRef.current) {
          continue
        }

        await submitAnswers(next)
        submittedRef.current = snapshot
        writeSubmittedSnapshot(snapshot)
        setSavedSnapshot(snapshot)
        setSaveError(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'לא הצלחנו לשמור עכשיו. התשובות נשארו בטלפון, אפשר לנסות שוב.'
      setSaveError(message)
    } finally {
      runningRef.current = false
      setSaving(false)
      if (pendingRef.current) {
        void flushSaves()
      }
    }
  }

  function queueSave(next: AnswerMap): void {
    pendingRef.current = next
    void flushSaves()
  }

  function remember(next: AnswerMap): void {
    setAnswers(next)
    writeDraft(next)
  }

  function continueFrom(cardIndex: number): void {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
    }

    const isLast = cardIndex >= questions.length - 1
    if (isLast) {
      writeFinished(true)
      queueSave(answers)
    }

    const delay = prefersReducedMotion() ? 0 : ADVANCE_MS
    advanceTimerRef.current = window.setTimeout(() => {
      setActiveIndex((current) => Math.min(current + 1, questions.length))
      advanceTimerRef.current = null
    }, delay)
  }

  function goBack(): void {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }

    writeFinished(false)
    setActiveIndex((current) => Math.max(0, current - 1))
  }

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) {
      return
    }

    function peel(now: number): void {
      if (now < wheelLockRef.current) {
        return
      }

      wheelLockRef.current = now + 360
      goBack()
    }

    function onWheel(event: globalThis.WheelEvent): void {
      if (event.target instanceof Element && event.target.closest('textarea, input')) {
        return
      }

      if (event.deltaY >= -28) {
        return
      }

      event.preventDefault()
      peel(Date.now())
    }

    function onTouchStart(event: globalThis.TouchEvent): void {
      const target = event.target
      if (target instanceof Element && target.closest('textarea, input, button, a, label')) {
        touchRef.current = null
        return
      }

      const touch = event.touches[0]
      if (!touch) {
        return
      }

      touchRef.current = { x: touch.clientX, y: touch.clientY }
    }

    function onTouchEnd(event: globalThis.TouchEvent): void {
      const start = touchRef.current
      touchRef.current = null
      const touch = event.changedTouches[0]
      if (!start || !touch) {
        return
      }

      const deltaX = touch.clientX - start.x
      const deltaY = touch.clientY - start.y
      if (deltaY < SWIPE_THRESHOLD || Math.abs(deltaX) > deltaY) {
        return
      }

      suppressClickRef.current = true
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 700)
      peel(Date.now())
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('touchstart', onTouchStart, { passive: true })
    stage.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      stage.removeEventListener('wheel', onWheel)
      stage.removeEventListener('touchstart', onTouchStart)
      stage.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  async function onDrawingChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setReadingFile(true)
    try {
      const drawing = await readDrawingFile(file)
      if (!drawing) {
        setFileError(DRAWING_REJECTED)
        return
      }

      setFileError(null)
      setAnswers((current) => {
        const next = { ...current, 'drawing-file': drawing }
        writeDraft(next)
        return next
      })
    } finally {
      setReadingFile(false)
    }
  }

  function setYesNo(questionId: 'human-body' | 'fashion-sketch', choice: YesNoChoice): void {
    remember({
      ...answers,
      [questionId]: { ...answers[questionId], choice },
    })
  }

  function setNote(questionId: 'human-body' | 'fashion-sketch', note: string): void {
    remember({
      ...answers,
      [questionId]: { ...answers[questionId], note },
    })
  }

  const progress = Math.min(activeIndex, questions.length) / questions.length
  const progressLabel = activeIndex >= questions.length ? 'סיימנו' : `שאלה ${activeIndex + 1} מתוך ${questions.length}`

  return (
    <section ref={stageRef} className="question-stage">
      <div className="question-shell">
        <header className="question-header">
          <Link className="question-home" to="/">
            לדף הבית
          </Link>
          <p className="question-progress-label">{progressLabel}</p>
          <div className="question-progress" style={{ '--progress': `${progress * 100}%` } as CSSProperties} />
          {activeIndex > 0 ? (
            <button className="question-back" type="button" onClick={goBack}>
              לשאלה הקודמת
            </button>
          ) : null}
        </header>

        <div className="question-stack">
          {questions.map((question, cardIndex) => {
            const place = placeFor(cardIndex, activeIndex)

            return (
              <article
                key={question.id}
                className="question-card"
                data-place={place}
                aria-hidden={place !== 'front'}
                inert={place === 'front' ? undefined : true}
                style={
                  {
                    zIndex: cardIndex + 1,
                    '--depth': place === 'behind' ? Math.min(activeIndex - cardIndex, 2) : 0,
                  } as CSSProperties
                }
              >
                <h1 className="question-card__prompt">{question.prompt}</h1>
                <QuestionFields
                  question={question}
                  answers={answers}
                  fileError={fileError}
                  onTextChange={(text) => {
                    remember({ ...answers, 'draw-likes': text })
                  }}
                  onDrawingChange={(event) => {
                    void onDrawingChange(event)
                  }}
                  onDrawingClear={() => {
                    setFileError(null)
                    remember({ ...answers, 'drawing-file': null })
                  }}
                  onYesNo={setYesNo}
                  onNote={setNote}
                  onProportion={(choice) => {
                    remember({ ...answers, proportions: choice })
                  }}
                />
                <button
                  className="question-next"
                  type="button"
                  disabled={question.kind === 'file' && readingFile}
                  onClick={() => {
                    continueFrom(cardIndex)
                  }}
                >
                  {cardIndex === questions.length - 1 ? 'סיימתי' : 'המשך'}
                </button>
              </article>
            )
          })}

          <article
            className="question-card question-card--thanks"
            data-place={placeFor(questions.length, activeIndex)}
            aria-hidden={activeIndex !== questions.length}
            inert={activeIndex === questions.length ? undefined : true}
            style={{ zIndex: questions.length + 1, '--depth': 0 } as CSSProperties}
          >
            <p className="question-card__kicker">תודה</p>
            <h1 className="question-card__prompt">
              {saveError
                ? 'התשובות נשארו בטלפון.'
                : saving
                  ? 'שמרנו את מה שסיפרת.'
                  : savedSnapshot === snapshotAnswers(answers)
                    ? 'שמרנו את מה שסיפרת.'
                    : 'תודה שסיפרת.'}
            </h1>
            <p className="question-card__note">אפשר לחזור אחורה ולשנות תשובה מתי שתרצי.</p>
          </article>
        </div>

        {saveError ? (
          <div className="question-error" role="alert">
            <p>{saveError}</p>
            <button
              type="button"
              onClick={() => {
                queueSave(answers)
              }}
              disabled={saving}
            >
              נסי שוב
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

type QuestionFieldsProps = {
  question: Question
  answers: AnswerMap
  fileError: string | null
  onTextChange: (text: string) => void
  onDrawingChange: (event: ChangeEvent<HTMLInputElement>) => void
  onDrawingClear: () => void
  onYesNo: (questionId: 'human-body' | 'fashion-sketch', choice: YesNoChoice) => void
  onNote: (questionId: 'human-body' | 'fashion-sketch', note: string) => void
  onProportion: (choice: ProportionChoice) => void
}

function QuestionFields({
  question,
  answers,
  fileError,
  onTextChange,
  onDrawingChange,
  onDrawingClear,
  onYesNo,
  onNote,
  onProportion,
}: QuestionFieldsProps) {
  if (question.kind === 'text') {
    return (
      <textarea
        className="question-field"
        value={answers['draw-likes']}
        maxLength={2000}
        rows={4}
        onChange={(event) => {
          onTextChange(event.target.value)
        }}
      />
    )
  }

  if (question.kind === 'file') {
    return <DrawingField file={answers['drawing-file']} error={fileError} onChange={onDrawingChange} onClear={onDrawingClear} />
  }

  if (question.kind === 'yes-no' && (question.id === 'human-body' || question.id === 'fashion-sketch')) {
    const answer = answers[question.id]
    return (
      <div className="question-card__choices">
        {yesNoChoices.map((choice) => (
          <button
            key={choice.id}
            className="question-choice"
            type="button"
            aria-pressed={answer.choice === choice.id}
            onClick={() => {
              onYesNo(question.id as 'human-body' | 'fashion-sketch', choice.id)
            }}
          >
            {choice.label}
          </button>
        ))}
        <label className="question-note-label" htmlFor={`${question.id}-note`}>
          אם בא לך לפרט
        </label>
        <textarea
          id={`${question.id}-note`}
          className="question-field"
          value={answer.note}
          maxLength={2000}
          rows={3}
          onChange={(event) => {
            onNote(question.id as 'human-body' | 'fashion-sketch', event.target.value)
          }}
        />
      </div>
    )
  }

  return (
    <div className="question-card__choices">
      {(question.choices ?? []).map((choice) => (
        <button
          key={choice.id}
          className="question-choice"
          type="button"
          aria-pressed={answers.proportions === choice.id}
          onClick={() => {
            if (choice.id === 'yes' || choice.id === 'no' || choice.id === 'what') {
              onProportion(choice.id)
            }
          }}
        >
          {choice.label}
        </button>
      ))}
    </div>
  )
}

function DrawingField({
  file,
  error,
  onChange,
  onClear,
}: {
  file: DrawingFile | null
  error: string | null
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <div className="question-file">
      {file ? (
        <img className="question-file__preview" src={drawingSrc(file)} alt="הציור שנבחר" />
      ) : (
        <p className="question-card__note">אפשר לדלג, או לצרף ציור מהטלפון.</p>
      )}
      <label className="question-file__pick">
        {file ? 'לבחור ציור אחר' : 'בחירת ציור'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={onChange}
        />
      </label>
      {file ? (
        <button className="question-file__remove" type="button" onClick={onClear}>
          להסיר את הציור
        </button>
      ) : null}
      {error ? (
        <p className="question-file__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
