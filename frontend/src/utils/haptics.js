/**
 * Safe Web Haptics Engine for Student-Ride
 * Provides distinct, tactile vibration signatures for mobile web, PWA & native Capacitor.
 */
export const haptics = {
  // Ultra-light crisp tick (general navigation, subtle taps)
  tap: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(8); } catch (e) {}
    }
  },

  // Primary action button click ("Confirm Ride", "Set Location")
  primaryButton: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([12, 18, 12]); } catch (e) {}
    }
  },

  // Continuous micro-pulses during swiping (Fare card drag gesture)
  swipeProgress: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([6, 10, 6]); } catch (e) {}
    }
  },

  // Swiping snap / mode toggle complete (Private <-> Shared mode change)
  swipeSnap: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([15, 25, 15]); } catch (e) {}
    }
  },

  // Pin Landing / Ground Thump (Single heavy, high-frequency "BOOM" pulse when pin lands on landmark/ground)
  pinDrop: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(55); } catch (e) {}
    }
  },

  // Slide-to-Delete threshold release on ride history items
  deleteThreshold: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([35]); } catch (e) {}
    }
  },

  // Driver Accepted milestone
  driverAccepted: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([30, 40, 30]); } catch (e) {}
    }
  },

  // Driver Arrived at Pickup (Background pocket vibration ring)
  driverArrived: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([80, 60, 80, 60, 120]); } catch (e) {}
    }
  },

  // Ride Completed success pulse
  tripCompleted: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([40, 60, 40]); } catch (e) {}
    }
  }
};
