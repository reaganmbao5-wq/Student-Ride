import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../../context/AuthContext';
import { PermissionsService } from '../../services/PermissionsService';
import { haptics } from '../../utils/haptics';
import { toast } from 'sonner';

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

export const NotificationPermissionCard = ({ variant = 'banner' }) => {
  const { token } = useAuth();
  const [permissionState, setPermissionState] = useState('default'); // 'granted', 'denied', 'default'
  const [isSubscribing, setIsSubscribing] = useState(false);

  const checkStatus = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await PushNotifications.checkPermissions();
        setPermissionState(perm.receive === 'granted' ? 'granted' : 'default');
      } catch (e) {
        setPermissionState('default');
      }
    } else {
      if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleEnableNotifications = async () => {
    haptics.primaryButton();
    setIsSubscribing(true);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;

      if (Capacitor.isNativePlatform()) {
        const hasPermission = await PermissionsService.requestPushPermission();
        if (!hasPermission) {
          toast.error('Notification permission denied on device');
          setPermissionState('denied');
          setIsSubscribing(false);
          return;
        }

        await PushNotifications.register();
        
        PushNotifications.addListener('registration', async (fcmToken) => {
          try {
            await fetch(`${backendUrl}/api/notifications/subscribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({
                endpoint: `FCM_TOKEN:${fcmToken.value}`,
                keys: { p256dh: "native", auth: "native" }
              }),
            });
            haptics.pinDrop();
            toast.success('Live Push Notifications Enabled!');
            setPermissionState('granted');
          } catch (err) {
            console.error('Failed backend subscribe:', err);
          }
        });
      } else {
        if (!('Notification' in window)) {
          toast.error('Notifications not supported in this browser');
          setIsSubscribing(false);
          return;
        }

        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          toast.error('Notification permission denied');
          setPermissionState('denied');
          setIsSubscribing(false);
          return;
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

        haptics.pinDrop();
        toast.success('Live Push Notifications Enabled!');
        setPermissionState('granted');
      }
    } catch (error) {
      console.error('Push activation error:', error);
      toast.error('Could not activate notifications');
    } finally {
      setIsSubscribing(false);
    }
  };

  if (permissionState === 'granted') {
    if (variant === 'profile') {
      return (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-gold/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center text-gold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Push Notifications Active</p>
              <p className="text-xs text-zinc-400">Receiving instant alerts for rides & arrivals</p>
            </div>
          </div>
          <span className="text-xs font-bold text-gold bg-gold/10 px-3 py-1 rounded-full border border-gold/30">
            Enabled
          </span>
        </div>
      );
    }
    return null; // Don't block banner if already granted
  }

  // Profile Card Variant
  if (variant === 'profile') {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/90 border border-gold/40 shadow-[0_0_25px_rgba(234,179,8,0.15)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center text-gold shrink-0">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Enable Live Push Notifications</p>
            <p className="text-xs text-zinc-400">Get loud pocket vibrations when your driver arrives</p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleEnableNotifications}
          disabled={isSubscribing}
          className="w-full sm:w-auto bg-gold text-zinc-950 text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg hover:bg-gold/90 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {isSubscribing ? 'Activating...' : 'Turn On Notifications'}
        </motion.button>
      </div>
    );
  }

  // Dashboard Banner Variant
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full mb-4"
      >
        <div className="bg-zinc-950 border border-gold/50 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(234,179,8,0.2)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold shrink-0">
              <Bell className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h5 className="text-xs font-bold text-white truncate">Notifications Off</h5>
              <p className="text-[11px] text-zinc-400 truncate">Tap to get driver arrival & ride status alerts</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleEnableNotifications}
            disabled={isSubscribing}
            className="shrink-0 bg-gold text-zinc-950 text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:bg-gold/90 transition-all cursor-pointer"
          >
            {isSubscribing ? 'Enabling...' : 'Enable Now'}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
