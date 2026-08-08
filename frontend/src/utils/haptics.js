/**
 * Safe Web & Native Haptics Engine for Student-Ride
 * Provides distinct, intense custom vibration signatures for mobile web, PWA & native Capacitor.
 * Custom tailored for immediate user awareness (e.g. intense Driver Arrived pocket alert).
 */

const safeVibrate = (pattern) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Haptics vibrate notice:', e);
    }
  }
};

export const haptics = {
  // Ultra-light crisp tick (general navigation, subtle taps)
  tap: () => safeVibrate(8),

  // Primary action button click ("Confirm Ride", "Set Location")
  primaryButton: () => safeVibrate([12, 18, 12]),

  // Continuous micro-pulses during swiping
  swipeProgress: () => safeVibrate([6, 10, 6]),

  // Swiping snap / mode toggle complete
  swipeSnap: () => safeVibrate([15, 25, 15]),

  // Ground Thump on pin drop
  pinDrop: () => safeVibrate(55),

  // Slide-to-Delete threshold release
  deleteThreshold: () => safeVibrate(35),

  // Driver Accepted milestone (Strong double pulse)
  driverAccepted: () => safeVibrate([0, 300, 150, 300]),

  // Driver Arrived at Pickup - MOST INTENSE ALARM PATTERN (Maximum User Awareness!)
  // Heavy triple-burst pocket alert: 600ms buzz, 150ms pause, 600ms buzz, 150ms pause, 900ms burst
  driverArrived: () => safeVibrate([0, 600, 150, 600, 150, 900]),

  // Ride Started (Double sharp click)
  tripStarted: () => safeVibrate([0, 200, 100, 200]),

  // Ride Completed (Success triumph multi-pulse pattern)
  tripCompleted: () => safeVibrate([0, 150, 100, 150, 100, 400]),

  // New Ride Request (For Driver - Intense alarm vibration)
  newRideRequest: () => safeVibrate([0, 500, 150, 500, 150, 800]),

  // Ride Cancelled (Warning alert)
  rideCancelled: () => safeVibrate([0, 400, 100, 400])
};

// Export raw vibration patterns for Service Worker / Web Notification API
export const VIBRATION_PATTERNS = {
  driver_arrived: [0, 600, 150, 600, 150, 900],
  driver_accepted: [0, 300, 150, 300],
  ride_started: [0, 200, 100, 200],
  ride_completed: [0, 150, 100, 150, 100, 400],
  new_ride_request: [0, 500, 150, 500, 150, 800],
  ride_cancelled: [0, 400, 100, 400],
  default: [0, 200, 100, 200]
};
