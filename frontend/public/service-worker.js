// Mulu Rides Service Worker
const CACHE_NAME = 'mulu-rides-cache-v3';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Activate immediately on install
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Delete ALL old caches
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

// Push Notification Listener (Phase 10)
self.addEventListener('push', function (event) {
    if (event.data) {
        let data;
        try {
            data = event.data.json();
        } catch (e) {
            data = { type: 'unknown', payload: { body: event.data.text() } };
        }

        const payload = data.payload || {};
        let title = payload.title || 'Mulu Rides';
        let eventType = data.type || payload.eventType || 'default';

        // Custom Vibration Signatures for Maximum User Awareness
        let vibePattern = [0, 200, 100, 200];
        if (eventType === 'driver_arrived') {
            vibePattern = [0, 600, 150, 600, 150, 900]; // Most intense triple-buzz pocket alert!
        } else if (eventType === 'driver_accepted') {
            vibePattern = [0, 300, 150, 300];
        } else if (eventType === 'new_ride_request') {
            vibePattern = [0, 500, 150, 500, 150, 800];
        } else if (eventType === 'ride_completed') {
            vibePattern = [0, 150, 100, 150, 100, 400];
        } else if (eventType === 'ride_cancelled') {
            vibePattern = [0, 400, 100, 400];
        }

        const options = {
            body: payload.body || payload.message || 'New notification',
            icon: payload.icon || '/logo192.png',
            badge: payload.badge || '/favicon-32x32.png',
            data: payload,
            vibrate: vibePattern,
            tag: payload.tag || 'mulu_push_event',
            renotify: true,
            actions: payload.actions || []
        };

        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const payload = event.notification.data || {};
    const urlToOpen = payload.url ? new URL(payload.url, self.location.origin).href : self.location.origin + '/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (windowClients) {
            // Check if there is already a window/tab open with the target URL
            let matchingClient = null;
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    matchingClient = client;
                    break;
                }
            }
            if (matchingClient) {
                return matchingClient.focus();
            } else {
                // If not, open a new window
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Phase 6 Offline Fallback
self.addEventListener('fetch', (event) => {
    // Only handle navigation (HTML) requests
    if (event.request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                // Always try to fetch from network first
                const networkResponse = await fetch(event.request);
                return networkResponse;
            } catch (error) {
                // If network fails (offline), return cached offline page
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(OFFLINE_URL);
                return cachedResponse;
            }
        })());
    }
});
