import { LanguageProvider } from './contexts/LanguageContext'
import FinderModule from './modules/finder/FinderModule'

export default function DemoApp() {
  return (
    <LanguageProvider>
      <FinderModule />
    </LanguageProvider>
  )
}
