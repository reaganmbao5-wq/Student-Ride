import { Capacitor } from '@capacitor/core';

/**
 * Convert URL-safe base64 VAPID key string to Uint8Array for PushManager.
 */
export const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const arraysEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

/**
 * Fetch the active VAPID public key, ensure the browser PushManager subscription
 * matches it (replacing any stale-key subscription cleanly), and sync to backend.
 */
export const syncWebPushSubscription = async ({ backendUrl, authToken, publicKey: passedKey = null }) => {
  if (Capacitor.isNativePlatform()) return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  let publicKey = passedKey;

  if (!publicKey) {
    const keyRes = await fetch(`${backendUrl}/api/notifications/vapid-public-key`, { headers });
    if (!keyRes.ok) return null;
    const data = await keyRes.json();
    publicKey = data?.public_key || data?.publicKey;
  }

  if (!publicKey) return null;

  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const existingKeyBuffer = subscription.options?.applicationServerKey;
    const existingKeyBytes = existingKeyBuffer ? new Uint8Array(existingKeyBuffer) : null;
    if (!arraysEqual(existingKeyBytes, applicationServerKey)) {
      try {
        await subscription.unsubscribe();
      } catch (unsubErr) {
        console.warn('Could not unsubscribe stale push subscription:', unsubErr);
      }
      subscription = null;
    }
  }

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    } catch (subErr) {
      // Retry once if browser held an unexposed subscription with a different key
      if (subErr?.name === 'InvalidStateError') {
        const current = await registration.pushManager.getSubscription();
        if (current) {
          await current.unsubscribe();
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } else {
        throw subErr;
      }
    }
  }

  await fetch(`${backendUrl}/api/notifications/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(subscription),
  });

  return subscription;
};
