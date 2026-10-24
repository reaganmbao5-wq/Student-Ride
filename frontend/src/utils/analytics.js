import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.REACT_APP_POSTHOG_KEY;
const POSTHOG_HOST = process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com';

let isInitialized = false;

export const initPostHog = () => {
  if (isInitialized) return;
  if (!POSTHOG_KEY) {
    console.warn('[PostHog] No REACT_APP_POSTHOG_KEY found. Analytics running in no-op mode.');
    return;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true
        }
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PostHog] Initialized successfully in project:', ph.get_distinct_id());
        }
      }
    });
    isInitialized = true;
  } catch (err) {
    console.error('[PostHog] Initialization error:', err);
  }
};

/**
 * Generic event tracker
 * Naming convention: [object]_[verb_past], e.g. ride_requested, fare_viewed
 */
export const trackEvent = (eventName, properties = {}) => {
  if (!isInitialized) return;
  try {
    posthog.capture(eventName, {
      timestamp: new Date().toISOString(),
      platform: window.Capacitor?.getPlatform() || 'web',
      ...properties
    });
  } catch (e) {
    console.warn('[PostHog] Event track failed:', e);
  }
};

/**
 * Identify authenticated student or driver
 */
export const identifyUser = (userId, userTraits = {}) => {
  if (!isInitialized || !userId) return;
  try {
    posthog.identify(userId, {
      ...userTraits
    });
  } catch (e) {
    console.warn('[PostHog] Identify failed:', e);
  }
};

/**
 * Reset user session on logout
 */
export const resetUser = () => {
  if (!isInitialized) return;
  try {
    posthog.reset();
  } catch (e) {
    console.warn('[PostHog] Reset failed:', e);
  }
};

// ── Specific Ride Booking Funnel Trackers ─────────────────────────────

export const trackRideSearch = (pickupName, dropoffName) => {
  trackEvent('route_searched', {
    pickup: pickupName,
    dropoff: dropoffName
  });
};

export const trackFareViewed = ({ pickup, dropoff, sharedFare, privateFare, isFixed, routeName }) => {
  trackEvent('fare_viewed', {
    pickup,
    dropoff,
    shared_fare: sharedFare,
    private_fare: privateFare,
    is_fixed_route: isFixed,
    route_name: routeName
  });
};

export const trackRideRequested = ({ rideId, pickup, dropoff, fare, mode }) => {
  trackEvent('ride_requested', {
    ride_id: rideId,
    pickup,
    dropoff,
    fare,
    ride_mode: mode
  });
};

export const trackRideAccepted = ({ rideId, driverId, driverName }) => {
  trackEvent('ride_accepted', {
    ride_id: rideId,
    driver_id: driverId,
    driver_name: driverName
  });
};

export const trackRideStarted = ({ rideId }) => {
  trackEvent('ride_started', {
    ride_id: rideId
  });
};

export const trackRideCompleted = ({ rideId, fare, mode }) => {
  trackEvent('ride_completed', {
    ride_id: rideId,
    fare,
    ride_mode: mode
  });
};

export const trackRideCancelled = ({ rideId, reason, cancelledBy }) => {
  trackEvent('ride_cancelled', {
    ride_id: rideId,
    reason,
    cancelled_by: cancelledBy
  });
};

export default posthog;
