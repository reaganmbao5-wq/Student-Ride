import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, ArrowLeft, Loader2, Maximize2, Minimize2, ChevronDown } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { RideMap, LocationPickerMap } from '../components/map/RideMap';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { AddressSearch } from '../components/common/AddressSearch';
import { reverseGeocode } from '../utils/nominatim';

const RideRequestPage = () => {
  const navigate = useNavigate();
  const { api } = useAuth();
  const { location: userLocation, loading: geoLoading, error: geoError, refresh: refreshLocation } = useGeolocation();

  const [step, setStep] = useState('pickup'); // pickup, dropoff, confirm
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [fareEstimate, setFareEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [nearbyDrivers, setNearbyDrivers] = useState([]); // Phase 5: Nearby Drivers
  const [routeGeometry, setRouteGeometry] = useState(null);


  // Fetch admin-defined destinations
  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      const response = await api.get('/popular-destinations?active_only=true');
      setDestinations(response.data);
    } catch (error) {
      console.error('Error fetching destinations:', error);
    }
  };

  // Use current location as default pickup
  useEffect(() => {
    if (userLocation && !pickup) {
      setPickup({
        lat: userLocation.lat,
        lng: userLocation.lng,
        address: 'Current Location'
      });
      setPickupAddress('Current Location');
    }
  }, [userLocation, pickup]);

  // Handle map click for location selection
  const handleLocationSelect = async (location) => {
    // Reverse geocode to get a readable address
    let address = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;

    try {
      const data = await reverseGeocode(location.lat, location.lng);
      if (data && data.display_name) {
        address = data.display_name;
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }

    const newLocation = {
      lat: location.lat,
      lng: location.lng,
      address
    };

    if (step === 'pickup') {
      setPickup(newLocation);
      setPickupAddress(address);
    } else if (step === 'dropoff') {
      setDropoff(newLocation);
      setDropoffAddress(address);
      setSelectedDestination(null);
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate fare estimate and route when both locations are set
  const calculateFare = useCallback(async () => {
    if (!pickup || !dropoff) return;

    setLoading(true);
    try {
      // 1. Get Route from OSRM
      let routeDistance = 0;
      let routeDuration = 0;
      let geometry = null;

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          routeDistance = route.distance / 1000; // Meters to KM
          routeDuration = Math.round(route.duration / 60); // Seconds to Minutes
          geometry = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // GeoJSON [lng, lat] to Leaflet [lat, lng]
        }
      } catch (err) {
        console.error('OSRM fetch error:', err);
        // Fallback to Haversine if OSRM fails
      }

      // If OSRM failed or returned no route, use Haversine
      if (!routeDistance) {
        routeDistance = calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
        routeDuration = Math.round(routeDistance * 3); // Rough estimate: 3 min per km
      }

      setRouteGeometry(geometry);

      // If using admin-defined destination, use its estimated fare as base
      let estimatedFare = selectedDestination?.estimated_fare;

      if (!estimatedFare) {
        // Calculate dynamically if no predefined fare
        const response = await api.post('/rides/estimate-fare', {
          distance_km: routeDistance,
          duration_min: routeDuration
        });
        estimatedFare = response.data.estimated_fare;
      }

      setFareEstimate({
        estimated_fare: estimatedFare,
        distance: routeDistance,
        duration: routeDuration,
        is_predefined: !!selectedDestination?.estimated_fare
      });
    } catch (error) {
      console.error('Error calculating fare:', error);
      toast.error('Failed to calculate fare');
    } finally {
      setLoading(false);
    }
  }, [pickup, dropoff, api, selectedDestination]);

  useEffect(() => {
    if (pickup && dropoff) {
      calculateFare();
    }
  }, [pickup, dropoff, calculateFare]);

  const handleDestinationSelect = (destId) => {
    const dest = destinations.find(d => d.id === destId);
    if (dest) {
      setSelectedDestination(dest);
      setDropoff({
        lat: dest.latitude,
        lng: dest.longitude,
        address: dest.address
      });
      setDropoffAddress(dest.name);
    }
  };



  const handleNext = () => {
    if (step === 'pickup' && pickup) {
      setStep('dropoff');
    } else if (step === 'dropoff' && dropoff) {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'dropoff') {
      setStep('pickup');
    } else if (step === 'confirm') {
      setStep('dropoff');
    } else {
      navigate('/dashboard');
    }
  };

  const handleRequestRide = async () => {
    if (!pickup || !dropoff || !fareEstimate) return;

    setRequesting(true);
    try {
      const response = await api.post('/rides/request', {
        pickup_location: {
          lat: pickup.lat,
          lng: pickup.lng,
          address: pickup.address || pickupAddress
        },
        dropoff_location: {
          lat: dropoff.lat,
          lng: dropoff.lng,
          address: dropoff.address || dropoffAddress
        },
        estimated_fare: fareEstimate.estimated_fare,
        estimated_distance: fareEstimate.distance,
        estimated_duration: fareEstimate.duration
      });

      toast.success('Ride requested! Finding a driver...');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error requesting ride:', error);
      toast.error(error.response?.data?.detail || 'Failed to request ride');
    } finally {
      setRequesting(false);
    }
  };

  // Fullscreen map modal
  if (isMapFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0B0B0B]" data-testid="fullscreen-map">
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => setIsMapFullscreen(false)}
            className="p-3 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 hover:bg-black transition-colors"
            data-testid="exit-fullscreen-btn"
          >
            <Minimize2 className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute top-4 right-4 z-50 max-w-xs">
          <GlassCard className="p-3" hover={false}>
            <p className="text-white text-sm">Tap on map to select {step === 'pickup' ? 'pickup' : 'dropoff'} location</p>
          </GlassCard>
        </div>
        <LocationPickerMap
          center={pickup ? [pickup.lat, pickup.lng] : userLocation ? [userLocation.lat, userLocation.lng] : [-14.4087, 28.2849]}
          selectedLocation={step === 'pickup' ? pickup : dropoff}
          onLocationSelect={(loc) => {
            handleLocationSelect(loc);
            setIsMapFullscreen(false);
          }}
          className="h-full w-full"
        />
      </div>
    );
  }

  const renderStepContent = () => {
    switch (step) {
      case 'pickup':
        return (
          <>
            <div className="mb-4">
              <h2 className="font-heading text-xl font-semibold text-white mb-2">Set Pickup Location</h2>
              <p className="text-white/50 text-sm">Tap on the map or use your current location</p>
            </div>

            <div className="mb-4">
              <AddressSearch
                placeholder="Search for pickup location..."
                onLocationSelect={(loc) => {
                  setPickup(loc);
                  setPickupAddress(loc.address);
                }}
              />
            </div>

            <GoldButton
              variant="secondary"
              size="sm"
              className="w-full mb-4"
              onClick={() => {
                refreshLocation();
                if (userLocation) {
                  setPickup({
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    address: 'Current Location'
                  });
                  setPickupAddress('Current Location');
                }
              }}
              disabled={geoLoading}
              data-testid="use-location-btn"
            >
              <Navigation className="w-4 h-4 mr-2" />
              {geoLoading ? 'Getting location...' : 'Use Current Location'}
            </GoldButton>

            {/* Map Picker - Phase 6: Responsive Height */}
            <div className="relative h-[50vh] min-h-[300px] rounded-2xl overflow-hidden mb-4">
              <LocationPickerMap
                selectedLocation={pickup}
                onLocationSelect={handleLocationSelect}
                center={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined}
                nearbyDrivers={nearbyDrivers}
              />
            </div>
          </>
        );

      case 'dropoff':
        return (
          <>
            <div className="mb-4">
              <h2 className="font-heading text-xl font-semibold text-white mb-2">Set Destination</h2>
              <p className="text-white/50 text-sm">Choose a destination or enter address</p>
            </div>

            {/* Predefined Destinations Dropdown */}
            {destinations.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm text-white/60 mb-2">Quick Select Destination</label>
                <Select onValueChange={handleDestinationSelect}>
                  <SelectTrigger className="w-full bg-black/30 border-white/10 text-white h-12 rounded-xl">
                    <SelectValue placeholder="Choose a popular destination" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121212] border-white/10">
                    {destinations.map((dest) => (
                      <SelectItem
                        key={dest.id}
                        value={dest.id}
                        className="text-white hover:bg-white/10 focus:bg-white/10"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{dest.name}</span>
                          {/* Price is dynamic, so we don't show it here */}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="mb-4">
              <AddressSearch
                placeholder="Search for destination..."
                onLocationSelect={(loc) => {
                  setDropoff(loc);
                  setDropoffAddress(loc.address);
                  setSelectedDestination(null);
                }}
              />
            </div>

            <div className="relative h-[50vh] min-h-[300px] rounded-2xl overflow-hidden mb-4">
              <LocationPickerMap
                selectedLocation={dropoff}
                onLocationSelect={handleLocationSelect}
                center={pickup ? { lat: pickup.lat, lng: pickup.lng } : undefined}
              />
            </div>
          </>
        );

      case 'confirm':
        return (
          <>
            <div className="mb-4">
              <h2 className="font-heading text-xl font-semibold text-white mb-2">Confirm Your Ride</h2>
              <p className="text-white/50 text-sm">Review your trip details</p>
            </div>

            {/* Map Preview */}
            <div className="relative h-48 rounded-2xl overflow-hidden mb-4">
              <RideMap
                pickup={pickup}
                dropoff={dropoff}
                routeGeometry={routeGeometry}
                interactive={false}
                className="h-full w-full"
              />
            </div>

            {/* Trip Details */}
            <GlassCard className="p-4 mb-4" hover={false}>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-gold mt-1.5" />
                  <div className="flex-1">
                    <p className="text-xs text-white/40">Pickup</p>
                    <p className="text-white">{pickup?.address || pickupAddress || 'Selected location'}</p>
                  </div>
                </div>
                <div className="border-l-2 border-dashed border-white/10 ml-1.5 h-4" />
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5" />
                  <div className="flex-1">
                    <p className="text-xs text-white/40">Dropoff</p>
                    <p className="text-white">{dropoff?.address || dropoffAddress || 'Selected location'}</p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Fare Breakdown */}
            {fareEstimate && (
              <GlassCard className="p-4 mb-4" hover={false}>
                <h3 className="font-heading font-semibold text-white mb-3">Fare Estimate</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white/60">
                    <span>Distance</span>
                    <span>{fareEstimate.distance?.toFixed(1)} km</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Est. Duration</span>
                    <span>{fareEstimate.duration} min</span>
                  </div>
                  {fareEstimate.is_predefined && (
                    <div className="flex justify-between text-white/60">
                      <span>Preset Route Fare</span>
                      <span className="text-gold">✓</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between">
                    <span className="font-semibold text-white">Total</span>
                    <span className="font-heading font-bold text-gold text-lg">
                      K{fareEstimate.estimated_fare?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </GlassCard>
            )}

            <p className="text-center text-white/40 text-xs mb-4">
              Payment: Cash to driver after trip
            </p>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] p-4" data-testid="ride-request-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <div className="flex gap-2">
            {['pickup', 'dropoff', 'confirm'].map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${['pickup', 'dropoff', 'confirm'].indexOf(step) >= i
                  ? 'bg-gold'
                  : 'bg-white/10'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {renderStepContent()}

      {/* Action Button */}
      <GoldButton
        className="w-full"
        onClick={step === 'confirm' ? handleRequestRide : handleNext}
        disabled={
          (step === 'pickup' && !pickup) ||
          (step === 'dropoff' && !dropoff) ||
          (step === 'confirm' && (!fareEstimate || requesting))
        }
        data-testid={step === 'confirm' ? 'request-ride-btn' : 'next-btn'}
      >
        {loading || requesting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : step === 'confirm' ? (
          'Request Ride'
        ) : (
          'Continue'
        )}
      </GoldButton>

      {geoError && (
        <p className="text-red-400 text-xs text-center mt-4">
          Location error: {geoError}. Please enable location services.
        </p>
      )}
    </div>
  );
};

export default RideRequestPage;
