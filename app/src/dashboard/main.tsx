import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { App } from './App';
import './dashboard.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<ErrorBoundary><App /></ErrorBoundary>);
}
