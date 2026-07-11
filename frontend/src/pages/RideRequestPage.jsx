import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Navigation, TrendingUp, Search, MapPin, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../map/hooks/useGeolocation';
import { toast } from 'sonner';
import { reverseGeocode } from '../map/services/nominatim';
import PlatformMap from '../map/components/PlatformMap';
import { CAMERA_MODES } from '../map/camera/CameraConfig';
import { useDriverDiscovery } from '../map/discovery/DriverDiscoveryEngine';
import { routeCache } from '../map/route/RouteCache';
import { AddressSearch } from '../components/common/AddressSearch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const RideRequestPage = () => {
  const navigate = useNavigate();
  const { api } = useAuth();
  const { location: userLocation, loading: geoLoading, error: geoError, refresh: refreshLocation } = useGeolocation();
  const { drivers: nearbyDrivers } = useDriverDiscovery(api, userLocation);

  const [step, setStep] = useState('pickup'); // pickup, dropoff, confirm
  
  // Confirmed locations
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  
  // Real-time map center tracking
  const [mapCenter, setMapCenter] = useState({ lat: -14.294896006738625, lng: 28.55979849713035 }); // Default Mulungushi University
  const [isDragging, setIsDragging] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  
  const [destinations, setDestinations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Debounce ref for reverse geocoding
  const geocodeTimeoutRef = useRef(null);

  // Initialize center with user location once available
  useEffect(() => {
    if (userLocation && !pickup && step === 'pickup') {
      setMapCenter({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [userLocation, pickup, step]);

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

  // Reverse Geocode whenever map stops moving (debounced)
  useEffect(() => {
    if (isDragging) return;
    
    // Only geocode in pickup or dropoff steps
    if (step !== 'pickup' && step !== 'dropoff') return;

    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    geocodeTimeoutRef.current = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const data = await reverseGeocode(mapCenter.lat, mapCenter.lng);
        if (data && data.display_name) {
          setCurrentAddress(data.display_name);
        } else {
          setCurrentAddress('Unknown location');
        }
      } catch (error) {
        setCurrentAddress('Unable to fetch address');
      } finally {
        setIsGeocoding(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(geocodeTimeoutRef.current);
  }, [mapCenter, isDragging, step]);


  const calculateFare = useCallback(async (pickupLoc, dropoffLoc) => {
    const p = pickupLoc || pickup;
    const d = dropoffLoc || dropoff;
    if (!p || !d) return;

    setLoading(true);
    try {
      let cachedRoute = routeCache.getRoute(p, d);
      
      const response = await api.post('/rides/estimate-fare', {
        pickup: p,
        dropoff: d
      });

      const data = response.data;
      let estimatedFare = data.estimated_fare;
      
      if (selectedDestination?.estimated_fare) {
        estimatedFare = selectedDestination.estimated_fare;
      }

      if (data.geometry && Array.isArray(data.geometry) && data.geometry.length > 0) {
        setRouteGeometry(data.geometry);
        routeCache.setRoute(p, d, data.geometry);
      } else if (cachedRoute) {
        // Fallback to cache if backend returned none for some reason but we had one
        setRouteGeometry(cachedRoute);
      } else {
        setRouteGeometry(null);
      }

      setFareEstimate({
        estimated_fare: estimatedFare,
        distance: data.verified_distance,
        duration: data.verified_duration,
        is_predefined: !!selectedDestination?.estimated_fare,
        is_surge: !!data.surge_reason,
        surge_reason: data.surge_reason
      });
    } catch (error) {
      console.error('Fare calc error:', error);
      toast.error('Failed to calculate fare');
    } finally {
      setLoading(false);
    }
  }, [pickup, dropoff, api, selectedDestination]);


  const handleConfirmLocation = () => {
    let loc = {
      lat: mapCenter.lat,
      lng: mapCenter.lng,
      address: currentAddress
    };

    if (step === 'dropoff' && selectedDestination) {
      loc = {
        lat: selectedDestination.latitude,
        lng: selectedDestination.longitude,
        address: selectedDestination.name
      };
    }

    if (step === 'pickup') {
      setPickup(loc);
      setStep('dropoff');
    } else if (step === 'dropoff') {
      setDropoff(loc);
      setStep('confirm');
      // Pass loc directly to avoid stale closure — dropoff state won't be set yet
      calculateFare(pickup, loc);
    }
  };

  const handleDestinationDropdownSelect = (destId) => {
    const dest = destinations.find(d => d.id === destId);
    if (dest) {
      setSelectedDestination(dest);
      setMapCenter({ lat: dest.latitude, lng: dest.longitude });
      setCurrentAddress(dest.name);
    }
  };

  const handleRequestRide = async () => {
    if (!pickup || !dropoff || !fareEstimate) return;

    setRequesting(true);
    try {
      await api.post('/rides/request', {
        pickup_location: pickup,
        dropoff_location: dropoff,
        estimated_fare: fareEstimate.estimated_fare,
        estimated_distance: fareEstimate.distance,
        estimated_duration: fareEstimate.duration
      });

      toast.success('Ride requested! Finding a driver...');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to request ride');
    } finally {
      setRequesting(false);
    }
  };

  const handleBack = () => {
    if (step === 'dropoff') {
      setStep('pickup');
      setDropoff(null);
      if (pickup) setMapCenter({ lat: pickup.lat, lng: pickup.lng });
    } else if (step === 'confirm') {
      setStep('dropoff');
      setFareEstimate(null);
      setRouteGeometry(null);
      if (dropoff) setMapCenter({ lat: dropoff.lat, lng: dropoff.lng });
    } else {
      navigate('/dashboard');
    }
  };

  // Build the markers array based on step
  const markers = [];
  if (step === 'dropoff' && pickup) {
    markers.push({ lat: pickup.lat, lng: pickup.lng, iconType: 'pickup', key: 'fixed-pickup' });
  }
  if (step === 'confirm') {
    if (pickup) markers.push({ lat: pickup.lat, lng: pickup.lng, iconType: 'pickup', key: 'final-pickup' });
    if (dropoff) markers.push({ lat: dropoff.lat, lng: dropoff.lng, iconType: 'dropoff', key: 'final-dropoff' });
  }

  // Bounds logic for confirm step
  let bounds = null;
  if (step === 'confirm' && pickup && dropoff) {
    bounds = [
      [pickup.lat, pickup.lng],
      [dropoff.lat, dropoff.lng]
    ];
  }


  return (
    <div className="fixed inset-0 bg-background overflow-hidden flex flex-col" data-testid="ride-request-page">
      
      {/* Top Header overlay */}
      <div className="absolute top-10 md:top-6 left-0 right-0 z-10 p-4 flex items-center justify-between pointer-events-none">
        <button
          onClick={handleBack}
          className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center shadow-lg pointer-events-auto active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Map Layer */}
      <div className="flex-1 relative z-0">
        <PlatformMap 
          center={mapCenter}
          bounds={bounds}
          cameraMode={
            step === 'pickup' ? CAMERA_MODES.PICKUP_SELECTION :
            step === 'dropoff' ? CAMERA_MODES.DESTINATION_SELECTION :
            CAMERA_MODES.FOLLOW_ROUTE
          }
          onCenterChanged={(c) => {
             if (step !== 'confirm') setMapCenter(c);
          }}
          onDragStart={() => {
            setIsDragging(true);
            setSelectedDestination(null);
          }}
          onDragEnd={() => setIsDragging(false)}
          markers={markers}
          drivers={nearbyDrivers}
          routeGeometry={routeGeometry}
          showRouteLine={step === 'confirm'}
          interactive={step !== 'confirm'} // Disable panning during confirm
          className="w-full h-full"
        />

        {/* Fixed Center Marker Overlay (Only visible during selection steps) */}
        {step !== 'confirm' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-20 pointer-events-none flex flex-col items-center">
             {/* Info Tooltip */}
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: isDragging ? 0 : 1, y: isDragging ? 10 : 0 }}
               className="bg-black text-white text-xs font-bold px-3 py-1.5 rounded-full mb-2 shadow-lg whitespace-nowrap"
             >
               {isGeocoding ? (
                 <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Loading...</span>
               ) : (
                 step === 'pickup' ? 'Set Pickup Here' : 'Set Destination Here'
               )}
             </motion.div>

             {/* The actual pin */}
             <div className="relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl ${step === 'pickup' ? 'bg-black' : 'bg-red-600'}`}>
                  {step === 'pickup' ? <MapPin className="w-6 h-6" /> : <Flag className="w-6 h-6" />}
                </div>
                {/* Pin stem */}
                <div className={`w-1 h-4 mx-auto ${step === 'pickup' ? 'bg-black' : 'bg-red-600'}`} />
                {/* Shadow dot */}
                <div className="w-3 h-1.5 bg-black/30 rounded-full mx-auto mt-[-2px] blur-[1px]" />
             </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <motion.div 
        className="relative z-20 bg-white dark:bg-zinc-950 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        {/* Drag handle pill */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>

        <div className="p-5 flex flex-col gap-4">
          
          {step === 'pickup' && (
            <>
              <h2 className="text-xl font-bold font-heading">Pickup Location</h2>
              
              <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current Address</p>
                   <p className="text-sm font-medium truncate">{currentAddress || 'Fetching address...'}</p>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  if (userLocation) {
                    setMapCenter({ lat: userLocation.lat, lng: userLocation.lng });
                    toast.success("Locating you...");
                  } else {
                    toast.error("Location not available yet.");
                  }
                }}
                className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 py-1"
              >
                <Navigation className="w-4 h-4" /> Use Current Location
              </button>

              <div className="w-full flex items-center gap-2">
                <div className="flex-1">
                  <AddressSearch
                    placeholder="Or search for an address..."
                    onLocationSelect={(loc) => {
                      setMapCenter({ lat: loc.lat, lng: loc.lng });
                      setCurrentAddress(loc.address);
                      setSelectedDestination(null);
                    }}
                  />
                </div>
                <button
                  onClick={() => refreshLocation()}
                  disabled={geoLoading}
                  className="w-12 h-12 flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Navigation className={`w-5 h-5 text-black dark:text-white ${geoLoading ? 'animate-pulse' : ''}`} />
                </button>
              </div>

              <button 
                className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center"
                onClick={handleConfirmLocation}
                disabled={isGeocoding || !currentAddress || currentAddress === 'Unable to fetch address'}
              >
                Confirm Pickup
              </button>
            </>
          )}

          {step === 'dropoff' && (
            <>
              <h2 className="text-xl font-bold font-heading">Destination</h2>
              
              <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                  <Flag className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current Address</p>
                   <p className="text-sm font-medium truncate">{currentAddress || 'Fetching address...'}</p>
                </div>
              </div>

              {destinations.length > 0 && (
                <Select onValueChange={handleDestinationDropdownSelect}>
                  <SelectTrigger className="w-full h-12 bg-zinc-100 dark:bg-zinc-900 border-none rounded-xl">
                    <SelectValue placeholder="Quick select popular destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.map((dest) => (
                      <SelectItem key={dest.id} value={dest.id}>{dest.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <button 
                className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-50"
                onClick={handleConfirmLocation}
                disabled={isGeocoding || !currentAddress || currentAddress === 'Unable to fetch address'}
              >
                Confirm Destination
              </button>
            </>
          )}

          {step === 'confirm' && (
             <>
               <h2 className="text-xl font-bold font-heading">Confirm Ride</h2>
               
               {/* Locations summary */}
               <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-2xl flex flex-col gap-4 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-start gap-3 relative">
                     <div className="absolute left-[11px] top-6 bottom-[-20px] w-0.5 bg-zinc-300 dark:bg-zinc-700 border-dashed" />
                     <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center shrink-0 z-10 mt-1">
                       <div className="w-2 h-2 rounded-full bg-white" />
                     </div>
                     <div className="flex-1">
                       <p className="text-xs text-muted-foreground">Pickup</p>
                       <p className="font-medium text-sm line-clamp-1">{pickup?.address}</p>
                     </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                     <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shrink-0 z-10 mt-1">
                       <div className="w-2 h-2 rounded-full bg-white" />
                     </div>
                     <div className="flex-1">
                       <p className="text-xs text-muted-foreground">Dropoff</p>
                       <p className="font-medium text-sm line-clamp-1">{dropoff?.address}</p>
                     </div>
                  </div>
               </div>

               {/* Fare loading or display */}
               {loading ? (
                 <div className="py-6 flex justify-center">
                   <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                 </div>
               ) : fareEstimate ? (
                 <div className="flex items-center justify-between p-4 bg-black text-white rounded-2xl">
                    <div>
                      <p className="text-sm text-zinc-400">Total Fare</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold font-heading">K{fareEstimate.estimated_fare?.toFixed(2)}</p>
                        {fareEstimate.is_surge && (
                           <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-yellow-400 tracking-wider">Surge</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-medium">{fareEstimate.duration} min</p>
                       <p className="text-xs text-zinc-400">{fareEstimate.distance?.toFixed(1)} km</p>
                    </div>
                 </div>
               ) : null}

               <button 
                className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-50 flex justify-center"
                onClick={handleRequestRide}
                disabled={loading || requesting || !fareEstimate}
              >
                {requesting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Request Ride'}
              </button>
             </>
          )}

        </div>
      </motion.div>
    </div>
  );
};

export default RideRequestPage;
