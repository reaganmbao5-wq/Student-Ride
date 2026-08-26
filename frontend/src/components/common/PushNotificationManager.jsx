import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { PermissionsService } from '../../services/PermissionsService';
import { getBackendUrl } from '../../utils/urlHelpers';

// Utility to convert Base64 VAPID key to Uint8Array
const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const PushNotificationManager = () => {
    const { isAuthenticated, token, user } = useAuth();
    const [showPrompt, setShowPrompt] = useState(false);

    const subscribeUser = async (isExplicit = true) => {
        try {
            const currentToken = token || localStorage.getItem('token');
            const headers = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
            const backendUrl = getBackendUrl();

            if (Capacitor.isNativePlatform()) {
                const hasPermission = await PermissionsService.requestPushPermission();
                if (!hasPermission) {
                    console.log('Push permission denied natively.');
                    if (isExplicit) {
                        localStorage.setItem('j_ride_push_asked', 'true');
                        setShowPrompt(false);
                    }
                    return;
                }

                // If we already have a cached native FCM token, immediately sync it with the current user ID
                const cachedFcm = localStorage.getItem('j_ride_fcm_token');
                if (cachedFcm && currentToken) {
                    try {
                        await fetch(`${backendUrl}/api/notifications/subscribe`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...headers,
                            },
                            body: JSON.stringify({
                                endpoint: `FCM_TOKEN:${cachedFcm}`,
                                keys: { p256dh: "native", auth: "native" }
                            }),
                        });
                        console.log('Synced cached FCM token to current user account');
                    } catch (e) {
                        console.warn('Failed to sync cached FCM token:', e);
                    }
                }

                // Set up listener before calling register
                await PushNotifications.removeAllListeners();

                PushNotifications.addListener('registration', async (fcmToken) => {
                    console.log('FCM Token generated:', fcmToken.value);
                    localStorage.setItem('j_ride_fcm_token', fcmToken.value);
                    const activeToken = localStorage.getItem('token') || currentToken;
                    const activeHeaders = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
                    try {
                        await fetch(`${backendUrl}/api/notifications/subscribe`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...activeHeaders,
                            },
                            body: JSON.stringify({
                                endpoint: `FCM_TOKEN:${fcmToken.value}`,
                                keys: { p256dh: "native", auth: "native" }
                            }),
                        });
                        console.log('Native push subscription registered with backend');
                    } catch (err) {
                        console.error('Failed to register native token to backend:', err);
                    }
                });

                PushNotifications.addListener('registrationError', (error) => {
                    console.error('Push registration error:', JSON.stringify(error));
                });

                PushNotifications.addListener('pushNotificationReceived', async (notification) => {
                    console.log('Push received in foreground:', notification);
                });

                // Trigger registration
                await PushNotifications.register();

                if (isExplicit) {
                    localStorage.setItem('j_ride_push_asked', 'true');
                    setShowPrompt(false);
                }

            } else {
                // WEB VAPID PUSH REGISTRATION
                if (isExplicit) {
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') {
                        console.log('Push permission denied.');
                        localStorage.setItem('j_ride_push_asked', 'true');
                        setShowPrompt(false);
                        return;
                    }
                }

                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.ready;
                    const keyResponse = await fetch(`${backendUrl}/api/notifications/vapid-public-key`, { headers });
                    const data = await keyResponse.json();
                    const publicKey = data.public_key || data.publicKey;
                    
                    if (publicKey) {
                        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
                        const subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: convertedVapidKey,
                        });

                        await fetch(`${backendUrl}/api/notifications/subscribe`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...headers },
                            body: JSON.stringify(subscription),
                        });

                        console.log('Web Push subscription registered successfully');
                    }
                }

                if (isExplicit) {
                    localStorage.setItem('j_ride_push_asked', 'true');
                    setShowPrompt(false);
                }
            }
        } catch (error) {
            console.error('Error during push registration:', error);
            if (isExplicit) {
                setShowPrompt(false);
            }
        }
    };

    useEffect(() => {
        const checkPermissionAndRefresh = async () => {
            if (Capacitor.isNativePlatform()) {
                try {
                    // Create Notification Channels (Section 2)
                    await PushNotifications.createChannel({
                        id: 'ride_updates',
                        name: 'Ride Updates',
                        description: 'Real-time updates about ride acceptance, arrival, progress, and completion',
                        importance: 5,
                        visibility: 1,
                        vibration: true
                    });
                    await PushNotifications.createChannel({
                        id: 'chat_messages',
                        name: 'Chat Messages',
                        description: 'In-ride chat messages between drivers and students',
                        importance: 3,
                        visibility: 1,
                        vibration: true
                    });
                    await PushNotifications.createChannel({
                        id: 'account_security',
                        name: 'Account & Security',
                        description: 'Account profile changes and security alerts',
                        importance: 3,
                        visibility: 1,
                        vibration: false
                    });
                    await PushNotifications.createChannel({
                        id: 'admin_broadcast',
                        name: 'Announcements',
                        description: 'System announcements and updates from admins',
                        importance: 3,
                        visibility: 1,
                        vibration: false
                    });
                    await PushNotifications.createChannel({
                        id: 'emergency_sos',
                        name: 'Emergency SOS Alerts',
                        description: 'High-priority critical emergency alerts',
                        importance: 5,
                        visibility: 1,
                        vibration: true
                    });
                } catch (chErr) {
                    console.warn('Channel creation notice:', chErr);
                }

                const status = await PushNotifications.checkPermissions();
                if (status.receive !== 'granted') {
                    const asked = localStorage.getItem('j_ride_push_asked');
                    if (!asked) setShowPrompt(true);
                } else if (isAuthenticated && token) {
                    subscribeUser(false);
                }
            } else {
                if ('Notification' in window) {
                    if (Notification.permission === 'default') {
                        const asked = localStorage.getItem('j_ride_push_asked');
                        if (!asked) setShowPrompt(true);
                    } else if (Notification.permission === 'granted' && isAuthenticated && token) {
                        subscribeUser(false);
                    }
                }
            }
        };

        checkPermissionAndRefresh();
    }, [isAuthenticated, token, user?.id]);

    const handleDismiss = () => {
        localStorage.setItem('j_ride_push_asked', 'true');
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed top-4 left-4 right-4 z-[9999] animate-in slide-in-from-top-5 fade-in duration-300 pointer-events-auto">
            <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl p-4 flex items-start sm:items-center justify-between gap-4 max-w-md mx-auto">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-gold animate-bounce" />
                    </div>
                    <div>
                        <h4 className="font-heading font-semibold text-foreground text-sm">Enable Ride Updates</h4>
                        <p className="text-muted-foreground text-xs mt-0.5">
                            Get instant alerts when your driver arrives or when your ride is accepted.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => subscribeUser(true)}
                        className="bg-gold text-black text-xs font-semibold px-4 py-2 rounded-xl hover:bg-gold/90 active:scale-95 transition-all cursor-pointer shadow-sm"
                    >
                        Enable
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PushNotificationManager;
