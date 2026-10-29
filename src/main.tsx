import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackTitle="Erro inesperado na aplicação ONNIX PLAY">
    <App />
  </ErrorBoundary>
);

