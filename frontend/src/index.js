import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "./map/styles/map.css";
import App from "@/App";
import { GoogleOAuthProvider } from "@react-oauth/google";

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

  // Listen for the controlling sw changing to reload the page newly activated Service Worker
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      window.location.reload();
      refreshing = true;
    }
  });
}
