import { MongoClient, type Collection, type Db } from 'mongodb'

export const SUBMISSIONS_COLLECTION = 'questionnaireSubmissions'

export type SubmissionDocument = {
  answers: Record<string, unknown>
  drawing?: { mime: string; data: string } | null
  createdAt: Date
}

let client: MongoClient | null = null
let database: Db | null = null

export async function connectMongo(uri: string, dbName: string): Promise<void> {
  const next = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  await next.connect()
  client = next
  database = next.db(dbName)
  await database.collection(SUBMISSIONS_COLLECTION).createIndex({ createdAt: -1 })
}

export function getSubmissionsCollection(): Collection<SubmissionDocument> | null {
  return database?.collection<SubmissionDocument>(SUBMISSIONS_COLLECTION) ?? null
}

export async function closeMongo(): Promise<void> {
  await client?.close()
  client = null
  database = null
}
