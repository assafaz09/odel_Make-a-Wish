import path from 'node:path'
import cors from 'cors'
import express, { type ErrorRequestHandler, type Express } from 'express'
import type { AppConfig } from './config.ts'
import { registerQuestionnaireRoutes } from './routes/questionnaire.ts'

const JSON_BODY_LIMIT = '8mb'

function isTooLarge(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'type' in error && (error as { type?: unknown }).type === 'entity.too.large'
}

function isInvalidJson(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.parse.failed'
  )
}

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }

  if (isTooLarge(error)) {
    res.status(413).json({ error: 'Drawing is too large' })
    return
  }

  if (isInvalidJson(error)) {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
}

export function createApp(config: AppConfig): Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: JSON_BODY_LIMIT }))
  app.use(
    cors({
      origin: config.clientOrigin,
    }),
  )

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  registerQuestionnaireRoutes(app, config)

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  if (config.nodeEnv === 'production') {
    const indexPath = path.join(config.clientDistPath, 'index.html')

    app.use(express.static(config.clientDistPath))
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.status(404).json({ error: 'Not found' })
        return
      }

      res.sendFile(indexPath, (error) => {
        if (!error) {
          return
        }

        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          res.status(500).json({
            error: 'Client build is missing. Run npm run build from the project root.',
          })
          return
        }

        next(error)
      })
    })
  } else {
    app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' })
    })
  }

  app.use(errorHandler)

  return app
}
