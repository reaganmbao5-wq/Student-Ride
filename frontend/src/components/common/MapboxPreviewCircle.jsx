import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiamFleSIsImEiOiJjbXNocmV5ZXAwM3JlMnhzZ29raTB3eGc5In0.riXZQNEurCaETWjZt02R6A';

export const MapboxPreviewCircle = ({ styleMode = 'day', isAuto = false }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initialStyle = styleMode === 'night' 
      ? 'mapbox://styles/mapbox/dark-v11' 
      : 'mapbox://styles/mapbox/streets-v12';

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: initialStyle,
        center: [28.549662, -14.294646], // Mulungushi University Main Campus
        zoom: 14.2,
        pitch: 45,
        interactive: false,
        attributionControl: false
      });

      mapInstanceRef.current = map;

      // Handle Auto mode transitioning every 3.5 seconds
      let interval = null;
      if (isAuto) {
        let isCurrentNight = false;
        interval = setInterval(() => {
          if (!mapInstanceRef.current) return;
          isCurrentNight = !isCurrentNight;
          mapInstanceRef.current.setStyle(
            isCurrentNight 
              ? 'mapbox://styles/mapbox/dark-v11' 
              : 'mapbox://styles/mapbox/streets-v12'
          );
        }, 3500);
      }

      return () => {
        if (interval) clearInterval(interval);
        try {
          map.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      };
    } catch (err) {
      console.warn("MapboxPreviewCircle init failed:", err);
    }
  }, [styleMode, isAuto]);

  return (
    <div className="w-full h-full rounded-full overflow-hidden pointer-events-none relative">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
