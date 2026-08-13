import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { lerp, easeInOutSine } from './VehicleInterpolator';
import { lerpHeading } from './HeadingSmoother';

const ANIMATION_DURATION_MS = 800;

/**
 * VehicleRenderer.jsx
 * Native Mapbox GL JS 3D Vehicle Renderer with 60/120 FPS Gliding Engine.
 * Smoothly interpolates vehicle position and heading on Mapbox map without snapping.
 */
export const VehicleRenderer = ({ map, driver }) => {
  const markerRef = useRef(null);
  const animFrameRef = useRef(null);
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
    isAnimating: false
  });

  useEffect(() => {
    if (!map || !driver || markerRef.current) return;

    const lat = Number(driver.lat ?? driver.latitude);
    const lng = Number(driver.lng ?? driver.longitude);
    const heading = Number(driver.heading || 0);

    if (isNaN(lat) || isNaN(lng)) return;

    const animState = animStateRef.current;
    animState.currentLat = lat;
    animState.currentLng = lng;
    animState.currentHeading = heading;
    animState.targetLat = lat;
    animState.targetLng = lng;
    animState.targetHeading = heading;

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
      .setLngLat([lng, lat])
      .setRotation(heading)
      .addTo(map);

    markerRef.current = marker;

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      marker.remove();
      markerRef.current = null;
    };
  }, [map, driver]);

  // High-performance 60/120 FPS requestAnimationFrame gliding loop
  useEffect(() => {
    if (!markerRef.current || !driver) return;

    const newLat = Number(driver.lat ?? driver.latitude);
    const newLng = Number(driver.lng ?? driver.longitude);
    const newHeading = Number(driver.heading !== undefined && driver.heading !== null ? driver.heading : animStateRef.current.currentHeading);

    if (isNaN(newLat) || isNaN(newLng)) return;

    const animState = animStateRef.current;

    // Check if target position or heading changed noticeably
    const latDiff = Math.abs(animState.targetLat - newLat);
    const lngDiff = Math.abs(animState.targetLng - newLng);
    const headingDiff = Math.abs(animState.targetHeading - newHeading);

    if (latDiff < 0.000001 && lngDiff < 0.000001 && headingDiff < 0.5 && animState.currentLat !== null) {
      return;
    }

    animState.startLat = animState.currentLat ?? newLat;
    animState.startLng = animState.currentLng ?? newLng;
    animState.startHeading = animState.currentHeading ?? newHeading;

    animState.targetLat = newLat;
    animState.targetLng = newLng;
    animState.targetHeading = newHeading;
    animState.startTime = performance.now();

    const animate = (now) => {
      if (!animState.startTime) animState.startTime = now;
      let progress = (now - animState.startTime) / ANIMATION_DURATION_MS;

      if (progress >= 1) {
        progress = 1;
        animState.isAnimating = false;
      }

      const easedProgress = easeInOutSine(progress);

      animState.currentLat = lerp(animState.startLat, animState.targetLat, easedProgress);
      animState.currentLng = lerp(animState.startLng, animState.targetLng, easedProgress);
      animState.currentHeading = lerpHeading(animState.startHeading, animState.targetHeading, easedProgress);

      if (markerRef.current) {
        markerRef.current.setLngLat([animState.currentLng, animState.currentLat]);
        markerRef.current.setRotation(animState.currentHeading);
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

  }, [driver]);

  return null;
};

export default React.memo(VehicleRenderer);

