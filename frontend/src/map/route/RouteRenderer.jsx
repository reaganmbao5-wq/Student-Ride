import React, { useState, useEffect, useRef } from 'react';
import { Polyline } from 'react-leaflet';

/**
 * RouteRenderer.jsx
 * Professional polyline rendering component.
 * Renders the travelled path in a muted style, and the remaining path in a bright, prominent style.
 * Includes smooth animation for initial route drawing and high accuracy rendering.
 */
export const RouteRenderer = ({ travelledPath, remainingPath, status, onAnimationChange, color }) => {
  const normalizedStatus = status ? String(status).toLowerCase() : '';
  const isHeadingToPickup = ['accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived'].includes(normalizedStatus);
  
  // Style config
  const remainingColor = color || (isHeadingToPickup ? '#10B981' : '#3B82F6'); // Use provided color, else fallback
  const remainingWeight = 5;
  const remainingOpacity = 0.9;
  
  const travelledColor = '#4B5563'; // Darker gray for better visibility
  const travelledWeight = 5;
  const travelledOpacity = 0.8;

  const [animatedRemainingPath, setAnimatedRemainingPath] = useState([]);
  
  const routePhase = status === 'accepted' ? 'pickup' : 'dropoff';
  const destinationSignature = remainingPath && remainingPath.length > 0 
    ? `${remainingPath[remainingPath.length-1][0]},${remainingPath[remainingPath.length-1][1]}-${routePhase}`
    : '';

  const animatedDestinationRef = useRef('');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!remainingPath || remainingPath.length === 0) {
      setAnimatedRemainingPath([]);
      if (onAnimationChange) onAnimationChange(false);
      return;
    }

    // If we already have a path or destination animated, update instantly to avoid polyline flickering!
    if (animatedRemainingPath.length > 0 || animatedDestinationRef.current === destinationSignature) {
      animatedDestinationRef.current = destinationSignature;
      setAnimatedRemainingPath(remainingPath);
      if (onAnimationChange) onAnimationChange(false);
      return;
    }

    // New destination detected! Animate the drawing of the route.
    animatedDestinationRef.current = destinationSignature;
    setAnimatedRemainingPath([]); // Reset before initial draw
    if (onAnimationChange) onAnimationChange(true);
    
    let currentIndex = 0;
    const totalPoints = remainingPath.length;
    // Calculate speed: aim for ~3000ms total animation time for a very slow, dramatic draw
    const pointsPerFrame = Math.max(1, Math.ceil(totalPoints / 150)); 
    
    // Delay the start by 800ms to allow Leaflet's flyTo/fitBounds camera animation to finish
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        currentIndex += pointsPerFrame;
        if (currentIndex >= remainingPath.length) {
          clearInterval(interval);
          setAnimatedRemainingPath(remainingPath);
          if (onAnimationChange) onAnimationChange(false);
        } else {
          setAnimatedRemainingPath(remainingPath.slice(0, currentIndex + 1));
        }
      }, 20);
      
      // Store interval so we can clear it if unmounted
      intervalRef.current = interval;
    }, 800);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [remainingPath, destinationSignature, onAnimationChange]);

  return (
    <>
      {/* Travelled Path behind driver is completely erased in real-time */}

      {/* Remaining Path (ahead of driver - animated) */}
      {animatedRemainingPath && animatedRemainingPath.length > 1 && (
        <Polyline
          positions={animatedRemainingPath}
          pathOptions={{ 
            color: remainingColor, 
            weight: remainingWeight, 
            opacity: remainingOpacity, 
            lineCap: 'round', 
            lineJoin: 'round',
            smoothFactor: 0.1 // Higher accuracy rendering
          }}
        />
      )}
    </>
  );
};
