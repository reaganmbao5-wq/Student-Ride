// J Ride Service Worker & Push Notification Handler
const CACHE_NAME = 'j-ride-cache-v4';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
    self.skipWaiting();
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
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

// Push Notification Listener (Data-Only Payloads per Spec Section 3 & 4)
self.addEventListener('push', function (event) {
    if (!event.data) return;

    let data = {};
    try {
        data = event.data.json();
    } catch (e) {
        data = { type: 'admin_broadcast', payload: { body: event.data.text() } };
    }

    const payload = data.payload || data;
    const eventType = data.type || payload.type || payload.eventType || 'default';
    const channelId = payload.channelId || payload.channel_id || 'ride_updates';

    // Specification-Compliant Titles & Copies (Section 5A)
    let title = payload.title;
    let body = payload.body || payload.message || 'New update';

    if (!title) {
        switch (eventType) {
            case 'driver_accepted':
                title = 'Driver on the way';
                body = body || 'Your driver accepted your ride and is heading your way.';
                break;
            case 'driver_arrived':
                title = 'Driver has arrived';
                body = body || 'Your driver is waiting at your pickup location.';
                break;
            case 'new_ride_request':
                title = 'New ride request';
                body = body || 'Pickup near your location. Tap to view.';
                break;
            case 'ride_started':
                title = 'Ride started';
                body = body || 'You are on your way to the destination.';
                break;
            case 'ride_completed':
                title = 'Ride complete';
                body = body || "You've arrived at your destination.";
                break;
            case 'ride_cancelled':
                title = 'Ride cancelled';
                body = body || 'The ride was cancelled.';
                break;
            case 'emergency_sos':
                title = 'Emergency alert';
                body = body || 'An emergency alert was triggered.';
                break;
            case 'chat_message':
                title = payload.sender_name || 'New message';
                body = body || 'You received a new message.';
                break;
            default:
                title = 'J Ride';
        }
    }

    // Section 4 Sound & Vibration Specifications
    // driver_accepted: Vibration [0, 200], Sound: No
    // driver_arrived: Vibration [0, 300, 150, 300], Sound: Yes
    // ride_started: Vibration [0, 200], Sound: No
    // ride_completed: Vibration [0, 150, 100, 150], Sound: No
    // ride_cancelled: Vibration [0, 300], Sound: Yes
    // new_ride_request: Vibration [0, 300], Sound: Optional
    // chat_message: Vibration [0, 150], Sound: No
    // emergency_sos: Vibration [0, 500, 200, 500, 200, 500], Sound: Yes (alarm)
    let vibePattern = [0, 200];
    let isSilent = true;

    if (eventType === 'driver_arrived') {
        vibePattern = [0, 300, 150, 300];
        isSilent = false;
    } else if (eventType === 'driver_accepted' || eventType === 'ride_started') {
        vibePattern = [0, 200];
        isSilent = true;
    } else if (eventType === 'ride_completed') {
        vibePattern = [0, 150, 100, 150];
        isSilent = true;
    } else if (eventType === 'ride_cancelled') {
        vibePattern = [0, 300];
        isSilent = false;
    } else if (eventType === 'new_ride_request') {
        vibePattern = [0, 300];
        isSilent = true;
    } else if (eventType === 'emergency_sos') {
        vibePattern = [0, 500, 200, 500, 200, 500];
        isSilent = false;
    } else if (eventType === 'chat_message') {
        vibePattern = [0, 150];
        isSilent = true;
    }

    const options = {
        body: body,
        icon: payload.icon || '/logo192.png',
        badge: payload.badge || '/favicon-32x32.png',
        data: {
            url: payload.url || (eventType === 'new_ride_request' ? '/driver' : '/'),
            eventType: eventType,
            channelId: channelId,
            timestamp: Date.now()
        },
        vibrate: vibePattern,
        silent: isSilent,
        tag: payload.tag || `j_ride_${eventType}`,
        renotify: true,
        actions: payload.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const payload = event.notification.data || {};
    const targetPath = payload.url || '/';
    const urlToOpen = new URL(targetPath, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (windowClients) {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Offline Fallback
self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                return await fetch(event.request);
            } catch (error) {
                const cache = await caches.open(CACHE_NAME);
                return await cache.match(OFFLINE_URL);
            }
        })());
    }
});
