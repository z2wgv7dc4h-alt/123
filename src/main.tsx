import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

/** Pointer shine for .btn — sets --mx/--my for CSS highlight */
function bindButtonShine() {
  const onMove = (e: PointerEvent) => {
    const t = (e.target as HTMLElement | null)?.closest?.('.btn') as HTMLElement | null;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const x = ((e.clientX - r.left) / Math.max(r.width, 1)) * 100;
    const y = ((e.clientY - r.top) / Math.max(r.height, 1)) * 100;
    t.style.setProperty('--mx', `${x}%`);
    t.style.setProperty('--my', `${y}%`);
  };
  document.addEventListener('pointermove', onMove, { passive: true });
}

bindButtonShine();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
