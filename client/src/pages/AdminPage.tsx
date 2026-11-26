import { useEffect, useState, type FormEvent } from 'react'
import { questions, choiceLabel } from '../content/questions.ts'

type YesNoValue = {
  choice: 'yes' | 'no' | null
  note: string
}

type CurrentSubmission = {
  id: string
  createdAt: string | null
  format: 'current'
  hasDrawing: boolean
  answers: {
    'draw-likes': string
    'human-body': YesNoValue
    'fashion-sketch': YesNoValue
    proportions: 'yes' | 'no' | 'what' | null
  }
}

type LegacySubmission = {
  id: string
  createdAt: string | null
  format: 'legacy'
  hasDrawing: boolean
  answers: Record<string, string>
}

type Submission = CurrentSubmission | LegacySubmission

const legacyQuestions: { id: string; prompt: string; choices: Record<string, string> }[] = [
  {
    id: 'draw-subject',
    prompt: 'מה הכי כיף לך לצייר?',
    choices: { animals: 'חיות', people: 'אנשים', places: 'מקומות ונופים' },
  },
  {
    id: 'day-rhythm',
    prompt: 'מתי את הכי את?',
    choices: { morning: 'בבוקר', noon: 'בצהריים', night: 'בלילה' },
  },
  {
    id: 'taste',
    prompt: 'מתוק או מלוח?',
    choices: { sweet: 'מתוק', salty: 'מלוח', both: 'גם וגם' },
  },
  {
    id: 'draw-company',
    prompt: 'בזמן ציור את מעדיפה...',
    choices: { quiet: 'שקט', music: 'מוזיקה', company: 'שמישהו יהיה לידך' },
  },
  {
    id: 'calm-color',
    prompt: 'איזה צבע הכי מרגיע אותך?',
    choices: { turquoise: 'תכלת', pink: 'ורוד', green: 'ירוק רך' },
  },
  {
    id: 'weekend',
    prompt: 'סוף שבוע מושלם בשבילך הוא...',
    choices: { outside: 'בחוץ', sketch: 'בבית עם דף ועפרונות', together: 'עם מישהו שאוהבים' },
  },
  {
    id: 'dog-nap',
    prompt: 'איפה כלב שיצו הכי אוהב לנמנם?',
    choices: { pillow: 'על כרית', feet: 'ליד הרגליים', lap: 'על הברכיים' },
  },
  {
    id: 'name-feel',
    prompt: 'איך ירגיש השם של הכלב?',
    choices: { soft: 'רך', playful: 'שובב', royal: 'מלכותי' },
  },
  {
    id: 'small-joy',
    prompt: 'מה שמחה קטנה באמצע היום?',
    choices: { note: 'פתק קטן', treat: 'משהו טעים', walk: 'הליכה קצרה' },
  },
  {
    id: 'after-surprise',
    prompt: 'אחרי הפתעה טובה את...',
    choices: { draw: 'מציירת אותה', hug: 'מחבקת', tell: 'מספרת למישהו' },
  },
]

const dateFormat = new Intl.DateTimeFormat('he-IL', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatWhen(value: string | null): string {
  if (!value) {
    return 'זמן לא ידוע'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'זמן לא ידוע'
  }

  return dateFormat.format(date)
}

function isSubmission(value: unknown): value is Submission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const submission = value as { id?: unknown; format?: unknown; answers?: unknown }
  return typeof submission.id === 'string' && (submission.format === 'current' || submission.format === 'legacy') && Boolean(submission.answers)
}

