import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Remove the initial loader once React is ready
const removeLoader = () => {
  const loader = document.getElementById('app-loader');
  if (loader) loader.remove();
};

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  removeLoader();
  const root = document.getElementById('root');
  if (root && !root.querySelector('.app-error')) {
    root.innerHTML = `
      <div class="app-error" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0B0B0B;color:#fff;font-family:system-ui,sans-serif;padding:20px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <div style="font-size:18px;font-weight:600;margin-bottom:8px">Something went wrong</div>
        <div style="font-size:14px;color:#888;margin-bottom:24px">Please try refreshing the page</div>
        <button onclick="location.reload()" style="padding:12px 24px;border:none;border-radius:10px;background:#40E0D0;color:#000;font-weight:600;cursor:pointer">Refresh</button>
      </div>
    `;
  }
});

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // Remove loader after a short delay to ensure styles are loaded
  setTimeout(removeLoader, 100);
} catch (error) {
  console.error('React initialization error:', error);
  removeLoader();
}

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register at root to ensure proper scope for all routes
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Check for updates periodically
        setInterval(() => registration.update(), 60 * 60 * 1000); // Every hour
      })
      .catch((err) => console.warn('SW registration failed:', err));
  });
}

reportWebVitals();
