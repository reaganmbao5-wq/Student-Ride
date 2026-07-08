import { useState, useEffect } from 'react';

export const useNearbyDrivers = (api, location) => {
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!api || !location || !location.lat || !location.lng) return;

    const fetchDrivers = async () => {
      try {
        const response = await api.get('/drivers/nearby', {
          params: {
            latitude: location.lat,
            longitude: location.lng,
            radius_km: 10.0
          }
        });
        // Filter out drivers to ensure they have an id, latitude, and longitude
        const validDrivers = (response.data || []).filter(d => d.id && d.latitude && d.longitude);
        setDrivers(validDrivers);
      } catch (err) {
        console.error('Failed to fetch nearby drivers:', err);
        setError(err);
      }
    };

    fetchDrivers();
    const interval = setInterval(fetchDrivers, 3000);
    return () => clearInterval(interval);
  }, [api, location?.lat, location?.lng]);

  return { drivers };
};
