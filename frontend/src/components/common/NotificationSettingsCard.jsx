import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, CheckCircle2, ShieldAlert, Volume2, Vibrate, Info } from 'lucide-react';
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

export const NotificationSettingsCard = () => {
  const { token, api } = useAuth();
  const [permissionState, setPermissionState] = useState('default'); // 'granted', 'denied', 'default'
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [vibrationsEnabled, setVibrationsEnabled] = useState(() => haptics.isVibrationEnabled());

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

  const handleTogglePushNotifications = async () => {
    haptics.tap();

    if (permissionState === 'granted') {
      toast.info('To disable push notifications, manage notification permissions in your browser or device settings.');
      return;
    }

    setIsSubscribing(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const hasPermission = await PermissionsService.requestPushPermission();
        if (!hasPermission) {
          toast.error('Push notification permission denied on device.');
          setPermissionState('denied');
          setIsSubscribing(false);
          return;
        }

        await PushNotifications.register();
        
        PushNotifications.addListener('registration', async (fcmToken) => {
          try {
            await api.post('/notifications/subscribe', {
              endpoint: `FCM_TOKEN:${fcmToken.value}`,
              keys: { p256dh: "native", auth: "native" }
            });
            haptics.pinDrop();
            toast.success('Live Push Notifications Enabled!');
            setPermissionState('granted');
          } catch (err) {
            console.error('Failed backend subscribe:', err);
            toast.error('Failed to register notifications with server.');
          }
        });
      } else {
        if (!('Notification' in window)) {
          toast.error('Notifications are not supported in this browser.');
          setIsSubscribing(false);
          return;
        }

        const perm = await Notification.requestPermission();
        setPermissionState(perm);

        if (perm !== 'granted') {
          toast.error('Notification permission was blocked in browser settings. Tap the lock icon 🔒 next to the web address to allow.');
          setIsSubscribing(false);
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        
        // Fetch VAPID key via authenticated API client
        let publicKey;
        try {
          const res = await api.get('/notifications/vapid-public-key');
          publicKey = res.data?.publicKey;
        } catch (e) {
          const res = await fetch('/api/notifications/vapid-public-key');
          const data = await res.json();
          publicKey = data?.publicKey;
        }

        if (!publicKey) {
          throw new Error('VAPID public key missing');
        }

        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });

        await api.post('/notifications/subscribe', subscription);

        haptics.pinDrop();
        toast.success('Live Push Notifications Enabled!');
        setPermissionState('granted');
      }
    } catch (error) {
      console.error('Push activation error:', error);
      toast.error('Could not activate notifications. Check network connection or site settings.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleToggleVibrations = () => {
    const newState = !vibrationsEnabled;
    setVibrationsEnabled(newState);
    haptics.setVibrationEnabled(newState);
    if (newState) {
      haptics.driverArrived();
      toast.success('App & Website Vibrations Enabled (ON by default)');
    } else {
      toast.info('App & Website Vibrations Disabled');
    }
  };

  return (
    <div className="w-full bg-zinc-950 border border-gold/30 rounded-3xl p-5 shadow-[0_0_30px_rgba(234,179,8,0.12)] space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
        <Bell className="w-5 h-5 text-gold" />
        <h3 className="font-heading text-lg font-bold text-white tracking-wide">
          Notification & Haptic Settings
        </h3>
      </div>

      {/* Push Notifications Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            permissionState === 'granted' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gold/20 text-gold border border-gold/30'
          }`}>
            {permissionState === 'granted' ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <Bell className="w-6 h-6 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">Live Push Notifications</h4>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                permissionState === 'granted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {permissionState === 'granted' ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Receive real-time alerts for ride arrivals, acceptances & trip updates
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleTogglePushNotifications}
          disabled={isSubscribing}
          className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
            permissionState === 'granted'
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
              : 'bg-gold text-zinc-950 hover:bg-gold/90'
          }`}
        >
          {isSubscribing ? (
            'Enabling...'
          ) : permissionState === 'granted' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Notifications On</span>
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              <span>Turn On Notifications</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Blocked Permission Warning Box if Denied */}
      {permissionState === 'denied' && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-200">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-300">Notifications are blocked in browser settings</p>
            <p className="text-red-200/80 mt-0.5">
              Tap the lock icon 🔒 next to the web address at the top of your browser to set Notification permission to "Allow".
            </p>
          </div>
        </div>
      )}

      {/* Universal Vibration / Haptics Toggle (ON BY DEFAULT) */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gold/20 text-gold border border-gold/30 flex items-center justify-center shrink-0">
            <Vibrate className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">App Vibrations & Pocket Alerts</h4>
              <span className="text-[10px] font-extrabold uppercase bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/20">
                Default: ON
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Pocket vibrations for driver arrival, button taps & ride progress
            </p>
          </div>
        </div>

        {/* Dynamic Toggle Switch */}
        <button
          type="button"
          onClick={handleToggleVibrations}
          className={`relative w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none cursor-pointer ${
            vibrationsEnabled ? 'bg-gold' : 'bg-zinc-700'
          }`}
          title={vibrationsEnabled ? 'Click to turn off app vibrations' : 'Click to turn on app vibrations'}
        >
          <motion.div
            animate={{ x: vibrationsEnabled ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`w-6 h-6 rounded-full shadow-md ${
              vibrationsEnabled ? 'bg-zinc-950' : 'bg-zinc-400'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
