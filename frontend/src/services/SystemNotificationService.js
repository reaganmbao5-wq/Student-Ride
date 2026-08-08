/**
 * SystemNotificationService.js
 * Centralized Real System Notification & Custom Haptic Vibration Engine for Student-Ride.
 * Replaces in-app toast popups with real OS System Notifications & intense custom vibrations.
 */
import { haptics, VIBRATION_PATTERNS } from '../utils/haptics';

class SystemNotificationService {
  constructor() {
    this.permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
  }

  async requestPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        const res = await Notification.requestPermission();
        this.permission = res;
        return res === 'granted';
      } catch (e) {
        console.warn('System notification permission request notice:', e);
      }
    }
    return this.permission === 'granted';
  }

  /**
   * Triggers a real System Notification + Custom Intense Vibration
   */
  notify({ title, body, eventType = 'default', icon = '/logo192.png', tag = 'mulu_ride_event' }) {
    // 1. Always trigger custom intense haptic vibration for the event
    switch (eventType) {
      case 'driver_arrived':
        haptics.driverArrived();
        break;
      case 'driver_accepted':
        haptics.driverAccepted();
        break;
      case 'ride_started':
        haptics.tripStarted();
        break;
      case 'ride_completed':
        haptics.tripCompleted();
        break;
      case 'new_ride_request':
        haptics.newRideRequest();
        break;
      case 'ride_cancelled':
        haptics.rideCancelled();
        break;
      default:
        haptics.tap();
    }

    // 2. Play subtle audio tone using Web Audio API
    this.playAudioAlert(eventType);

    // 3. Fire real OS System Notification if granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const pattern = VIBRATION_PATTERNS[eventType] || VIBRATION_PATTERNS.default;
        
        // If ServiceWorker is active, use ServiceWorker registration showNotification for better OS integration
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon,
              badge: '/favicon-32x32.png',
              vibrate: pattern,
              tag: tag,
              renotify: true,
              data: { eventType, timestamp: Date.now() }
            });
          }).catch(() => {
            this.fallbackWebNotification(title, body, icon, pattern, tag);
          });
        } else {
          this.fallbackWebNotification(title, body, icon, pattern, tag);
        }
      } catch (err) {
        console.warn('System Notification render notice:', err);
      }
    }
  }

  fallbackWebNotification(title, body, icon, pattern, tag) {
    try {
      const n = new Notification(title, {
        body,
        icon,
        badge: '/favicon-32x32.png',
        vibrate: pattern,
        tag: tag,
        renotify: true
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn('Fallback web notification notice:', e);
    }
  }

  /**
   * Web Audio API Synthesizer for high-awareness audio cues
   */
  playAudioAlert(eventType) {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (eventType === 'driver_arrived') {
        // High-awareness double chime (880Hz -> 1174Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else if (eventType === 'driver_accepted' || eventType === 'ride_started') {
        // Upward pitch chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2); // E5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else if (eventType === 'ride_completed') {
        // Triumph triple chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // AudioContext autostart restrictions
    }
  }

  // Pre-configured Ride Status Helpers
  notifyDriverAccepted(driverName, vehicleInfo) {
    this.notify({
      title: '🚗 Driver On The Way!',
      body: `${driverName || 'Your driver'} accepted your ride (${vehicleInfo || 'Car'}).`,
      eventType: 'driver_accepted',
      tag: 'ride_accepted'
    });
  }

  notifyDriverArrived(driverName) {
    this.notify({
      title: '🚨 DRIVER HAS ARRIVED!',
      body: `${driverName || 'Your driver'} is waiting at your pickup location!`,
      eventType: 'driver_arrived',
      tag: 'driver_arrived'
    });
  }

  notifyRideStarted() {
    this.notify({
      title: '🏁 Ride Started',
      body: 'You are on your way to the destination.',
      eventType: 'ride_started',
      tag: 'ride_started'
    });
  }

  notifyRideCompleted() {
    this.notify({
      title: '🎉 Arrived at Destination!',
      body: 'Your ride is complete. Thank you for riding with Mulu!',
      eventType: 'ride_completed',
      tag: 'ride_completed'
    });
  }

  notifyNewRideRequest(pickupLocation) {
    this.notify({
      title: '⚡ NEW RIDE REQUEST!',
      body: `New ride available near ${pickupLocation || 'your location'}. Tap to accept.`,
      eventType: 'new_ride_request',
      tag: 'new_ride_request'
    });
  }

  notifyRideCancelled(reason) {
    this.notify({
      title: '❌ Ride Cancelled',
      body: reason || 'The ride was cancelled.',
      eventType: 'ride_cancelled',
      tag: 'ride_cancelled'
    });
  }
}

export const systemNotification = new SystemNotificationService();
