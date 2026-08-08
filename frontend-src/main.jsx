import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// StrictMode is DEVELOPMENT-ONLY: React double-invokes effects and renders in
// dev so that impure, non-idempotent code shows itself immediately. It is
// stripped from production builds and changes nothing for users.
//
// Deliberately re-enabled: a non-idempotent effect is exactly what caused the
// runaway-company incident (a repeated call created a row every time), and
// double-invocation is the cheapest way to make that class of bug visible while
// developing instead of in production.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



