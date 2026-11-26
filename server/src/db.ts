import { MongoClient, type Collection, type Db } from 'mongodb'

export const SUBMISSIONS_COLLECTION = 'questionnaireSubmissions'

export type SubmissionDocument = {
  answers: Record<string, unknown>
  drawing?: { mime: string; data: string } | null
  createdAt: Date
}

let client: MongoClient | null = null
let database: Db | null = null
let connecting: Promise<void> | null = null

export async function connectMongo(uri: string, dbName: string): Promise<void> {
  const next = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })

  try {
    await next.connect()
    const nextDatabase = next.db(dbName)
    await nextDatabase.collection(SUBMISSIONS_COLLECTION).createIndex({ createdAt: -1 })
    client = next
    database = nextDatabase
  } catch (error) {
    await next.close()
    throw error
  }
}

export function getSubmissionsCollection(): Collection<SubmissionDocument> | null {
  return database?.collection<SubmissionDocument>(SUBMISSIONS_COLLECTION) ?? null
}

export async function ensureMongo(uri: string | null, dbName: string): Promise<Collection<SubmissionDocument> | null> {
  if (!uri) {
    return null
  }

  if (database) {
    return getSubmissionsCollection()
  }

  if (!connecting) {
    connecting = connectMongo(uri, dbName).finally(() => {
      connecting = null
    })
  }

  try {
    await connecting
  } catch (error) {
    console.error('MongoDB connection failed. Questionnaire submissions will not be saved.')
    console.error(error)
    await closeMongo()
    return null
  }

  return getSubmissionsCollection()
}

export async function closeMongo(): Promise<void> {
  await client?.close()
  client = null
  database = null
}
