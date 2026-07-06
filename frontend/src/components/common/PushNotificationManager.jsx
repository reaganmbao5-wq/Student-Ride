import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PermissionsService } from '../../services/PermissionsService';

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
    const { isAuthenticated, token } = useAuth();
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;

        const checkPermission = async () => {
            const hasAsked = localStorage.getItem('mulu_rides_push_asked');
            if (hasAsked) return;

            if (Capacitor.isNativePlatform()) {
                const permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'prompt') {
                    setShowPrompt(true);
                } else if (permStatus.receive === 'granted') {
                    await subscribeUser(false);
                }
            } else {
                if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
                
                if (Notification.permission === 'default') {
                    setShowPrompt(true);
                } else if (Notification.permission === 'granted') {
                    await subscribeUser(false);
                }
            }
        };

        const timer = setTimeout(() => {
            checkPermission();
        }, 3000);

        return () => clearTimeout(timer);
    }, [isAuthenticated]);

    const subscribeUser = async (isExplicit = true) => {
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;

            if (Capacitor.isNativePlatform()) {
                const hasPermission = await PermissionsService.requestPushPermission();
                if (!hasPermission) {
                    console.log('Push permission denied natively.');
                    if (isExplicit) {
                        localStorage.setItem('mulu_rides_push_asked', 'true');
                        setShowPrompt(false);
                    }
                    return;
                }

                // Register with native FCM
                await PushNotifications.register();

                PushNotifications.addListener('registration', async (fcmToken) => {
                    console.log('FCM Token generated:', fcmToken.value);
                    try {
                        // Register device token with backend using existing endpoint
                        // We format it as a PushSubscriptionRequest to satisfy the backend model schema
                        await fetch(`${backendUrl}/api/notifications/subscribe`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...headers,
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

                // Request permission for local notifications (Live Tracking)
                await LocalNotifications.requestPermissions();

                // Intercept foreground pushes or data payloads and convert them into Local Notifications
                // that have the exact same ID (which overwrites the previous one, creating a "live progress" feel).
                PushNotifications.addListener('pushNotificationReceived', async (notification) => {
                    console.log('Push received:', notification);
                    
                    // The backend payload might send it in `data.payload`
                    let data = notification.data || {};
                    let title = notification.title || "Mulu Rides Update";
                    let body = notification.body || "You have a new update.";

                    // If it's a data-only payload containing Live Tracking info:
                    if (data && data.type === 'LIVE_TRACKING_UPDATE') {
                        try {
                            const parsedPayload = JSON.parse(data.payload);
                            title = "Driver is moving...";
                            body = `Arriving in ${parsedPayload.eta || 'a few'} mins`;
                        } catch(e) {}
                    }

                    await LocalNotifications.schedule({
                        notifications: [
                            {
                                title: title,
                                body: body,
                                id: 12345, // Constant ID forces it to update the same notification instead of stacking!
                                schedule: { at: new Date(Date.now() + 100) },
                                sound: null, // Silent for live tracking
                            }
                        ]
                    });
                });


                if (isExplicit) {
                    localStorage.setItem('mulu_rides_push_asked', 'true');
                    setShowPrompt(false);
                }

            } else {
                // WEB VAPID LOGIC
                if (isExplicit) {
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') {
                        console.log('Push permission denied.');
                        localStorage.setItem('mulu_rides_push_asked', 'true');
                        setShowPrompt(false);
                        return;
                    }
                }

                const registration = await navigator.serviceWorker.ready;
                const keyResponse = await fetch(`${backendUrl}/api/notifications/vapid-public-key`, { headers });
                const { publicKey } = await keyResponse.json();
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

                console.log('Web Push subscription successful');
                if (isExplicit) {
                    localStorage.setItem('mulu_rides_push_asked', 'true');
                    setShowPrompt(false);
                }
            }
        } catch (error) {
            console.error('Failed to subscribe user:', error);
            if (isExplicit) setShowPrompt(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem('mulu_rides_push_asked', 'true');
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed top-4 left-4 right-4 z-[9999] animate-in slide-in-from-top-5 fade-in duration-300">
            <div className="bg-[#1A1A1A] border border-gold/20 rounded-2xl shadow-2xl p-4 flex items-start sm:items-center justify-between gap-4 max-w-md mx-auto">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-gold animate-bounce" />
                    </div>
                    <div>
                        <h4 className="text-white font-medium text-sm">Enable Ride Updates</h4>
                        <p className="text-white/60 text-xs mt-0.5">
                            Get instantly notified when your driver arrives or when your ride is accepted.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => subscribeUser(true)}
                        className="bg-gold text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gold/90 transition-colors"
                    >
                        Enable
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-2 text-white/40 hover:text-white transition-colors"
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
