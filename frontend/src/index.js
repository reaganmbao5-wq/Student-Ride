import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./map/styles/map.css";
import App from "./App";
import { GoogleOAuthProvider } from "@react-oauth/google";
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});

// Automated Uncaught System Error Diagnostics Logger
window.addEventListener('error', (event) => {
  try {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    fetch(`${backendUrl}/api/support/auto-log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error_message: event.message || 'Uncaught Exception',
        stack_trace: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        url_route: window.location.pathname,
        device_info: {
          platform: window.Capacitor?.getPlatform() || 'web',
          userAgent: navigator.userAgent
        }
      })
    }).catch(() => {});
  } catch (e) {}
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    fetch(`${backendUrl}/api/support/auto-log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error_message: event.reason?.message || String(event.reason) || 'Unhandled Promise Rejection',
        stack_trace: event.reason?.stack || '',
        url_route: window.location.pathname,
        device_info: {
          platform: window.Capacitor?.getPlatform() || 'web',
          userAgent: navigator.userAgent
        }
      })
    }).catch(() => {});
  } catch (e) {}
});

const root = ReactDOM.createRoot(document.getElementById("root"));
const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "613545438163-5eo9e0tpustjgotq6u7m7elsas8gkjst.apps.googleusercontent.com";

root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// Register Service Worker for PWA (Only in production to avoid local 'Offline' trap)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      console.log('SW registered: ', registration);

      // Phase 5: Update Manager Hook
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: registration }));
            }
          }
        };
      };
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
