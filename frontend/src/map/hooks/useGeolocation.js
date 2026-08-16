import { useState, useEffect, useCallback } from 'react';
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
          setLocation({ lat: -14.294896006738625, lng: 28.55979849713035, accuracy: null });
          setError(`Location unavailable. Using default location (MU).`);
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
          if (position) {
            onUpdate({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
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
          onUpdate({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          setError(error.message);
        },
        defaultOptions
      );
      setWatchId(id);
    }
  }, [onUpdate, optionsString]);

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
