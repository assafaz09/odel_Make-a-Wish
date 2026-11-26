import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { loadConfig, type AppConfig } from './config.ts'
import { closeMongo } from './db.ts'

function readConfig(): AppConfig {
  try {
    return loadConfig()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load configuration'
    console.error(message)
    process.exit(1)
  }
}

const config = readConfig()

if (!config.mongodbUri) {
  console.log('MongoDB is not configured. Questionnaire submissions will not be saved.')
}

const app = createApp(config)
const server = createServer(app)

export default app

const runningOnVercel = process.env.VERCEL === '1'

function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}, shutting down`)
  const done = () => {
    void closeMongo().finally(() => {
      process.exit(0)
    })
  }

  if (server.listening) {
    server.close(done)
    return
  }

  done()
}

if (!runningOnVercel) {
  process.on('SIGINT', () => {
    shutdown('SIGINT')
  })

  process.on('SIGTERM', () => {
    shutdown('SIGTERM')
  })

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use.`)
    } else {
      console.error(error)
    }
    process.exit(1)
  })

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`API listening on http://localhost:${config.port}`)
  })
}
