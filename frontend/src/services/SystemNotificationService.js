/**
 * SystemNotificationService.js
 * J Ride Notification & Audio Synthesizer Engine
 * Complies with Section 2 Channels, Section 4 Audio/Vibration rules, and Section 5 Clean Copy.
 */
import { haptics, VIBRATION_PATTERNS } from '../utils/haptics';
import { toast } from 'sonner';

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
   * Play short, utility-grade audio tone per Section 4 specifications
   */
  playAudioAlert(eventType) {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Only driver_arrived, ride_cancelled, and emergency_sos are allowed sound
      if (eventType === 'driver_arrived') {
        // Short single tone (< 250ms), not a chime sequence
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      } else if (eventType === 'ride_cancelled') {
        // Brief neutral tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else if (eventType === 'emergency_sos') {
        // Distinct alarm-style tone (emergency_sos only)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(700, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(950, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      // AudioContext autostart restrictions handled silently
    }
  }

  /**
   * Triggers OS System Notification + Vibration + Audio
   */
  notify({ title, body, eventType = 'default', channelId = 'ride_updates', icon = '/logo192.png', tag = 'j_ride_event' }) {
    // In-App Toast Banner
    try {
      if (title) {
        if (eventType === 'driver_arrived' || eventType === 'ride_completed' || eventType === 'driver_accepted') {
          toast.success(title, { description: body, duration: 4000 });
        } else if (eventType === 'ride_cancelled') {
          toast.error(title, { description: body, duration: 4000 });
        } else {
          toast.info(title, { description: body, duration: 4000 });
        }
      }
    } catch (e) {}

    // 1. Hardware Vibration
    switch (eventType) {
      case 'driver_arrived':
        haptics.driverArrived();
        break;
      case 'driver_accepted':
        haptics.driverAccepted();
        break;
      case 'ride_started':
        haptics.rideStarted();
        break;
      case 'ride_completed':
        haptics.rideCompleted();
        break;
      case 'new_ride_request':
        haptics.newRideRequest();
        break;
      case 'ride_cancelled':
        haptics.rideCancelled();
        break;
      case 'chat_message':
        haptics.chatMessage();
        break;
      case 'emergency_sos':
        haptics.emergencySos();
        break;
      default:
        haptics.tap();
    }

    // 2. Audio Alert (strictly compliant with Section 4)
    this.playAudioAlert(eventType);

    // 3. Native OS System Notification (if permitted)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const pattern = VIBRATION_PATTERNS[eventType] || VIBRATION_PATTERNS.default;
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon,
              badge: '/favicon-32x32.png',
              vibrate: pattern,
              tag: tag,
              renotify: true,
              data: { eventType, channelId, timestamp: Date.now() }
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
      console.warn('Fallback notification notice:', e);
    }
  }

  // Pre-configured Specification-Compliant Helpers (Section 5A)
  notifyDriverAccepted(driverName) {
    this.notify({
      title: 'Driver on the way',
      body: `${driverName || 'Your driver'} accepted your ride and is heading your way.`,
      eventType: 'driver_accepted',
      channelId: 'ride_updates',
      tag: 'ride_accepted'
    });
  }

  notifyDriverArrived(driverName) {
    this.notify({
      title: 'Driver has arrived',
      body: `${driverName || 'Your driver'} is waiting at your pickup location.`,
      eventType: 'driver_arrived',
      channelId: 'ride_updates',
      tag: 'driver_arrived'
    });
  }

  notifyRideStarted() {
    this.notify({
      title: 'Ride started',
      body: 'You are on your way to the destination.',
      eventType: 'ride_started',
      channelId: 'ride_updates',
      tag: 'ride_started'
    });
  }

  notifyRideCompleted() {
    this.notify({
      title: 'Ride complete',
      body: "You've arrived at your destination.",
      eventType: 'ride_completed',
      channelId: 'ride_updates',
      tag: 'ride_completed'
    });
  }

  notifyNewRideRequest(pickupLocation) {
    this.notify({
      title: 'New ride request',
      body: `Pickup near ${pickupLocation || 'your location'}. Tap to view.`,
      eventType: 'new_ride_request',
      channelId: 'ride_updates',
      tag: 'new_ride_request'
    });
  }

  notifyRideCancelled(reason) {
    this.notify({
      title: 'Ride cancelled',
      body: reason || 'The ride was cancelled.',
      eventType: 'ride_cancelled',
      channelId: 'ride_updates',
      tag: 'ride_cancelled'
    });
  }

  notifyEmergencySos(studentName) {
    this.notify({
      title: 'Emergency alert',
      body: `${studentName || 'Student'} triggered an emergency alert during a ride.`,
      eventType: 'emergency_sos',
      channelId: 'emergency_sos',
      tag: 'emergency_sos'
    });
  }
}

export const systemNotification = new SystemNotificationService();
