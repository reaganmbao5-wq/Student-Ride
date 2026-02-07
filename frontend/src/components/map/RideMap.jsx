import React, { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const RideMap = ({
  center = { lat: -14.42, lng: 28.45 }, // Kabwe
  zoom = 13,
  pickup = null,
  dropoff = null,
  driverLocation = null,
  userLocation = null,
  interactive = true,
  className = ""
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [isMapLoaded, setIsMapLoaded] = React.useState(false);

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [center.lng, center.lat],
      zoom: zoom,
      interactive: interactive
    });

    map.current.on('load', () => {
      setIsMapLoaded(true);
    });

    if (interactive) {
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    }
  }, []);

  // Update markers
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add user location marker
    if (userLocation) {
      const el = document.createElement('div');
      el.className = 'marker-user';
      el.style.cssText = 'width:16px;height:16px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(59,130,246,0.2);';
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
    }

    // Add pickup marker
    if (pickup) {
      const el = document.createElement('div');
      el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#D4AF37" stroke="white" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
      el.style.cssText = 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));';
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
    }

    // Add dropoff marker
    if (dropoff) {
      const el = document.createElement('div');
      el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#10B981" stroke="white" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
      el.style.cssText = 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));';
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
    }

    // Add driver marker
    if (driverLocation) {
      const el = document.createElement('div');
      el.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="#D4AF37" stroke="white" stroke-width="2"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>`;
      el.style.cssText = 'filter:drop-shadow(0 4px 12px rgba(212,175,55,0.5)); transition: transform 0.5s linear;';
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current);
      markersRef.current.push(marker);

      // Only fly to driver if it's a significant change or first time
      if (!pickup && !dropoff) {
        map.current.flyTo({ center: [driverLocation.lng, driverLocation.lat], duration: 1000 });
      }
    }

    // Fit bounds if multiple points
    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;
    if (pickup) { bounds.extend([pickup.lng, pickup.lat]); hasPoints = true; }
    if (dropoff) { bounds.extend([dropoff.lng, dropoff.lat]); hasPoints = true; }
    if (driverLocation) { bounds.extend([driverLocation.lng, driverLocation.lat]); hasPoints = true; }

    if (hasPoints) {
      map.current.fitBounds(bounds, { padding: 50, duration: 1000 });
    }

    // Draw route line
    if (pickup && dropoff) {
      if (map.current.getSource('route')) {
        map.current.removeLayer('route');
        map.current.removeSource('route');
      }

      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]]
          }
        }
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#D4AF37', 'line-width': 4, 'line-opacity': 0.8 }
      });
    }
  }, [pickup, dropoff, driverLocation, userLocation, isMapLoaded]);

  return <div ref={mapContainer} className={`w-full h-full rounded-2xl ${className}`} />;
};

export const LocationPickerMap = ({
  center = { lat: -14.42, lng: 28.45 },
  zoom = 14,
  selectedLocation = null,
  onLocationSelect,
  className = ""
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [isMapLoaded, setIsMapLoaded] = React.useState(false);
  const onLocationSelectRef = useRef(onLocationSelect);

  // Keep ref updated with latest callback
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [center.lng, center.lat],
      zoom: zoom
    });

    map.current.on('load', () => {
      setIsMapLoaded(true);
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('click', (e) => {
      if (onLocationSelectRef.current) {
        onLocationSelectRef.current({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng
        });
      }
    });
  }, []); // Only run on mount

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (marker.current) {
      marker.current.remove();
    }

    if (selectedLocation) {
      const el = document.createElement('div');
      el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#D4AF37" stroke="white" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
      el.style.cssText = 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));';
      marker.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([selectedLocation.lng, selectedLocation.lat])
        .addTo(map.current);

      map.current.flyTo({ center: [selectedLocation.lng, selectedLocation.lat], zoom: 15 });
    }
  }, [selectedLocation, isMapLoaded]);

  return (
    <div className={`relative w-full h-full rounded-2xl ${className}`}>
      <div ref={mapContainer} className="w-full h-full rounded-2xl" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-none">
        <p className="text-xs text-white">Tap anywhere to select</p>
      </div>
    </div>
  );
};

export default RideMap;
