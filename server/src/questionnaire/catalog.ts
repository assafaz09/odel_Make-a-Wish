import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEXT_LIMIT = 2000
const MAX_DRAWING_BYTES = 4 * 1024 * 1024

export type DrawingMime = 'image/jpeg' | 'image/png' | 'image/webp'

export type StoredYesNo = {
  choice: 'yes' | 'no' | null
  note: string
}

export type StoredAnswers = {
  'draw-likes': string
  'human-body': StoredYesNo
  'fashion-sketch': StoredYesNo
  proportions: 'yes' | 'no' | 'what' | null
}

export type StoredDrawing = {
  mime: DrawingMime
  data: string
}

export type NormalizedSubmission = {
  answers: StoredAnswers
  drawing: StoredDrawing | null
}

type QuestionKind = 'text' | 'file' | 'yes-no' | 'choice'

type CatalogQuestion = {
  id: string
  kind: QuestionKind
  prompt: string
}

const questionsPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../client/src/content/questions.json',
)

const expectedQuestions: CatalogQuestion[] = [
  { id: 'draw-likes', kind: 'text', prompt: 'אילו ציורים את אוהבת לצייר?' },
  { id: 'drawing-file', kind: 'file', prompt: 'האם את יכולה לצרף קובץ של ציור?' },
  { id: 'human-body', kind: 'yes-no', prompt: 'האם את יודעת לצייר גוף אדם?' },
  { id: 'fashion-sketch', kind: 'yes-no', prompt: 'האם התנסית בעבר בציור סקיצות של אופנה?' },
  { id: 'proportions', kind: 'choice', prompt: 'האם את מכירה את המושג ״פרופורציות״ בעיצוב?' },
]

let catalogReady: boolean | null = null

function catalogMatches(): boolean {
  if (catalogReady !== null) {
    return catalogReady
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(questionsPath, 'utf8'))
    if (!Array.isArray(parsed) || parsed.length !== expectedQuestions.length) {
      throw new Error('Question catalog is invalid')
    }

    const matches = parsed.every((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return false
      }

      const question = item as { id?: unknown; kind?: unknown; prompt?: unknown }
      const expected = expectedQuestions[index]
      return question.id === expected.id && question.kind === expected.kind && question.prompt === expected.prompt
    })

    if (!matches) {
      throw new Error('Question catalog does not match the questionnaire.')
    }

    catalogReady = true
    return true
  } catch (error) {
    catalogReady = false
    console.error('Failed to load the question catalog.')
    console.error(error)
    return false
  }
}

export function normalizeSubmission(value: unknown): NormalizedSubmission | null {
  if (!catalogMatches() || !value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const raw = value as Record<string, unknown>
  const allowed = new Set(['draw-likes', 'drawing-file', 'human-body', 'fashion-sketch', 'proportions'])
  if (Object.keys(raw).some((key) => !allowed.has(key))) {
    return null
  }

  const drawLikes = readText(raw['draw-likes'])
  const humanBody = readYesNo(raw['human-body'])
  const fashionSketch = readYesNo(raw['fashion-sketch'])
  const proportions = readProportion(raw.proportions)
  const drawing = readDrawing(raw['drawing-file'])

  if (drawLikes === undefined || humanBody === undefined || fashionSketch === undefined || proportions === undefined || drawing === undefined) {
    return null
  }

  return {
    answers: {
      'draw-likes': drawLikes,
      'human-body': humanBody,
      'fashion-sketch': fashionSketch,
      proportions,
    },
    drawing,
  }
}

function readText(value: unknown): string | undefined {
  if (value === undefined) {
    return ''
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const text = value.trim()
  if (text.length > TEXT_LIMIT) {
    return undefined
  }

  return text
}

function readYesNo(value: unknown): StoredYesNo | undefined {
  if (value === undefined) {
    return { choice: null, note: '' }
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const raw = value as { choice?: unknown; note?: unknown }
  if (raw.choice !== null && raw.choice !== 'yes' && raw.choice !== 'no' && raw.choice !== undefined) {
    return undefined
  }

  const note = readText(raw.note)
  if (note === undefined) {
    return undefined
  }

  return {
    choice: raw.choice === 'yes' || raw.choice === 'no' ? raw.choice : null,
    note,
  }
}

function readProportion(value: unknown): StoredAnswers['proportions'] | undefined {
  if (value === undefined || value === null) {
    return null
  }

  if (value === 'yes' || value === 'no' || value === 'what') {
    return value
  }

  return undefined
}

function readDrawing(value: unknown): StoredDrawing | null | undefined {
  if (value === undefined || value === null) {
    return null
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const raw = value as { mime?: unknown; data?: unknown }
  if (typeof raw.data !== 'string' || (raw.mime !== 'image/jpeg' && raw.mime !== 'image/png' && raw.mime !== 'image/webp')) {
    return undefined
  }

  const bytes = decodeBase64(raw.data)
  if (!bytes || bytes.length > MAX_DRAWING_BYTES) {
    return undefined
  }

  const mime = sniffMime(bytes)
  if (mime !== raw.mime) {
    return undefined
  }

  return { mime, data: raw.data }
}

function decodeBase64(value: string): Buffer | null {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null
  }

  const bytes = Buffer.from(value, 'base64')
  if (bytes.length === 0) {
    return null
  }

  return bytes
}

function sniffMime(bytes: Buffer): DrawingMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }

  return null
}
