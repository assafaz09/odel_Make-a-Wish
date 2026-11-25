import rawQuestions from './questions.json' with { type: 'json' }

export type QuestionKind = 'text' | 'file' | 'yes-no' | 'choice'

export type QuestionChoice = {
  id: string
  label: string
}

export type Question = {
  id: string
  kind: QuestionKind
  prompt: string
  choices?: QuestionChoice[]
}

export const questions = rawQuestions as Question[]

export const yesNoChoices = [
  { id: 'yes', label: 'כן' },
  { id: 'no', label: 'לא' },
] as const

export function choiceLabel(questionId: string, choiceId: string): string {
  if (choiceId === 'yes') {
    return 'כן'
  }

  if (choiceId === 'no') {
    return 'לא'
  }

  const question = questions.find((item) => item.id === questionId)
  return question?.choices?.find((choice) => choice.id === choiceId)?.label ?? choiceId
}
