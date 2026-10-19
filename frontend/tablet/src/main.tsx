import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

if (!(window as any).__IS_OAUTH_POPUP_CALLBACK__) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary sectionName="Aplikasi Catavor Tablet">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
