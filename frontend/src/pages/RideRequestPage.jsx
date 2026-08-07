import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Navigation, TrendingUp, Search, MapPin, Flag, Zap } from 'lucide-react';
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
  const [rideMode, setRideMode] = useState('private');

  // Debounce ref for reverse geocoding & card touch gestures
  const geocodeTimeoutRef = useRef(null);
  const touchStartY = useRef(0);

  // Touch gesture handlers for stationary card swipe detection (isolating gesture from window scroll)
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaY) > 20) {
      setRideMode(prev => prev === 'shared' ? 'private' : 'shared');
    }
  };

  // Initialize center with user location once available
  useEffect(() => {
    if (userLocation && !pickup && step === 'pickup') {
      setMapCenter({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [userLocation, pickup, step]);

  useEffect(() => {
    console.log('RIDE_REQUEST_PAGE_MOUNTED');
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

    // Instant local Haversine estimate so UI renders immediately (< 100ms)
    const lat1 = p.lat, lon1 = p.lng, lat2 = d.lat, lon2 = d.lng;
    const R = 6371;
    const dlat = (lat2 - lat1) * Math.PI / 180;
    const dlon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dlon/2) * Math.sin(dlon/2);
    const estDist = Math.max(0.5, R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    const estDuration = Math.max(2, Math.round(estDist * 3));
    
    const estPrivateFare = Math.max(20, Math.round(15 + estDist * 5));
    const estSharedFare = Math.max(15, Math.round(estPrivateFare * 0.7));

    let cachedRoute = routeCache.getRoute(p, d);
    if (cachedRoute) setRouteGeometry(cachedRoute);

    setFareEstimate({
      private_fare: selectedDestination?.estimated_fare || estPrivateFare,
      shared_fare: selectedDestination?.estimated_fare || estSharedFare,
      distance: Math.round(estDist * 100) / 100,
      duration: estDuration,
      is_predefined: !!selectedDestination?.estimated_fare
    });
    setLoading(false); // Unblock UI immediately!

    try {
      const response = await api.post('/rides/estimate-fare', {
        pickup: p,
        dropoff: d
      });

      const data = response.data;
      let privateFare = data.private.estimated_fare;
      let sharedFare = data.shared.estimated_fare;
      
      if (selectedDestination?.estimated_fare) {
        privateFare = selectedDestination.estimated_fare;
        sharedFare = selectedDestination.estimated_fare;
      }

      if (data.geometry && Array.isArray(data.geometry) && data.geometry.length > 2) {
        setRouteGeometry(data.geometry);
        routeCache.setRoute(p, d, data.geometry);
      }

      setFareEstimate({
        private_fare: privateFare,
        shared_fare: sharedFare,
        distance: data.verified_distance,
        duration: data.verified_duration,
        is_predefined: data.private.is_fixed || !!selectedDestination?.estimated_fare,
        private_surge: data.private.surge_reason,
        shared_surge: data.shared.surge_reason
      });
    } catch (error) {
      console.error('Background fare calc error:', error);
    }
  }, [pickup, dropoff, api, selectedDestination]);

  // Automatic retry: If route geometry is missing or <= 2 points (straight line), retry every 3s until curve loads
  useEffect(() => {
    if (step !== 'confirm' || !pickup || !dropoff) return;

    if (!routeGeometry || routeGeometry.length <= 2) {
      const interval = setInterval(() => {
        calculateFare(pickup, dropoff);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [step, pickup, dropoff, routeGeometry, calculateFare]);


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

  const [isCollapsing, setIsCollapsing] = useState(false);

  const handleRequestRide = async () => {
    if (!pickup || !dropoff || !fareEstimate) return;

    setRequesting(true);
    try {
      const activeFare = rideMode === 'shared' ? fareEstimate.shared_fare : fareEstimate.private_fare;
      const res = await api.post('/rides/request', {
        pickup_location: pickup,
        dropoff_location: dropoff,
        ride_mode: rideMode,
        estimated_fare: activeFare,
        estimated_distance: fareEstimate.distance,
        estimated_duration: fareEstimate.duration
      });

      toast.success('Ride requested! Finding a driver...');
      setIsCollapsing(true);

      setTimeout(() => {
        navigate('/dashboard', { state: { initialRide: res.data } });
      }, 1500);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to request ride');
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

  // Memoized bounds logic for confirm step (strictly pickup and dropoff points, matching StudentDashboard.jsx for perfect framing)
  const bounds = useMemo(() => {
    if (step === 'confirm' && pickup && dropoff) {
      return [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng]
      ];
    }
    return null;
  }, [step, pickup, dropoff]);


  const sheetRef = useRef(null);
  const [sheetHeight, setSheetHeight] = useState(380);

  // Measure live bottom sheet rendered height for dynamic visible safe region camera framing
  useEffect(() => {
    if (!sheetRef.current) return;
    const updateHeight = () => {
      if (sheetRef.current) {
        const h = sheetRef.current.offsetHeight;
        if (h > 0) setSheetHeight(h);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(sheetRef.current);
    return () => observer.disconnect();
  }, [step]);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

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
      <div className={step === 'confirm' && isCollapsing ? "absolute inset-0 z-0" : "flex-1 relative z-0"}>
        <PlatformMap 
          center={mapCenter}
          bounds={bounds}
          bottomPadding={step === 'confirm' ? 140 : 0}
          cameraMode={
            step === 'pickup' ? CAMERA_MODES.PICKUP_SELECTION :
            step === 'dropoff' ? CAMERA_MODES.DESTINATION_SELECTION :
            CAMERA_MODES.OVERVIEW
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
        ref={sheetRef}
        layoutId="student-bottom-sheet"
        className={`${step === 'confirm' && isCollapsing ? 'absolute bottom-0 left-0 right-0' : 'relative'} z-20 bg-white dark:bg-zinc-950 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden`}
        initial={{ y: "100%" }}
        animate={{ y: isCollapsing ? "calc(100% - 115px)" : 0 }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Drag handle pill */}
        <div 
          onClick={() => step === 'confirm' && setIsSheetExpanded(!isSheetExpanded)}
          className="w-full flex justify-center pt-3 pb-2 cursor-pointer active:opacity-70"
        >
          <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>

        <motion.div 
          className="px-5 pb-5 flex flex-col gap-4"
          animate={{ opacity: isCollapsing ? 0 : 1 }}
          transition={{ duration: 0.5 }}
        >
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
                className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-50"
                onClick={handleConfirmLocation}
                disabled={isGeocoding || !currentAddress || currentAddress === 'Unable to fetch address'}
              >
                Confirm Pickup
              </button>
            </>
          )}

          {step === 'dropoff' && (
            <>
              <h2 className="text-xl font-bold font-heading">Set Destination</h2>
              
              <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                  <Flag className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Dropoff Address</p>
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
               {(() => {
                 const savePercent = fareEstimate && fareEstimate.private_fare > 0 && fareEstimate.shared_fare < fareEstimate.private_fare
                   ? Math.round((1 - fareEstimate.shared_fare / fareEstimate.private_fare) * 100)
                   : 30;

                 return (
                   <>
                     <div className="flex items-center justify-between gap-2">
                       <h2 className="text-xl font-bold font-heading shrink-0">Confirm Ride</h2>
                       <span className="text-[11px] font-medium text-zinc-400 text-right select-none">
                         {rideMode === 'shared' 
                           ? 'Tap/Swipe to switch to Private' 
                           : 'Tap/Swipe to switch to Shared'}
                       </span>
                     </div>
                     
                     {/* Locations summary */}
                     <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-2xl flex flex-col gap-2 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                           <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0">
                             <div className="w-1.5 h-1.5 rounded-full bg-white" />
                           </div>
                           <p className="font-medium text-xs truncate flex-1"><span className="text-muted-foreground font-normal">Pickup: </span>{pickup?.address}</p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                           <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                             <div className="w-1.5 h-1.5 rounded-full bg-white" />
                           </div>
                           <p className="font-medium text-xs truncate flex-1"><span className="text-muted-foreground font-normal">Dropoff: </span>{dropoff?.address}</p>
                        </div>
                     </div>

                     {/* Fare loading or display */}
                     {loading ? (
                       <div className="py-4 flex justify-center">
                         <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                       </div>
                     ) : fareEstimate ? (
                       <div className="flex items-stretch gap-3 min-h-[105px]">
                          {/* Animated Swipeable & Tap-Toggleable Stationary Ride Mode Selector Card */}
                          <div 
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onClick={() => setRideMode(prev => prev === 'shared' ? 'private' : 'shared')}
                            style={{ touchAction: 'none' }}
                            className={`flex-1 p-3.5 rounded-2xl cursor-pointer select-none transition-colors duration-300 relative overflow-hidden flex flex-col justify-between border-2 touch-none ${
                              rideMode === 'shared' 
                                ? 'bg-black text-white dark:bg-zinc-900 border-blue-500 shadow-md' 
                                : 'bg-black text-white dark:bg-zinc-900 border-zinc-700 shadow-md'
                            }`}
                          >
                            {/* Original embedded Save Badge flush on top-right corner */}
                            {rideMode === 'shared' && fareEstimate.shared_fare < fareEstimate.private_fare && (
                              <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-bl-xl shadow z-10">
                                Save {savePercent}%
                              </div>
                            )}

                            <AnimatePresence mode="wait">
                              <motion.div
                                key={rideMode}
                                initial={{ y: 15, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -15, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="w-full flex flex-col justify-between h-full"
                              >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div>
                                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${rideMode === 'shared' ? 'text-blue-400' : 'text-zinc-400'}`}>
                                      {rideMode} FARE
                                    </span>
                                    <div className="text-xl font-bold font-heading">
                                      K{rideMode === 'shared' ? fareEstimate.shared_fare?.toFixed(2) : fareEstimate.private_fare?.toFixed(2)}
                                    </div>
                                  </div>
                                  {/* Shifted ETA & Distance comfortably below Save badge */}
                                  <div className={`flex flex-col items-end shrink-0 ${rideMode === 'shared' ? 'pt-3.5' : 'pt-0.5'}`}>
                                    <p className="text-xs text-zinc-300 font-semibold">{fareEstimate.duration_min || fareEstimate.duration} min</p>
                                    <p className="text-[10px] text-zinc-400">{fareEstimate.distance_km || fareEstimate.distance?.toFixed(1)} km</p>
                                  </div>
                                </div>

                                <p className="text-[10px] text-zinc-400 leading-tight mt-1">
                                  {rideMode === 'shared'
                                    ? 'Lower fare. Ride may include other passengers.'
                                    : 'Entire vehicle reserved. No additional platform passengers.'}
                                </p>
                              </motion.div>
                            </AnimatePresence>
                          </div>

                          {/* Request Ride Action Button (Placed DOWN at bottom of row) */}
                          <button
                            onClick={handleRequestRide}
                            disabled={requesting}
                            className="w-32 py-3.5 px-3 bg-black dark:bg-white text-white dark:text-black font-bold text-sm rounded-2xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center shrink-0 shadow-lg text-center leading-tight self-end mb-0.5 min-h-[55px]"
                          >
                            {requesting ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Requesting...
                              </>
                            ) : (
                              'Request Ride'
                            )}
                          </button>
                       </div>
                     ) : null}
                   </>
                 );
               })()}
             </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default RideRequestPage;
