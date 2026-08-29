import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { PermissionsService } from '../../services/PermissionsService';

export const useGeolocation = (options = {}) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // use stringified options to prevent infinite render loops if options object reference changes
  const optionsString = JSON.stringify(options);

  const getCurrentPosition = useCallback(async () => {
    // Check if user disabled location in profile settings
    const isLocationEnabled = localStorage.getItem('mulu_location_enabled') !== 'false';
    if (!isLocationEnabled) {
      setLocation({ lat: -14.294896006738625, lng: 28.55979849713035, accuracy: null });
      setError('Location services disabled in profile. Using default campus location.');
      setLoading(false);
      return;
    }

    console.log('GEOLOCATION_STARTED');
    setLoading(true);
    
    const parsedOptions = JSON.parse(optionsString);
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...parsedOptions
    };

    if (Capacitor.isNativePlatform()) {
      try {
        const hasPermission = await PermissionsService.requestLocationPermission();
        if (!hasPermission) {
          setError('Location permission denied');
          setLocation({ lat: -14.294896006738625, lng: 28.55979849713035, accuracy: null });
          setLoading(false);
          return;
        }

        const position = await Geolocation.getCurrentPosition(defaultOptions);
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setError(null);
      } catch (e) {
        // Fallback to MU when geolocation fails
        setLocation({ lat: -14.294896006738625, lng: 28.55979849713035, accuracy: null });
        setError(`Location unavailable. Using default location (MU).`);
      }
      setLoading(false);
    } else {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser');
        setLocation({ lat: -14.294896006738625, lng: 28.55979849713035, accuracy: null });
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          setError(null);
          setLoading(false);
        },
        (error) => {
          console.warn('[useGeolocation] Position error:', error.code, error.message);
          setLocation({ lat: -14.294896006738625, lng: 28.55979849713035, accuracy: null });
          setError(error.code === 1 ? 'PERMISSION_DENIED' : (error.message || 'Location unavailable'));
          setLoading(false);
        },
        defaultOptions
      );
    }
  }, [optionsString]);

  useEffect(() => {
    getCurrentPosition();
    const handleSettingChange = () => {
      getCurrentPosition();
    };
    window.addEventListener('mulu-location-setting-changed', handleSettingChange);
    window.addEventListener('storage', handleSettingChange);
    return () => {
      window.removeEventListener('mulu-location-setting-changed', handleSettingChange);
      window.removeEventListener('storage', handleSettingChange);
    };
  }, [getCurrentPosition]);

  return { location, error, loading, refresh: getCurrentPosition };
};

export const useWatchPosition = (onUpdate, options = {}) => {
  const [watchId, setWatchId] = useState(null);
  const [error, setError] = useState(null);

  const optionsString = JSON.stringify(options);
  const lastPosRef = useRef(null);
  const lastHeadingRef = useRef(0);
  const compassHeadingRef = useRef(null);

  // Listen to physical device compass (instant orientation even when stationary or turning)
  useEffect(() => {
    const handleOrientation = (e) => {
      let deg = null;
      if (typeof e.webkitCompassHeading === 'number') {
        // iOS Safari true compass heading
        deg = e.webkitCompassHeading;
      } else if (typeof e.alpha === 'number') {
        // Android / Chrome: alpha is 0 to 360 counterclockwise from north
        deg = (360 - e.alpha) % 360;
      }
      if (deg !== null && !isNaN(deg)) {
        compassHeadingRef.current = deg;
      }
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  const processPosition = useCallback((coords) => {
    const lat = coords.latitude;
    const lng = coords.longitude;
    const speed = coords.speed ?? 0;
    const accuracy = coords.accuracy ?? null;
    
    let heading = coords.heading;
    
    // 1. If native GPS heading is valid (> 0 km/h)
    if (typeof heading === 'number' && !isNaN(heading) && heading !== 0) {
      lastHeadingRef.current = heading;
    } 
    // 2. Otherwise, if device physical compass is available, use exact orientation
    else if (typeof compassHeadingRef.current === 'number' && !isNaN(compassHeadingRef.current)) {
      heading = compassHeadingRef.current;
      lastHeadingRef.current = heading;
    }
    // 3. Fallback: calculate bearing from previous point if moved >= 0.8 meters
    else if (lastPosRef.current) {
      const prev = lastPosRef.current;
      const dLng = (lng - prev.lng) * (Math.PI / 180);
      const lat1Rad = prev.lat * (Math.PI / 180);
      const lat2Rad = lat * (Math.PI / 180);
      const y = Math.sin(dLng) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
      const brng = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
      
      const distMeters = Math.hypot(
        (lat - prev.lat) * 111139,
        (lng - prev.lng) * 111139 * Math.cos(lat1Rad)
      );
      
      if (distMeters >= 0.8) {
        heading = brng;
        lastHeadingRef.current = brng;
      } else {
        heading = lastHeadingRef.current;
      }
    } else {
      heading = lastHeadingRef.current;
    }

    lastPosRef.current = { lat, lng, time: Date.now() };

    onUpdate({
      lat,
      lng,
      heading: typeof heading === 'number' && !isNaN(heading) ? Math.round(heading * 10) / 10 : 0,
      speed: typeof speed === 'number' && !isNaN(speed) ? speed : 0,
      accuracy
    });
  }, [onUpdate]);

  const startWatching = useCallback(async () => {
    const isLocationEnabled = localStorage.getItem('mulu_location_enabled') !== 'false';
    if (!isLocationEnabled) {
      return;
    }

    const parsedOptions = JSON.parse(optionsString);
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...parsedOptions
    };

    if (Capacitor.isNativePlatform()) {
      try {
        const hasPermission = await PermissionsService.requestLocationPermission();
        if (!hasPermission) {
          setError('Location permission denied');
          return;
        }
        
        const id = await Geolocation.watchPosition(defaultOptions, (position, err) => {
          if (err) {
            setError(err.message || 'Error watching position');
            return;
          }
          if (position && position.coords) {
            processPosition(position.coords);
          }
        });
        setWatchId(id);
      } catch (e) {
        setError(e.message || 'Error starting watch');
      }
    } else {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported');
        return;
      }

      const id = navigator.geolocation.watchPosition(
        (position) => {
          if (position && position.coords) {
            processPosition(position.coords);
          }
        },
        (error) => {
          console.warn('[useWatchPosition] Watch error:', error.code, error.message);
          setError(error.code === 1 ? 'PERMISSION_DENIED' : (error.message || 'Error watching position'));
        },
        defaultOptions
      );
      setWatchId(id);
    }
  }, [optionsString, processPosition]);

  const stopWatching = useCallback(async () => {
    if (watchId !== null) {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: watchId });
      } else {
        navigator.geolocation.clearWatch(watchId);
      }
      setWatchId(null);
    }
  }, [watchId]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        if (Capacitor.isNativePlatform()) {
          Geolocation.clearWatch({ id: watchId }).catch(console.error);
        } else {
          navigator.geolocation.clearWatch(watchId);
        }
      }
    };
  }, [watchId]);

  return { startWatching, stopWatching, error, isWatching: watchId !== null };
};

export default useGeolocation;
