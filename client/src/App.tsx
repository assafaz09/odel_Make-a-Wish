import { AboutSection } from './components/AboutSection.tsx'
import { QuestionnaireInvite } from './components/QuestionnaireInvite.tsx'
import { PopupStack } from './components/PopupStack.tsx'
import { StoryIntro } from './components/StoryIntro.tsx'

function App() {
  return (
    <main className="page">
      <PopupStack />
      <StoryIntro />
      <AboutSection />
      <QuestionnaireInvite />
    </main>
  )
}

export default App
