import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { lerp, easeLinear } from './VehicleInterpolator';
import { lerpHeading } from './HeadingSmoother';

const DEFAULT_ANIMATION_DURATION_MS = 1000;

/**
 * VehicleRenderer.jsx
 * Native Mapbox GL JS 3D Vehicle Renderer with 60/120 FPS Gliding Engine.
 * Smoothly interpolates vehicle position and heading on Mapbox map without jumping.
 */
export const VehicleRenderer = ({ map, driver }) => {
  const markerRef = useRef(null);
  const animFrameRef = useRef(null);
  const driverId = driver?.id || driver?._id || driver?.user_id || 'active-driver';
  
  const animStateRef = useRef({
    currentLat: null,
    currentLng: null,
    currentHeading: 0,
    targetLat: null,
    targetLng: null,
    targetHeading: 0,
    startLat: null,
    startLng: null,
    startHeading: 0,
    startTime: null,
    lastUpdateTime: null,
    duration: DEFAULT_ANIMATION_DURATION_MS,
    isAnimating: false
  });

  // 1. Lifecycle: Create and destroy Mapbox Marker ONCE per driver identity (Never destroy on coordinate update!)
  useEffect(() => {
    if (!map) return;

    const lat = Number(driver?.lat ?? driver?.latitude);
    const lng = Number(driver?.lng ?? driver?.longitude);
    const heading = Number(driver?.heading || 0);

    const initLat = !isNaN(lat) ? lat : -14.4087;
    const initLng = !isNaN(lng) ? lng : 28.2849;

    const animState = animStateRef.current;
    animState.currentLat = initLat;
    animState.currentLng = initLng;
    animState.currentHeading = heading;
    animState.targetLat = initLat;
    animState.targetLng = initLng;
    animState.targetHeading = heading;
    animState.lastUpdateTime = performance.now();

    // Create custom vehicle element
    const el = document.createElement('div');
    el.className = 'custom-mapbox-vehicle-marker';
    el.style.width = '32px';
    el.style.height = '60px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.willChange = 'transform';

    const img = document.createElement('img');
    img.src = '/car_top.png';
    img.alt = 'Driver Car';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))';
    img.style.transform = 'rotate(180deg)';

    el.appendChild(img);

    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
      rotationAlignment: 'map'
    })
      .setLngLat([initLng, initLat])
      .setRotation(heading)
      .addTo(map);

    markerRef.current = marker;

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      marker.remove();
      markerRef.current = null;
    };
  }, [map, driverId]);

  // 2. High-performance 60/120 FPS requestAnimationFrame gliding loop across incoming GPS coordinates
  const driverLat = driver?.lat ?? driver?.latitude;
  const driverLng = driver?.lng ?? driver?.longitude;
  const driverHeading = driver?.heading;

  useEffect(() => {
    if (!markerRef.current || driverLat === undefined || driverLng === undefined) return;

    const newLat = Number(driverLat);
    const newLng = Number(driverLng);
    const newHeading = Number(driverHeading !== undefined && driverHeading !== null ? driverHeading : animStateRef.current.currentHeading);

    if (isNaN(newLat) || isNaN(newLng)) return;

    const animState = animStateRef.current;

    // Check if target position or heading changed noticeably
    const latDiff = Math.abs(animState.targetLat - newLat);
    const lngDiff = Math.abs(animState.targetLng - newLng);
    const headingDiff = Math.abs(animState.targetHeading - newHeading);

    if (latDiff < 0.000001 && lngDiff < 0.000001 && headingDiff < 0.5 && animState.currentLat !== null) {
      return;
    }

    const nowTime = performance.now();
    if (animState.lastUpdateTime) {
      const timeSinceLastUpdate = nowTime - animState.lastUpdateTime;
      // Dynamically adjust animation duration based on update frequency (capped smoothly between 800ms and 3000ms)
      animState.duration = Math.max(800, Math.min(timeSinceLastUpdate, 3000));
    }
    animState.lastUpdateTime = nowTime;

    animState.startLat = animState.currentLat ?? newLat;
    animState.startLng = animState.currentLng ?? newLng;
    animState.startHeading = animState.currentHeading ?? newHeading;

    animState.targetLat = newLat;
    animState.targetLng = newLng;
    animState.targetHeading = newHeading;
    animState.startTime = performance.now();

    const animate = (now) => {
      if (!animState.startTime) animState.startTime = now;
      let progress = (now - animState.startTime) / animState.duration;

      if (progress >= 1) {
        progress = 1;
        animState.isAnimating = false;
      }

      // Linear easing is critical for continuous gliding between coordinate streams,
      // as easeInOut will cause the vehicle to slow down and stop at each coordinate
      const easedProgress = easeLinear(progress);

      animState.currentLat = lerp(animState.startLat, animState.targetLat, easedProgress);
      animState.currentLng = lerp(animState.startLng, animState.targetLng, easedProgress);
      animState.currentHeading = animState.targetHeading;

      if (markerRef.current) {
        markerRef.current.setLngLat([animState.currentLng, animState.currentLat]);
        markerRef.current.setRotation(animState.targetHeading);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animState.isAnimating = true;
    animFrameRef.current = requestAnimationFrame(animate);

  }, [driverLat, driverLng, driverHeading]);

  return null;
};

export default React.memo(VehicleRenderer);
