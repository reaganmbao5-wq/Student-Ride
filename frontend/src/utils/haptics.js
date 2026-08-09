import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Safe Web & Native Haptics Engine for Student-Ride
 * Provides distinct, intense custom vibration signatures for mobile web, PWA & native Capacitor.
 * Custom tailored for immediate user awareness (e.g. intense Driver Arrived pocket alert).
 */

export const VIBRATION_PATTERNS = {
  driver_arrived: [0, 600, 150, 600, 150, 900],
  driver_accepted: [0, 300, 150, 300],
  ride_started: [0, 200, 100, 200],
  ride_completed: [0, 150, 100, 150, 100, 400],
  emergency_sos: [0, 1000, 200, 1000],
  default: [0, 200, 100, 200]
};

const isEnabledInStorage = () => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('mulu_vibrations_enabled') !== 'false';
  }
  return true;
};

const safeVibrate = async (pattern) => {
  if (!isEnabledInStorage()) return;

  // 1. Native Capacitor Haptics (Required for Android APK & iOS native WebViews)
  try {
    if (typeof pattern === 'number') {
      await Haptics.vibrate({ duration: Math.max(pattern, 40) });
    } else if (Array.isArray(pattern)) {
      // Calculate active pulse duration for native Android motor
      const activeDuration = pattern.filter((_, idx) => idx % 2 === 0).reduce((a, b) => a + b, 0);
      await Haptics.vibrate({ duration: Math.max(activeDuration, 100) });
    } else {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  } catch (err) {
    // Fallback if not running in native Capacitor shell
  }

  // 2. Standard Web Vibration API for Web/PWA browsers
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Haptics vibrate notice:', e);
    }
  }
};

export const haptics = {
  // Master Vibration Toggle Controllers
  isVibrationEnabled: () => isEnabledInStorage(),
  setVibrationEnabled: (enabled) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mulu_vibrations_enabled', enabled ? 'true' : 'false');
    }
  },

  // Ultra-light crisp tick (general navigation, subtle taps)
  tap: () => safeVibrate(15),

  // Primary action button click ("Confirm Ride", "Set Location")
  primaryButton: () => safeVibrate([15, 20, 15]),

  // Continuous micro-pulses during swiping
  swipeProgress: () => safeVibrate([10, 15, 10]),

  // Swiping snap / mode toggle complete
  swipeSnap: () => safeVibrate([20, 30, 20]),

  // Ground Thump on pin drop
  pinDrop: () => safeVibrate(60),

  // Slide-to-Delete threshold release
  deleteThreshold: () => safeVibrate(40),

  // Driver Accepted milestone (Strong double pulse)
  driverAccepted: () => safeVibrate(VIBRATION_PATTERNS.driver_accepted),

  // Driver Arrived at Pickup - MOST INTENSE ALARM PATTERN (Maximum User Awareness!)
  driverArrived: () => safeVibrate(VIBRATION_PATTERNS.driver_arrived),

  // Ride Started (Double sharp click)
  rideStarted: () => safeVibrate(VIBRATION_PATTERNS.ride_started),

  // Ride Completed celebration
  rideCompleted: () => safeVibrate(VIBRATION_PATTERNS.ride_completed),

  // Warning / Danger / SOS
  warning: () => safeVibrate(VIBRATION_PATTERNS.emergency_sos),
};
