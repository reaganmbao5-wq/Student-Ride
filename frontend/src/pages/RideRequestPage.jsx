import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, ArrowLeft, Loader2 } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { LocationPickerMap, RideMap } from '../components/map/RideMap';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { toast } from 'sonner';

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

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate fare estimate when both locations are set
  const calculateFare = useCallback(async () => {
    if (!pickup || !dropoff) return;
    
    setLoading(true);
    try {
      const distance = calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
      const duration = Math.round(distance * 3); // Rough estimate: 3 min per km
      
      const response = await api.post('/rides/estimate-fare', {
        distance_km: distance,
        duration_min: duration
      });
      
      setFareEstimate({
        ...response.data,
        distance,
        duration
      });
    } catch (error) {
      console.error('Error calculating fare:', error);
      toast.error('Failed to calculate fare');
    } finally {
      setLoading(false);
    }
  }, [pickup, dropoff, api]);

  useEffect(() => {
    if (pickup && dropoff) {
      calculateFare();
    }
  }, [pickup, dropoff, calculateFare]);

  const handleLocationSelect = (location) => {
    if (step === 'pickup') {
      setPickup({ ...location, address: pickupAddress || 'Selected location' });
    } else if (step === 'dropoff') {
      setDropoff({ ...location, address: dropoffAddress || 'Selected location' });
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

  const renderStepContent = () => {
    switch (step) {
      case 'pickup':
        return (
          <>
            <div className="mb-4">
              <h2 className="font-heading text-xl font-semibold text-white mb-2">Set Pickup Location</h2>
              <p className="text-white/50 text-sm">Tap on the map or use your current location</p>
            </div>
            
            <div className="relative mb-4">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold" />
              <GlassInput
                type="text"
                placeholder="Enter pickup address"
                value={pickupAddress}
                onChange={(e) => {
                  setPickupAddress(e.target.value);
                  if (pickup) {
                    setPickup({ ...pickup, address: e.target.value });
                  }
                }}
                className="pl-12"
                data-testid="pickup-input"
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

            <div className="h-64 rounded-2xl overflow-hidden mb-4">
              <LocationPickerMap
                center={pickup ? [pickup.lat, pickup.lng] : userLocation ? [userLocation.lat, userLocation.lng] : [-14.4087, 28.2849]}
                selectedLocation={pickup}
                onLocationSelect={handleLocationSelect}
                className="h-full"
              />
            </div>
          </>
        );

      case 'dropoff':
        return (
          <>
            <div className="mb-4">
              <h2 className="font-heading text-xl font-semibold text-white mb-2">Set Destination</h2>
              <p className="text-white/50 text-sm">Where would you like to go?</p>
            </div>
            
            <div className="relative mb-4">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
              <GlassInput
                type="text"
                placeholder="Enter destination"
                value={dropoffAddress}
                onChange={(e) => {
                  setDropoffAddress(e.target.value);
                  if (dropoff) {
                    setDropoff({ ...dropoff, address: e.target.value });
                  }
                }}
                className="pl-12"
                data-testid="dropoff-input"
              />
            </div>

            <div className="h-64 rounded-2xl overflow-hidden mb-4">
              <LocationPickerMap
                center={pickup ? [pickup.lat, pickup.lng] : [-14.4087, 28.2849]}
                selectedLocation={dropoff}
                onLocationSelect={handleLocationSelect}
                className="h-full"
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
            <div className="h-48 rounded-2xl overflow-hidden mb-4">
              <RideMap
                pickup={pickup}
                dropoff={dropoff}
                showRoute
                interactive={false}
                className="h-full"
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
                    <span>Base fare</span>
                    <span>K{fareEstimate.base_fare?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Distance ({fareEstimate.distance?.toFixed(1)} km)</span>
                    <span>K{fareEstimate.distance_charge?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Time ({fareEstimate.duration} min)</span>
                    <span>K{fareEstimate.time_charge?.toFixed(2)}</span>
                  </div>
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
                className={`h-1 flex-1 rounded-full transition-colors ${
                  ['pickup', 'dropoff', 'confirm'].indexOf(step) >= i
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