export function AdminPage() {
  const [password, setPassword] = useState('')
  const [submissions, setSubmissions] = useState<Submission[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function loadSubmissions(): Promise<void> {
    const response = await fetch('/api/admin/submissions')
    if (response.status === 401) {
      setSubmissions(null)
      return
    }

    if (!response.ok) {
      setError('לא הצלחנו לטעון את התשובות.')
      setSubmissions([])
      return
    }

    const body = (await response.json()) as { submissions?: unknown }
    const next = Array.isArray(body.submissions) ? body.submissions.filter(isSubmission) : []
    const visible = new Set(next.map((submission) => submission.id))
    setSubmissions(next)
    setSelected((current) => new Set([...current].filter((id) => visible.has(id))))
    setError(null)
  }

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const response = await fetch('/api/admin/submissions')
        if (cancelled) {
          return
        }

        if (response.status === 401) {
          setSubmissions(null)
          return
        }

        if (!response.ok) {
          setError('לא הצלחנו לטעון את התשובות.')
          setSubmissions([])
          return
        }

        const body = (await response.json()) as { submissions?: unknown }
        if (cancelled) {
          return
        }

        setSubmissions(Array.isArray(body.submissions) ? body.submissions.filter(isSubmission) : [])
        setSelected(new Set())
        setError(null)
      } catch {
        if (!cancelled) {
          setError('לא הצלחנו לטעון את התשובות.')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (response.status === 401) {
        setError('הסיסמה לא נכונה.')
        return
      }

      if (!response.ok) {
        setError('דף הניהול עוד לא הוגדר.')
        return
      }

      setPassword('')
      await loadSubmissions()
    } catch {
      setError('לא הצלחנו להיכנס.')
    } finally {
      setPending(false)
    }
  }

  async function logout(): Promise<void> {
    await fetch('/api/admin/logout', { method: 'POST' })
    setSubmissions(null)
    setSelected(new Set())
  }

  function toggleSelected(id: string): void {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll(): void {
    if (!submissions) {
      return
    }

    const everyVisible = submissions.length > 0 && submissions.every((submission) => selected.has(submission.id))
    setSelected(everyVisible ? new Set() : new Set(submissions.map((submission) => submission.id)))
  }

  async function removeSubmissions(body: { all: true } | { ids: string[] }, confirmed: boolean): Promise<void> {
    if (!confirmed || deleting) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/submissions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.status === 401) {
        setSubmissions(null)
        setSelected(new Set())
        setError('צריך להיכנס שוב.')
        return
      }

      if (!response.ok) {
        setError('לא הצלחנו למחוק את התשובות.')
        return
      }

      const result = (await response.json()) as { deleted?: unknown }
      const noneRemoved = result.deleted === 0 && 'ids' in body
      await loadSubmissions()
      if (noneRemoved) {
        setError('הסבבים שסומנו כבר לא נמצאים.')
      }
    } catch {
      setError('לא הצלחנו למחוק את התשובות.')
    } finally {
      setDeleting(false)
    }
  }

  function deleteSelected(): void {
    if (!submissions || selected.size === 0) {
      return
    }

    const ids = submissions.filter((submission) => selected.has(submission.id)).map((submission) => submission.id)
    if (ids.length === 0) {
      return
    }

    const confirmed = window.confirm(
      ids.length === 1 ? 'למחוק את הסבב שסומן? אי אפשר לשחזר אותו.' : `למחוק ${ids.length} סבבים שסומנו? אי אפשר לשחזר אותם.`,
    )
    void removeSubmissions({ ids }, confirmed)
  }

  function deleteAll(): void {
    if (!submissions || submissions.length === 0) {
      return
    }

    const confirmed = window.confirm('למחוק את כל היסטוריית התשובות? אי אפשר לשחזר אותן.')
    void removeSubmissions({ all: true }, confirmed)
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <p className="admin-kicker">פנימי</p>
        <h1 className="admin-title">תשובות השאלון</h1>

        {submissions === null ? (
          <form className="admin-login" onSubmit={(event) => void onSubmit(event)}>
            <label className="admin-label" htmlFor="admin-password">
              סיסמה
            </label>
            <input
              id="admin-password"
              className="admin-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
              }}
            />
            <button className="admin-button" type="submit" disabled={pending || password.trim() === ''}>
              כניסה
            </button>
            {error ? <p className="admin-error">{error}</p> : null}
          </form>
        ) : (
          <>
            <div className="admin-toolbar">
              <p>{submissions.length === 0 ? 'אין סבבים עדיין.' : `${submissions.length} סבבים, מהחדש לישן.`}</p>
              <div className="admin-toolbar__actions">
                <button className="admin-button admin-button--quiet" type="button" disabled={deleting || submissions.length === 0} onClick={toggleAll}>
                  {submissions.length > 0 && submissions.every((submission) => selected.has(submission.id)) ? 'בטל סימון' : 'סמן הכל'}
                </button>
                <button className="admin-button admin-button--danger" type="button" disabled={deleting || selected.size === 0} onClick={deleteSelected}>
                  מחק מסומנים
                </button>
                <button className="admin-button admin-button--danger" type="button" disabled={deleting || submissions.length === 0} onClick={deleteAll}>
                  מחק הכל
                </button>
                <button className="admin-button admin-button--quiet" type="button" disabled={deleting} onClick={() => void logout()}>
                  יציאה
                </button>
              </div>
            </div>
            {error ? <p className="admin-error">{error}</p> : null}
            <div className="admin-list">
              {submissions.map((submission, index) => (
                <article className="admin-card" key={submission.id}>
                  <header className="admin-card__header">
                    <div className="admin-card__title">
                      <label className="admin-select">
                        <input
                          type="checkbox"
                          checked={selected.has(submission.id)}
                          disabled={deleting}
                          aria-label={`סמן את סבב ${submissions.length - index}`}
                          onChange={() => {
                            toggleSelected(submission.id)
                          }}
                        />
                      </label>
                      <h2>סבב {submissions.length - index}</h2>
                    </div>
                    <time dateTime={submission.createdAt ?? undefined}>{formatWhen(submission.createdAt)}</time>
                  </header>
                  {submission.format === 'legacy' ? (
                    <LegacyAnswers answers={submission.answers} />
                  ) : (
                    <CurrentAnswers submission={submission} />
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function CurrentAnswers({ submission }: { submission: CurrentSubmission }) {
  return (
    <dl className="admin-answers">
      {questions.map((question) => (
        <div key={question.id}>
          <dt>{question.prompt}</dt>
          <dd>{renderCurrentAnswer(question.id, submission)}</dd>
        </div>
      ))}
    </dl>
  )
}

function renderCurrentAnswer(questionId: string, submission: CurrentSubmission) {
  if (questionId === 'draw-likes') {
    return submission.answers['draw-likes'] || 'לא נכתב'
  }

  if (questionId === 'drawing-file') {
    if (!submission.hasDrawing) {
      return 'לא צורף ציור'
    }

    return <img className="admin-drawing" src={`/api/admin/submissions/${submission.id}/drawing`} alt="ציור שהועלה" />
  }

  if (questionId === 'human-body' || questionId === 'fashion-sketch') {
    const answer = submission.answers[questionId]
    return (
      <>
        <span>{answer.choice ? choiceLabel(questionId, answer.choice) : 'לא נבחר'}</span>
        {answer.note ? <span className="admin-note">{answer.note}</span> : null}
      </>
    )
  }

  if (!submission.answers.proportions) {
    return 'לא נבחר'
  }

  return choiceLabel('proportions', submission.answers.proportions)
}

function LegacyAnswers({ answers }: { answers: Record<string, string> }) {
  const known = new Set(legacyQuestions.map((question) => question.id))
  const extras = Object.keys(answers).filter((id) => !known.has(id))

  return (
    <dl className="admin-answers">
      {legacyQuestions.map((question) => (
        <div key={question.id}>
          <dt>{question.prompt}</dt>
          <dd>{question.choices[answers[question.id] ?? ''] ?? (answers[question.id] || 'לא נענתה')}</dd>
        </div>
      ))}
      {extras.map((id) => (
        <div key={id}>
          <dt>{id}</dt>
          <dd>{answers[id]}</dd>
        </div>
      ))}
    </dl>
  )
}
