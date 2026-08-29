import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * J Ride Haptics Engine
 * Implements Section 4 Vibration Specifications:
 * - driver_accepted: Single short pulse [0, 200]
 * - driver_arrived: Double pulse [0, 300, 150, 300]
 * - ride_started: Single short pulse [0, 200]
 * - ride_completed: Short pulse [0, 150, 100, 150]
 * - ride_cancelled: Single pulse [0, 300]
 * - new_ride_request: Single pulse [0, 300]
 * - chat_message: Single short pulse [0, 150]
 * - emergency_sos: Sustained pattern [0, 500, 200, 500, 200, 500]
 */

export const VIBRATION_PATTERNS = {
  driver_accepted: [0, 200],
  driver_arrived: [0, 300, 150, 300],
  ride_started: [0, 200],
  ride_completed: [0, 150, 100, 150],
  ride_cancelled: [0, 300],
  new_ride_request: [0, 300],
  chat_message: [0, 150],
  emergency_sos: [0, 500, 200, 500, 200, 500],
  default: [0, 200]
};

const isEnabledInStorage = () => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('j_ride_vibrations_enabled') !== 'false' && localStorage.getItem('mulu_vibrations_enabled') !== 'false';
  }
  return true;
};

const safeVibrate = async (pattern) => {
  if (!isEnabledInStorage()) return;

  // 1. Native Capacitor Haptics (Android APK & iOS)
  try {
    if (typeof pattern === 'number') {
      await Haptics.vibrate({ duration: Math.max(pattern, 40) });
    } else if (Array.isArray(pattern)) {
      const activeDuration = pattern.filter((_, idx) => idx % 2 !== 0).reduce((a, b) => a + b, 0);
      await Haptics.vibrate({ duration: Math.max(activeDuration, 100) });
    } else {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  } catch (err) {
    // Non-native fallback
  }

  // 2. Standard Web Vibration API for Web/PWA
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Haptics vibrate notice:', e);
    }
  }
};

export const haptics = {
  isVibrationEnabled: () => isEnabledInStorage(),
  setVibrationEnabled: (enabled) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('j_ride_vibrations_enabled', enabled ? 'true' : 'false');
      localStorage.setItem('mulu_vibrations_enabled', enabled ? 'true' : 'false');
    }
  },

  // Subtle UI navigation taps
  tap: () => safeVibrate(15),
  selection: () => safeVibrate(10),
  buttonClick: () => safeVibrate(15),
  primaryButton: () => safeVibrate([15, 20, 15]),
  swipeProgress: () => safeVibrate([10, 15, 10]),
  swipeSnap: () => safeVibrate([20, 30, 20]),
  pinDrop: () => safeVibrate(60),
  deleteThreshold: () => safeVibrate(40),

  // Ride Lifecycle Milestone Vibrations
  driverAccepted: () => safeVibrate(VIBRATION_PATTERNS.driver_accepted),
  driverArrived: () => safeVibrate(VIBRATION_PATTERNS.driver_arrived),
  rideStarted: () => safeVibrate(VIBRATION_PATTERNS.ride_started),
  tripStarted: () => safeVibrate(VIBRATION_PATTERNS.ride_started),
  rideCompleted: () => safeVibrate(VIBRATION_PATTERNS.ride_completed),
  tripCompleted: () => safeVibrate(VIBRATION_PATTERNS.ride_completed),
  rideCancelled: () => safeVibrate(VIBRATION_PATTERNS.ride_cancelled),
  newRideRequest: () => safeVibrate(VIBRATION_PATTERNS.new_ride_request),
  chatMessage: () => safeVibrate(VIBRATION_PATTERNS.chat_message),
  emergencySos: () => safeVibrate(VIBRATION_PATTERNS.emergency_sos),
};
