import type { AnswerMap } from './storage.ts'

export class SubmitAnswersError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SubmitAnswersError'
  }
}

export async function submitAnswers(answers: AnswerMap): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/questionnaire/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
  } catch {
    throw new SubmitAnswersError('לא הצלחנו לשמור עכשיו. התשובות נשארו בטלפון, אפשר לנסות שוב.')
  }

  if (response.status === 413) {
    throw new SubmitAnswersError('התמונה גדולה מדי. אפשר לצרף JPG, PNG או WebP עד 4MB.')
  }

  if (response.ok) {
    return
  }

  throw new SubmitAnswersError('לא הצלחנו לשמור עכשיו. התשובות נשארו בטלפון, אפשר לנסות שוב.')
}
