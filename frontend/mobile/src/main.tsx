import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { ErrorBoundary } from './components/ErrorBoundary.tsx'

if (!(window as any).__IS_OAUTH_POPUP_CALLBACK__) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary sectionName="Aplikasi Catavor Mobile">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
