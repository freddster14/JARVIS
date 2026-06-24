import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { registerServiceWorker } from './lib/push.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker early so push notification actions are handled
// reliably, even before the user enables notifications.
registerServiceWorker().catch((err) => console.warn('[SW] registration failed', err));
