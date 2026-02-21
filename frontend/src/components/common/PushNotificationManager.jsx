import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, X } from 'lucide-react';

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
            // Check if service workers and push manager are supported
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                return;
            }

            // Check if we already asked
            const hasAsked = localStorage.getItem('mulu_rides_push_asked');
            if (hasAsked) return;

            if (Notification.permission === 'default') {
                // We show a custom soft-prompt first
                setShowPrompt(true);
            } else if (Notification.permission === 'granted') {
                // If already granted but maybe we haven't subscribed this specific device/session
                // Optionally subscribe silently
                await subscribeUser(false);
            }
        };

        // Slight delay so it doesn't overwhelm right after login
        const timer = setTimeout(() => {
            checkPermission();
        }, 3000);

        return () => clearTimeout(timer);
    }, [isAuthenticated]);

    const subscribeUser = async (isExplicit = true) => {
        try {
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

            // Get VAPID public key from backend
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
            const keyResponse = await fetch(`${backendUrl}/api/notifications/vapid-public-key`, {
                headers
            });

            const { publicKey } = await keyResponse.json();
            const convertedVapidKey = urlBase64ToUint8Array(publicKey);

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey,
            });

            // Send subscription to backend
            await fetch(`${backendUrl}/api/notifications/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify(subscription),
            });

            console.log('Push subscription successful');
            if (isExplicit) {
                localStorage.setItem('mulu_rides_push_asked', 'true');
                setShowPrompt(false);
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
