import React, { useEffect, useRef } from 'react';
import VehicleRenderer from './VehicleRenderer';
import { lerp, easeInOutSine } from './VehicleInterpolator';
import { calculateBearing, calculateDistanceMeters } from './BearingCalculator';
import { lerpHeading } from './HeadingSmoother';

/**
 * VehicleAnimator.jsx
 * The core engine for a single vehicle. 
 * Manages the requestAnimationFrame loop to smoothly interpolate between GPS points,
 * using React state to guarantee the marker updates.
 */
const ANIMATION_DURATION_MS = 1000;
const MIN_DISTANCE_METERS = 0.1;

const VehicleAnimator = ({ driver }) => {
  const [animatedPos, setAnimatedPos] = React.useState([driver.lat || driver.latitude, driver.lng || driver.longitude]);
  const [animatedRot, setAnimatedRot] = React.useState(driver.heading || 0);

  const stateRef = useRef({
    currentLat: driver.lat || driver.latitude,
    currentLng: driver.lng || driver.longitude,
    currentHeading: driver.heading || 0,
    targetLat: driver.lat || driver.latitude,
    targetLng: driver.lng || driver.longitude,
    targetHeading: driver.heading || 0,
    startTime: null,
    isAnimating: false,
  });

  const markerRef = useRef(null);
  const animationFrameRef = React.useRef();

  React.useEffect(() => {
    const state = stateRef.current;
    const newLat = driver.lat || driver.latitude;
    const newLng = driver.lng || driver.longitude;

    const distance = calculateDistanceMeters(state.currentLat, state.currentLng, newLat, newLng);
    
    if (distance < MIN_DISTANCE_METERS) {
      return;
    }

    const newHeading = calculateBearing(state.currentLat, state.currentLng, newLat, newLng);

    state.targetLat = newLat;
    state.targetLng = newLng;
    state.targetHeading = newHeading;
    state.startTime = performance.now();
    
    if (!state.isAnimating) {
      state.isAnimating = true;
      animate();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        state.isAnimating = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver.lat, driver.lng, driver.latitude, driver.longitude]);

  const animate = () => {
    const state = stateRef.current;
    const now = performance.now();
    let progress = (now - state.startTime) / ANIMATION_DURATION_MS;

    if (progress >= 1) {
      progress = 1;
      state.isAnimating = false;
    }

    const easedProgress = easeInOutSine(progress);

    state.currentLat = lerp(state.currentLat, state.targetLat, easedProgress);
    state.currentLng = lerp(state.currentLng, state.targetLng, easedProgress);
    state.currentHeading = lerpHeading(state.currentHeading, state.targetHeading, easedProgress);

    // Update React state for position (which react-leaflet tracks reliably)
    setAnimatedPos([state.currentLat, state.currentLng]);
    
    // Bypass React for rotation because react-leaflet v3+ ignores the custom rotationAngle prop on re-renders
    if (markerRef.current && markerRef.current.setRotationAngle) {
      markerRef.current.setRotationAngle(state.currentHeading);
    }

    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };

  return (
    <VehicleRenderer
      ref={markerRef}
      driver={driver}
      initialPosition={animatedPos}
      initialRotation={animatedRot}
    />
  );
};

export default React.memo(VehicleAnimator, (prevProps, nextProps) => {
  // or if status changes (busy vs online) so the icon updates.
  // We ignore lat/lng changes because our useEffect handles them without re-rendering!
  const prevStatus = prevProps.driver.current_ride_id ? 'busy' : 'online';
  const nextStatus = nextProps.driver.current_ride_id ? 'busy' : 'online';
  
  if (prevStatus !== nextStatus) return false; // Re-render for icon change
  
  const prevLat = prevProps.driver.lat || prevProps.driver.latitude;
  const nextLat = nextProps.driver.lat || nextProps.driver.latitude;
  const prevLng = prevProps.driver.lng || prevProps.driver.longitude;
  const nextLng = nextProps.driver.lng || nextProps.driver.longitude;

  if (prevLat !== nextLat || prevLng !== nextLng) {
    return false; // MUST re-render so useEffect gets new coordinates!
  }
  
  return true; 
});
