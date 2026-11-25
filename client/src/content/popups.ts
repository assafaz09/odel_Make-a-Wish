export type Popup = {
  id: string
  text: string
}

export const popups: readonly Popup[] = [
  { id: 'welcome', text: 'היי אודל, ברוכה הבאה' },
  { id: 'excited', text: 'מתרגשת? גם אנחנו!' },
  { id: 'soon', text: 'עוד רגע...' },
]
