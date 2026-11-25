import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type NodeEnv = 'development' | 'production' | 'test'

export type AppConfig = {
  port: number
  clientOrigin: string
  nodeEnv: NodeEnv
  clientDistPath: string
  mongodbUri: string | null
  mongodbDbName: string
  adminPassword: string | null
}

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return 3001
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${value}". Expected an integer between 1 and 65535.`)
  }

  return port
}

function readClientOrigin(value: string | undefined): string {
  const raw = value === undefined || value.trim() === '' ? 'http://localhost:5173' : value.trim()

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid CLIENT_ORIGIN "${raw}". Expected an absolute http(s) URL.`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid CLIENT_ORIGIN "${raw}". Expected an absolute http(s) URL.`)
  }

  return url.origin
}

function readOptional(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') {
    return null
  }

  return value.trim()
}

function readNodeEnv(value: string | undefined): NodeEnv {
  if (value === undefined || value.trim() === '' || value === 'development') {
    return 'development'
  }

  if (value === 'production' || value === 'test') {
    return value
  }

  throw new Error(`Invalid NODE_ENV "${value}". Expected development, production, or test.`)
}

export function loadConfig(): AppConfig {
  return {
    port: readPort(process.env.PORT),
    clientOrigin: readClientOrigin(process.env.CLIENT_ORIGIN),
    nodeEnv: readNodeEnv(process.env.NODE_ENV),
    clientDistPath: path.resolve(serverRoot, '../client/dist'),
    mongodbUri: readOptional(process.env.MONGODB_URI),
    mongodbDbName: readOptional(process.env.MONGODB_DB) ?? 'odel',
    adminPassword: readOptional(process.env.ADMIN_PASSWORD),
  }
}
