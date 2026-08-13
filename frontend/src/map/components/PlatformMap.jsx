import React, { useEffect, useState, useRef, useMemo } from 'react';

import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';

import '../styles/map.css';

import { POILayer } from '../layers/POILayer';

import { getAutoMapStyle, isNightTheme } from '../styles/MapboxStyles';

import VehicleEngine from '../vehicle/VehicleEngine';

import { CAMERA_MODES, CAMERA_CONFIG } from '../camera/CameraConfig';

import { RouteEngine } from '../route/RouteEngine';

import { MarkerLayer } from '../layers/MarkerLayer';

import { Sun, Moon, Clock } from 'lucide-react';



// Configure Mapbox Access Token

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiamFleSIsImEiOiJjbXNocmV5ZXAwM3JlMnhzZ29raTB3eGc5In0.riXZQNEurCaETWjZt02R6A';



if (typeof window !== 'undefined') {

  try {

    const workerScript = "importScripts('https://api.mapbox.com/mapbox-gl-js/v3.28.1/mapbox-gl-csp-worker.js');";

    const blob = new Blob([workerScript], { type: 'application/javascript' });

    const blobUrl = URL.createObjectURL(blob);



    class ClassicMapboxWorker extends window.Worker {

      constructor(url, options) {

        super(blobUrl, { ...options, type: 'classic' });

      }

    }

    mapboxgl.workerClass = ClassicMapboxWorker;

  } catch (err) {

    console.warn('Mapbox ClassicMapboxWorker init error:', err);

  }

}



