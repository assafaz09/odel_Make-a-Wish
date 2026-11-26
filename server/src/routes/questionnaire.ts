import { ObjectId } from 'mongodb'
import type { Express, Request, Response } from 'express'
import { clearAdminCookie, isAdminRequest, passwordsMatch, setAdminCookie } from '../adminSession.ts'
import type { AppConfig } from '../config.ts'
import { closeMongo, ensureMongo, type SubmissionDocument } from '../db.ts'
import { normalizeSubmission, type StoredAnswers } from '../questionnaire/catalog.ts'

const SAVING_UNAVAILABLE = { error: 'Saving is unavailable' }
const ADMIN_UNAVAILABLE = { error: 'Admin login is not configured' }
const INVALID_DELETE = { error: 'Invalid delete request' }
const MAX_DELETE_IDS = 200
const LIST_LIMIT = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function createSubmission(req: Request, res: Response, config: AppConfig): Promise<void> {
  if (!isRecord(req.body)) {
    res.status(400).json({ error: 'Invalid answers' })
    return
  }

  const submission = normalizeSubmission(req.body.answers)
  if (!submission) {
    res.status(400).json({ error: 'Invalid answers' })
    return
  }

  const collection = await ensureMongo(config.mongodbUri, config.mongodbDbName)
  if (!collection) {
    res.status(503).json(SAVING_UNAVAILABLE)
    return
  }

  try {
    await collection.insertOne({
      answers: submission.answers,
      drawing: submission.drawing,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error(error)
    await closeMongo()
    res.status(503).json(SAVING_UNAVAILABLE)
    return
  }

  res.status(201).json({ ok: true })
}

function login(req: Request, res: Response, config: AppConfig): void {
  if (!config.adminPassword) {
    res.status(503).json(ADMIN_UNAVAILABLE)
    return
  }

  const password = isRecord(req.body) && typeof req.body.password === 'string' ? req.body.password : ''
  if (!passwordsMatch(password, config.adminPassword)) {
    res.status(401).json({ error: 'Wrong password' })
    return
  }

  setAdminCookie(res, config.adminPassword, config.nodeEnv === 'production')
  res.status(204).end()
}

function logout(res: Response, config: AppConfig): void {
  clearAdminCookie(res, config.nodeEnv === 'production')
  res.status(204).end()
}

async function listSubmissions(req: Request, res: Response, config: AppConfig): Promise<void> {
  if (!config.adminPassword || !isAdminRequest(req, config.adminPassword)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const collection = await ensureMongo(config.mongodbUri, config.mongodbDbName)
  if (!collection) {
    res.status(503).json(SAVING_UNAVAILABLE)
    return
  }

  try {
    const documents = await collection.find({}).sort({ createdAt: -1 }).limit(LIST_LIMIT).toArray()
    res.setHeader('Cache-Control', 'no-store')
    res.json({
      submissions: documents.map(toPublicSubmission),
    })
  } catch (error) {
    console.error(error)
    await closeMongo()
    res.status(503).json(SAVING_UNAVAILABLE)
  }
}

function toPublicSubmission(document: SubmissionDocument & { _id: ObjectId }) {
  const createdAt = document.createdAt instanceof Date ? document.createdAt.toISOString() : null
  const id = String(document._id)
  const answers = isRecord(document.answers) ? document.answers : {}

  if (typeof answers['draw-subject'] === 'string' || typeof answers['day-rhythm'] === 'string') {
    const legacy: Record<string, string> = {}
    for (const [key, value] of Object.entries(answers)) {
      if (typeof value === 'string') {
        legacy[key] = value
      }
    }

    return { id, createdAt, format: 'legacy' as const, hasDrawing: false, answers: legacy }
  }

  const current = answers as Partial<StoredAnswers>
  return {
    id,
    createdAt,
    format: 'current' as const,
    hasDrawing: typeof document.drawing?.data === 'string' && document.drawing.data.length > 0,
    answers: {
      'draw-likes': typeof current['draw-likes'] === 'string' ? current['draw-likes'] : '',
      'human-body': publicYesNo(current['human-body']),
      'fashion-sketch': publicYesNo(current['fashion-sketch']),
      proportions:
        current.proportions === 'yes' || current.proportions === 'no' || current.proportions === 'what'
          ? current.proportions
          : null,
    },
  }
}

function publicYesNo(value: unknown): StoredAnswers['human-body'] {
  if (!isRecord(value)) {
    return { choice: null, note: '' }
  }

  const choice = value.choice === 'yes' || value.choice === 'no' ? value.choice : null
  const note = typeof value.note === 'string' ? value.note : ''
  return { choice, note }
}

async function readDrawing(req: Request, res: Response, config: AppConfig): Promise<void> {
  if (!config.adminPassword || !isAdminRequest(req, config.adminPassword)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  if (!rawId || !ObjectId.isValid(rawId)) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  const collection = await ensureMongo(config.mongodbUri, config.mongodbDbName)
  if (!collection) {
    res.status(503).json(SAVING_UNAVAILABLE)
    return
  }

  const document = await collection.findOne({ _id: new ObjectId(rawId) })
  const drawing = document?.drawing
  if (!drawing || (drawing.mime !== 'image/jpeg' && drawing.mime !== 'image/png' && drawing.mime !== 'image/webp')) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  const bytes = Buffer.from(drawing.data, 'base64')
  if (bytes.length === 0) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  res.setHeader('Content-Type', drawing.mime)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.send(bytes)
}

async function deleteSubmissions(req: Request, res: Response, config: AppConfig): Promise<void> {
  if (!config.adminPassword || !isAdminRequest(req, config.adminPassword)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!isRecord(req.body)) {
    res.status(400).json(INVALID_DELETE)
    return
  }

  const deleteAll = req.body.all === true
  const hasIds = Object.prototype.hasOwnProperty.call(req.body, 'ids')
  if (deleteAll === hasIds) {
    res.status(400).json(INVALID_DELETE)
    return
  }

  let filter: { _id?: { $in: ObjectId[] } } = {}
  if (!deleteAll) {
    const ids = req.body.ids
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_DELETE_IDS) {
      res.status(400).json(INVALID_DELETE)
      return
    }

    const objectIds: ObjectId[] = []
    for (const id of ids) {
      if (typeof id !== 'string' || !ObjectId.isValid(id)) {
        res.status(400).json(INVALID_DELETE)
        return
      }

      objectIds.push(new ObjectId(id))
    }

    filter = { _id: { $in: objectIds } }
  }

  const collection = await ensureMongo(config.mongodbUri, config.mongodbDbName)
  if (!collection) {
    res.status(503).json(SAVING_UNAVAILABLE)
    return
  }

  try {
    const result = await collection.deleteMany(filter)
    res.json({ deleted: result.deletedCount })
  } catch (error) {
    console.error(error)
    await closeMongo()
    res.status(503).json(SAVING_UNAVAILABLE)
  }
}

export function registerQuestionnaireRoutes(app: Express, config: AppConfig): void {
  app.post('/api/questionnaire/submissions', (req, res, next) => {
    createSubmission(req, res, config).catch(next)
  })

  app.post('/api/admin/login', (req, res) => {
    login(req, res, config)
  })

  app.post('/api/admin/logout', (_req, res) => {
    logout(res, config)
  })

  app.post('/api/admin/submissions/delete', (req, res, next) => {
    deleteSubmissions(req, res, config).catch(next)
  })

  app.get('/api/admin/submissions/:id/drawing', (req, res, next) => {
    readDrawing(req, res, config).catch(next)
  })

  app.get('/api/admin/submissions', (req, res, next) => {
    listSubmissions(req, res, config).catch(next)
  })
}
