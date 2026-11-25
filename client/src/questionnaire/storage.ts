import { sniffDrawingMime, type DrawingFile, type DrawingMime } from './drawing.ts'

const DRAFT_KEY = 'odel.questionnaire.draft'
const SUBMITTED_KEY = 'odel.questionnaire.submitted'
const FINISHED_KEY = 'odel.questionnaire.finished'

const TEXT_LIMIT = 2000

export type YesNoChoice = 'yes' | 'no'

export type YesNoAnswer = {
  choice: YesNoChoice | null
  note: string
}

export type ProportionChoice = 'yes' | 'no' | 'what'

export type AnswerMap = {
  'draw-likes': string
  'drawing-file': DrawingFile | null
  'human-body': YesNoAnswer
  'fashion-sketch': YesNoAnswer
  proportions: ProportionChoice | null
}

export function emptyAnswers(): AnswerMap {
  return {
    'draw-likes': '',
    'drawing-file': null,
    'human-body': { choice: null, note: '' },
    'fashion-sketch': { choice: null, note: '' },
    proportions: null,
  }
}

export function snapshotAnswers(answers: AnswerMap): string {
  return JSON.stringify(answers)
}

export function readDraft(): AnswerMap {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) {
      return emptyAnswers()
    }

    return parseAnswers(JSON.parse(raw))
  } catch {
    return emptyAnswers()
  }
}

export function writeDraft(answers: AnswerMap): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(answers))
  } catch {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...answers, 'drawing-file': null }))
    } catch {
      // Private mode or a large drawing can block storage. The in-memory answers still work.
    }
  }
}

export function readFinished(): boolean {
  try {
    return localStorage.getItem(FINISHED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeFinished(finished: boolean): void {
  try {
    if (finished) {
      localStorage.setItem(FINISHED_KEY, '1')
      return
    }

    localStorage.removeItem(FINISHED_KEY)
  } catch {
    // Finishing still saves from memory when storage is blocked.
  }
}

export function readSubmittedSnapshot(): string | null {
  try {
    return localStorage.getItem(SUBMITTED_KEY)
  } catch {
    return null
  }
}

export function writeSubmittedSnapshot(snapshot: string): void {
  try {
    localStorage.setItem(SUBMITTED_KEY, snapshot)
  } catch {
    // The server copy still exists. A later edit on this phone may send the same set again.
  }
}

function parseAnswers(value: unknown): AnswerMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return emptyAnswers()
  }

  const raw = value as Record<string, unknown>
  if (typeof raw['draw-subject'] === 'string' || typeof raw['day-rhythm'] === 'string') {
    return emptyAnswers()
  }

  return {
    'draw-likes': readText(raw['draw-likes']),
    'drawing-file': readDrawing(raw['drawing-file']),
    'human-body': readYesNo(raw['human-body']),
    'fashion-sketch': readYesNo(raw['fashion-sketch']),
    proportions: readProportion(raw.proportions),
  }
}

function readText(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, TEXT_LIMIT)
}

function readYesNo(value: unknown): YesNoAnswer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { choice: null, note: '' }
  }

  const raw = value as { choice?: unknown; note?: unknown }
  const choice = raw.choice === 'yes' || raw.choice === 'no' ? raw.choice : null
  return { choice, note: readText(raw.note) }
}

function readProportion(value: unknown): ProportionChoice | null {
  if (value === 'yes' || value === 'no' || value === 'what') {
    return value
  }

  return null
}

function readDrawing(value: unknown): DrawingFile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const raw = value as { name?: unknown; mime?: unknown; data?: unknown }
  if (typeof raw.data !== 'string' || (raw.mime !== 'image/jpeg' && raw.mime !== 'image/png' && raw.mime !== 'image/webp')) {
    return null
  }

  const mime = mimeFromBase64(raw.data)
  if (mime !== raw.mime) {
    return null
  }

  const name = typeof raw.name === 'string' ? raw.name.slice(0, 120) : 'drawing'
  return { name, mime, data: raw.data }
}

function mimeFromBase64(data: string): DrawingMime | null {
  const byteLength = Math.floor((data.length * 3) / 4)
  if (byteLength <= 0 || byteLength > 4 * 1024 * 1024) {
    return null
  }

  try {
    const binary = atob(data.slice(0, 24))
    const header = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return sniffDrawingMime(header)
  } catch {
    return null
  }
}