export const PlatformMap = ({

  center = { lat: -14.294896, lng: 28.559798 }, // Default Mulungushi University

  zoom = 15,

  bounds = null,

  onCenterChanged,

  onDragStart,

  onDragEnd,

  markers = [],

  drivers = [],

  routes = [],

  routeGeometry = null,

  interactive = true,

  className = '',

  cameraMode = CAMERA_MODES.FREE,

  driverLocation = null,

  routeBounds = null,

  selectionLocation = null,

  bottomPadding = null,

  rideStatus = null,

  onRouteAnimationChange = null,

}) => {

  const mapContainerRef = useRef(null);

  const mapRef = useRef(null);

  const targetCenterRef = useRef(center);

  const currentStyleRef = useRef('');

  const isUserInteractingRef = useRef(false);

  const isUserDraggingRef = useRef(false);
  const hasManuallyInteractedRef = useRef(false);
  const lastFittedBoundsRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);

  // Map Appearance Mode: 'auto' (default), 'light', 'dark'
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('map_theme_mode') || 'auto');

  useEffect(() => {
    const handleThemeEvent = (e) => {
      if (e?.detail) {
        setThemeMode(e.detail);
      } else {
        setThemeMode(localStorage.getItem('map_theme_mode') || 'auto');
      }
    };
    window.addEventListener('map-theme-change', handleThemeEvent);
    window.addEventListener('storage', handleThemeEvent);
    return () => {
      window.removeEventListener('map-theme-change', handleThemeEvent);
      window.removeEventListener('storage', handleThemeEvent);
    };
  }, []);

  useEffect(() => {
    hasManuallyInteractedRef.current = false;
    lastFittedBoundsRef.current = null;
  }, [cameraMode]);



  // Stable Style Calculation

  const activeStyle = useMemo(() => {

    return getAutoMapStyle(themeMode === 'auto' ? null : themeMode);

  }, [themeMode]);



  const isNight = useMemo(() => {

    return isNightTheme(themeMode === 'auto' ? null : themeMode);

  }, [themeMode]);



  // Initialize Mapbox Map once

  useEffect(() => {

    if (!mapContainerRef.current) return;



    const initialCenter = (bounds && bounds.length >= 2)
      ? [(bounds[0][1] + bounds[1][1]) / 2, (bounds[0][0] + bounds[1][0]) / 2]
      : (center ? [center.lng, center.lat] : [28.559798, -14.294896]);

    currentStyleRef.current = activeStyle;



    const map = new mapboxgl.Map({

      container: mapContainerRef.current,

      style: activeStyle,

      center: initialCenter,

      zoom: zoom,

      pitch: 0,

      bearing: 0,

      interactive: interactive,

      attributionControl: false,

      pixelRatio: window.devicePixelRatio || 1

    });



    map.on('load', () => {

      setMapLoaded(true);

      map.resize();

    });



    map.on('dragstart', () => {

      isUserDraggingRef.current = true;

      isUserInteractingRef.current = true;
      hasManuallyInteractedRef.current = true;

      if (onDragStart) onDragStart();

    });



    map.on('zoomstart', () => {

      isUserInteractingRef.current = true;
      hasManuallyInteractedRef.current = true;

    });



    map.on('dragend', () => {

      if (onDragEnd) onDragEnd();

    });



    map.on('zoomend', () => {

      setTimeout(() => {

        isUserInteractingRef.current = false;

      }, 500);

    });



    // ONLY notify parent on moveend IF the user was manually dragging!

    // Preserves updated mapCenter while preventing circular flyTo loops (React Error #185)

    map.on('moveend', () => {

      if (isUserDraggingRef.current) {

        isUserDraggingRef.current = false;

        setTimeout(() => {

          isUserInteractingRef.current = false;

        }, 500);

        if (onCenterChanged) {

          const c = map.getCenter();

          onCenterChanged({ lat: c.lat, lng: c.lng });

        }

      }

    });



    // Re-anchor canvas size safely without forcing jumpTo stale center
    map.on('resize', () => {
      // Mapbox automatically resizes viewport without jumping camera
    });



    mapRef.current = map;

    window.map = map;



    const resizeObserver = new ResizeObserver(() => {

      if (mapRef.current) mapRef.current.resize();

    });

    resizeObserver.observe(mapContainerRef.current);



    return () => {

      resizeObserver.disconnect();

      map.remove();

      mapRef.current = null;

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);



  // Handle Dynamic Theme Switching safely

  useEffect(() => {

    if (mapRef.current && mapLoaded && currentStyleRef.current !== activeStyle) {

      currentStyleRef.current = activeStyle;

      mapRef.current.setStyle(activeStyle);

      mapRef.current.once('style.load', () => {

        if (mapRef.current) mapRef.current.resize();

      });

    }

  }, [activeStyle, mapLoaded]);



  const lastFlownCenterRef = useRef(null);

  // Handle Smooth Center / Bounds / Driver Follow with zero twitching
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    mapRef.current.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });

    const targetArray = routeBounds || bounds;
    const hasMultipleBounds = Array.isArray(targetArray) && targetArray.length >= 2;

    if (hasMultipleBounds) {
      const lats = [];
      const lngs = [];
      targetArray.forEach(pt => {
        if (Array.isArray(pt) && pt.length >= 2) {
          const lat = Number(pt[0]);
          const lng = Number(pt[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            lats.push(lat);
            lngs.push(lng);
          }
        } else if (pt && typeof pt === 'object') {
          const lat = Number(pt.lat ?? pt.latitude);
          const lng = Number(pt.lng ?? pt.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            lats.push(lat);
            lngs.push(lng);
          }
        }
      });

      if (lats.length >= 2 && lngs.length >= 2) {
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const containerRect = mapContainerRef.current?.getBoundingClientRect();
        const isMiniMap = !interactive || (containerRect && containerRect.height < 250);

        const calcTop = isMiniMap ? 14 : 75;
        const calcBottom = isMiniMap ? 14 : ((typeof bottomPadding === 'number' && bottomPadding > 0)
          ? Math.min(bottomPadding, 180)
          : 150);
        const calcSide = isMiniMap ? 14 : 25;

        // Policy B: Adaptive distance-scaled zoom tightening during driver approach (< 400m)
        let dynamicMaxZoom = 18.0;
        if (cameraMode === CAMERA_MODES.FOLLOW_DRIVER && targetArray.length === 2) {
          const pt1 = targetArray[0];
          const pt2 = targetArray[1];
          const lat1 = Number(pt1?.lat ?? pt1?.[0] ?? pt1?.latitude);
          const lon1 = Number(pt1?.lng ?? pt1?.[1] ?? pt1?.longitude);
          const lat2 = Number(pt2?.lat ?? pt2?.[0] ?? pt2?.latitude);
          const lon2 = Number(pt2?.lng ?? pt2?.[1] ?? pt2?.longitude);
          if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
            const dLat = (lat2 - lat1) * (Math.PI / 180);
            const dLon = (lon2 - lon1) * (Math.PI / 180);
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const distMeters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            if (distMeters < 400) {
              // Smooth tightening: 400m -> 17.5, 200m -> 18.5, 50m -> 19.5
              dynamicMaxZoom = Math.min(19.5, Math.max(17.5, 19.5 - (distMeters / 400) * 2.0));
            }
          }
        }

        // Skip re-fitting if coordinates & padding are virtually identical (prevents twitching during polling)
        const prev = lastFittedBoundsRef.current;
        const isSameBounds = prev &&
          Math.abs(prev.minLat - minLat) < 0.00015 &&
          Math.abs(prev.maxLat - maxLat) < 0.00015 &&
          Math.abs(prev.minLng - minLng) < 0.00015 &&
          Math.abs(prev.maxLng - maxLng) < 0.00015 &&
          Math.abs(prev.calcBottom - calcBottom) < 10 &&
          Math.abs((prev.dynamicMaxZoom || 18.0) - dynamicMaxZoom) < 0.2 &&
          prev.calcTop === calcTop;

        if (isSameBounds) {
          return;
        }

        lastFittedBoundsRef.current = { minLat, maxLat, minLng, maxLng, calcTop, calcBottom, dynamicMaxZoom };

        try {
          mapRef.current.fitBounds([
            [minLng, minLat],
            [maxLng, maxLat]
          ], {
            padding: {
              top: calcTop,
              bottom: calcBottom,
              left: calcSide,
              right: calcSide
            },
            maxZoom: dynamicMaxZoom,
            duration: 800,
            essential: true
          });
        } catch (e) {}
        return;
      }
    }

    if (cameraMode === CAMERA_MODES.FOLLOW_DRIVER && driverLocation) {
      const lat = driverLocation.lat ?? driverLocation.latitude;
      const lng = driverLocation.lng ?? driverLocation.longitude;

      if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
        mapRef.current.easeTo({
          center: [lng, lat],
          zoom: 18,
          duration: 600,
          essential: true
        });
      }
    } else if (center && center.lat !== undefined && center.lng !== undefined) {
      const defaultStepZoom = cameraMode === CAMERA_MODES.PICKUP_SELECTION
        ? CAMERA_CONFIG.ZOOM.PICKUP_SELECTION
        : cameraMode === CAMERA_MODES.DESTINATION_SELECTION
        ? CAMERA_CONFIG.ZOOM.DESTINATION_SELECTION
        : (typeof mapRef.current.getZoom === 'function' ? mapRef.current.getZoom() : zoom);

      const targetZoom = (hasManuallyInteractedRef.current && typeof mapRef.current.getZoom === 'function')
        ? mapRef.current.getZoom()
        : defaultStepZoom;

      const prevCenter = lastFlownCenterRef.current;
      const centerChanged = !prevCenter ||
        Math.abs(prevCenter.lat - center.lat) > 0.00005 ||
        Math.abs(prevCenter.lng - center.lng) > 0.00005 ||
        Math.abs(prevCenter.zoom - targetZoom) > 0.1;

      if (centerChanged) {
        lastFlownCenterRef.current = { lat: center.lat, lng: center.lng, zoom: targetZoom };
        mapRef.current.flyTo({
          center: [center.lng, center.lat],
          zoom: targetZoom,
          duration: 1200,
          essential: true
        });
      }
    }
  }, [center, zoom, bounds, routeBounds, cameraMode, driverLocation, mapLoaded, bottomPadding]);



  return (

    <div className={`relative z-0 w-full h-full min-h-[300px] ${className}`} style={{ isolation: 'isolate' }}>

      

      {/* MAPBOX CONTAINER - Identical to Student-Ride container styling */}

      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 bg-[#e4e2dc] dark:bg-[#191a1a] transition-colors" />







      {/* 659 POIS CATEGORY LAYER */}

      {mapLoaded && mapRef.current && (

        <POILayer map={mapRef.current} isNight={isNight} />

      )}







      {/* STATIC PICKUP / DROPOFF / USER MARKERS */}

      {mapLoaded && mapRef.current && markers && markers.length > 0 && (

        <MarkerLayer map={mapRef.current} markers={markers} />

      )}



      {/* VEHICLE ENGINE */}

      {mapLoaded && mapRef.current && drivers.length > 0 && (

        <VehicleEngine map={mapRef.current} drivers={drivers} />

      )}



      {/* ROUTE ENGINE */}

      {mapLoaded && mapRef.current && (

        routes && routes.length > 0 ? (

          routes.map((route, idx) => (

             <RouteEngine 

               key={`route-${route.rideId || idx}`}

               id={`route-${route.rideId || idx}`}

               map={mapRef.current}

               geometry={route.geometry}

               color={route.color}

               driverLocation={driverLocation}

               status={route.status || rideStatus}

               onAnimationChange={onRouteAnimationChange}

             />

          ))

        ) : (

          routeGeometry && routeGeometry.length > 0 && (

            <RouteEngine 

              id="main-route"

              map={mapRef.current}

              geometry={routeGeometry}

              driverLocation={driverLocation}

              status={rideStatus}

              onAnimationChange={onRouteAnimationChange}

            />

          )

        )

      )}



    </div>

  );

};



export default PlatformMap;

