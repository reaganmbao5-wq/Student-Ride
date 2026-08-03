import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Car, Star, ChevronRight, Navigation, AlertCircle, MessageCircle, Phone, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton, StatusBadge, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { RatingModal } from '../components/common/RatingModal';
import { PlatformMap } from '../map/components/PlatformMap';
import { CAMERA_MODES } from '../map/camera/CameraConfig';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useGeolocation } from '../map/hooks/useGeolocation';
import { useDriverDiscovery } from '../map/discovery/DriverDiscoveryEngine';
import { toast } from 'sonner';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const { isConnected, rideUpdate, driverLocation, passengerBriefing, clearRideUpdate, setPassengerBriefing } = useWebSocket();
  const { location: userLocation } = useGeolocation();
  
  const [activeRide, setActiveRide] = useState(null);
  
  // 6-Second Alternating Awareness Message Banner Timer
  const [showBriefingBanner, setShowBriefingBanner] = useState(true);
  useEffect(() => {
    const bannerInterval = setInterval(() => {
      setShowBriefingBanner(prev => !prev);
    }, 6000);
    return () => clearInterval(bannerInterval);
  }, []);
  
  // Fetch drivers near the pickup location if in an active ride, otherwise use physical user location
  const searchLocation = activeRide?.pickup_location || userLocation;
  const { drivers: nearbyDrivers } = useDriverDiscovery(api, searchLocation);

  const [recentRides, setRecentRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverPos, setDriverPos] = useState(null);
  const [isRouteAnimating, setIsRouteAnimating] = useState(false);
  
  // Bottom Sheet State
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  useEffect(() => {
    console.log('DASHBOARD_MOUNTED (Student)');
    fetchData();
  }, []);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingRideId, setRatingRideId] = useState(null);
  const [driverName, setDriverName] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Phase X.2: 6-second message rotation carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex(prev => prev + 1);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (rideUpdate) {
      if (rideUpdate.type === 'accepted') {
        setActiveRide(prev => ({ ...prev, ...rideUpdate.ride, driver: rideUpdate.driver }));
        toast.success('Driver accepted your ride!');
        fetchData();
      } else if (rideUpdate.type === 'driver_arrived') {
        setActiveRide(prev => prev ? { ...prev, status: 'driver_arrived' } : null);
        toast.success('Driver has arrived at pickup!');
      } else if (rideUpdate.type === 'state_changed') {
        setActiveRide(prev => prev ? { ...prev, status: rideUpdate.state } : null);
      } else if (rideUpdate.type === 'started') {
        setActiveRide(prev => prev ? { ...prev, status: 'ongoing' } : null);
        toast.info('Your ride has started');
      } else if (rideUpdate.type === 'completed') {
        toast.success('Ride completed!');
        setRatingRideId(activeRide?.id);
        setDriverName(activeRide?.driver?.user?.name || 'Driver');
        setShowRatingModal(true);
        setActiveRide(null);
        fetchData();
      } else if (rideUpdate.type === 'cancelled') {
        toast.error('Ride was cancelled');
        setActiveRide(null);
      } else if (rideUpdate.type === 'reassigning') {
        toast.error('Driver cancelled. Finding a new driver...', { duration: 5000 });
        setActiveRide(prev => prev ? { ...prev, status: 'requested', driver_id: null, driver: null } : null);
      }
      clearRideUpdate();
    }
  }, [rideUpdate, activeRide]);

  useEffect(() => {
    if (isConnected) {
      console.log('WebSocket connected. Fetching latest state...');
      fetchData();
    }
  }, [isConnected]);

  useEffect(() => {
    if (driverLocation && activeRide) {
      const isForThisRide = driverLocation.ride_id === activeRide.id;
      
      if (['driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination'].includes(activeRide.status)) {
        if (!driverLocation.ride_id || isForThisRide) {
          setDriverPos(driverLocation.location);
        }
      } else if (activeRide.status === 'requested' && isForThisRide) {
        // Safety check: if we missed the "accepted" event, resync from DB
        console.log('Received driver location for THIS ride but status is still requested. Fetching state...');
        setDriverPos(driverLocation.location);
        fetchData();
      }
    }
  }, [driverLocation, activeRide]);

  const fetchData = async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/rides/active'),
        api.get('/rides/history?limit=5')
      ]);

      setActiveRide(prev => {
        if (!activeRes.data) return null;
        if (prev && prev.id === activeRes.data.id) {
          // Preserve optimistic status and passenger_briefing if activeRes has older/null data
          return {
            ...activeRes.data,
            status: prev.status || activeRes.data.status,
            passenger_briefing: activeRes.data.passenger_briefing || prev.passenger_briefing
          };
        }
        return activeRes.data;
      });
      
      // Restore Passenger Briefing instantly (Problem 01)
      if (activeRes.data?.passenger_briefing) {
        setPassengerBriefing(activeRes.data.passenger_briefing);
      }
      
      if (activeRes.data?.driver?.current_location) {
        setDriverPos(activeRes.data.driver.current_location);
      } else {
        setDriverPos(null);
      }
      setRecentRides(historyRes.data);
      console.log('DASHBOARD_RENDER_COMPLETE (Student)');
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;

    try {
      await api.post(`/rides/${activeRide.id}/cancel`);
      toast.success('Ride cancelled');
      setActiveRide(null);
      setDriverPos(null);
    } catch (error) {
      toast.error('Failed to cancel ride');
    }
  };

  const handleSOS = async () => {
    // 1. Redirect to phone dialer immediately for user safety
    window.location.href = 'tel:+260976954518';

    // 2. Secretly alert all admins via backend
    if (!activeRide) return;
    try {
      await api.post('/emergency/sos', {
        ride_id: activeRide.id,
        location: userLocation,
        message: "User triggered SOS from phone"
      });
      toast.error('Emergency alert sent to admins.', {
        description: 'Help is on the way.',
        duration: 10000
      });
    } catch (error) {
      console.error('Failed to send SOS alert:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  // ==========================================
  // ACTIVE RIDE FULL-SCREEN VIEW
  // ==========================================
  if (activeRide) {
    const currentStatus = activeRide.status ? activeRide.status.toLowerCase() : '';
    const isArrivedOrStarted = ['driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination', 'ongoing'].includes(currentStatus);
    
    // Debug overlay to verify websocket data
    const debugOverlay = (
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 9999, background: 'rgba(255,0,0,0.8)', color: 'white', padding: '10px', borderRadius: '8px', pointerEvents: 'none' }}>
        Live WS Lat: {driverPos?.lat}<br/>
        Live WS Lng: {driverPos?.lng}
      </div>
    );

    // Markers Logic
    const mapMarkers = [];

    // 1. Determine which drivers to show
    // If we have an active ride with an actual driver assigned, ONLY show that assigned driver.
    // Otherwise, show all roaming nearby drivers.
    const assignedDriverMarker = (driverPos && activeRide?.driver) ? { 
      id: activeRide.driver.user_id || 'driver-1', 
      latitude: driverPos.lat, 
      longitude: driverPos.lng, 
      heading: driverPos.heading || 0 
    } : null;

    const driversArray = assignedDriverMarker ? [assignedDriverMarker] : nearbyDrivers;

    // 1.5 Intermediate & Target Stop Markers for Student Route Engine (Phase X.1 Passive Consumer Architecture)
    const isBriefingForThisRide = passengerBriefing && 
      (!passengerBriefing.ride_id || passengerBriefing.ride_id === activeRide?.id || passengerBriefing.ride_id === activeRide?._id);

    if (isBriefingForThisRide && Array.isArray(passengerBriefing.intermediate_stops)) {
      passengerBriefing.intermediate_stops.forEach((st, idx) => {
        if (st.lat && st.lng) {
          mapMarkers.push({
            lat: st.lat,
            lng: st.lng,
            iconType: st.stop_type === 'dropoff' ? 'dropoff' : 'pickup',
            key: `intermediate-${st.stop_id || idx}`
          });
        }
      });
    }

    // 2. Passenger pickup marker (Hide if driver has arrived or ride started)
    if (!isArrivedOrStarted && activeRide.pickup_location) {
      mapMarkers.push({
        lat: activeRide.pickup_location.lat,
        lng: activeRide.pickup_location.lng,
        iconType: 'pickup',
        key: 'pickup'
      });
    }

    // 3. Dropoff marker (Always show)
    if (activeRide.dropoff_location) {
      mapMarkers.push({
        lat: activeRide.dropoff_location.lat,
        lng: activeRide.dropoff_location.lng,
        iconType: 'dropoff',
        key: 'dropoff'
      });
    }

    let bounds = [];
    if (driverPos) bounds.push([driverPos.lat, driverPos.lng]);
    
    if (['accepted', 'driver_accepted', 'driver_en_route_to_pickup'].includes(currentStatus)) {
      // Driver is on the way to pickup: frame Driver + Pickup ALWAYS
      if (activeRide.pickup_location) bounds.push([activeRide.pickup_location.lat, activeRide.pickup_location.lng]);
    } else if (currentStatus === 'driver_arrived') {
      // Driver arrived at pickup: frame Pickup + Destination to show the full route about to be driven
      if (activeRide.pickup_location) bounds.push([activeRide.pickup_location.lat, activeRide.pickup_location.lng]);
      if (activeRide.dropoff_location) bounds.push([activeRide.dropoff_location.lat, activeRide.dropoff_location.lng]);
    } else if (['ongoing', 'ride_started', 'ride_in_progress', 'arriving_destination'].includes(currentStatus)) {
      // Ride ongoing: frame Driver + Destination IF animating (edge case), else zoom in
      if (activeRide.dropoff_location && isRouteAnimating) {
        bounds.push([activeRide.dropoff_location.lat, activeRide.dropoff_location.lng]);
      }
    } else if (currentStatus === 'requested') {
      // Searching for driver: frame Pickup + Destination
      // We don't frame nearby drivers here because their continuous movement causes the camera to constantly bounce/alternate zoom levels.
      // Framing pickup and destination is cleaner and more stable.
      if (activeRide.pickup_location) bounds.push([activeRide.pickup_location.lat, activeRide.pickup_location.lng]);
      if (activeRide.dropoff_location) bounds.push([activeRide.dropoff_location.lat, activeRide.dropoff_location.lng]);
    }

    // Final Bounds Logic
    // For en-route states (driver accepted / en_route), bound driver + pickup.
    // For arrived/started/ongoing states, set bounds to null so FOLLOW_DRIVER mode
    // centers directly on the driver without zooming out to fit all points.
    if (['accepted', 'driver_accepted', 'driver_en_route_to_pickup'].includes(currentStatus)) {
      bounds = bounds.length > 1 ? bounds : null; // Frame driver + pickup
    } else if (['driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination', 'ongoing'].includes(currentStatus)) {
      bounds = null; // Let FOLLOW_DRIVER lock directly onto the driver marker, no forced zoom-out
    } else {
      bounds = bounds.length > 1 ? bounds : null;
    }

    let getStatusText = () => {
      switch(activeRide.status) {
        case 'requested': return 'Finding a driver...';
        case 'accepted': return 'Driver is on the way';
        case 'driver_arrived': return 'Driver has arrived!';
        case 'ongoing': return 'Heading to destination';
        default: return 'Active Ride';
      }
    };

    let cameraMode = CAMERA_MODES.FREE;
    if (activeRide.status === 'requested') {
      cameraMode = CAMERA_MODES.OVERVIEW;
    } else if (['driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination'].includes(activeRide.status)) {
      cameraMode = CAMERA_MODES.FOLLOW_DRIVER;
    }

    const isPinnedState = isBriefingForThisRide && (
      passengerBriefing?.is_pinned || 
      activeRide.status === 'driver_arrived' ||
      ['Driver has arrived at your pickup!', 'Driver has arrived at your destination!', 'Destination reached.', 'Thank you for riding with us.'].includes(passengerBriefing?.briefing_text)
    );

    const carouselMessages = (isBriefingForThisRide && passengerBriefing?.carousel_messages && passengerBriefing.carousel_messages.length > 0)
      ? passengerBriefing.carousel_messages
      : (passengerBriefing?.briefing_text ? [passengerBriefing.briefing_text] : []);

    let activeBriefingText = isPinnedState
      ? (passengerBriefing?.briefing_text || getStatusText())
      : (carouselMessages.length > 0 ? carouselMessages[carouselIndex % carouselMessages.length] : getStatusText());

    // Problem 01: Route State Tracking (Single Source of Truth)
    let routeState = 'ROUTE UNAVAILABLE';
    let displayRouteGeometry = [];
    
    if (activeRide && ['requested', 'cancelled'].includes(activeRide.status) === false) {
      if (!passengerBriefing || passengerBriefing.ride_id !== activeRide.id) {
        routeState = 'Loading route...';
        activeBriefingText = 'Loading route...';
      } else if (isBriefingForThisRide && Array.isArray(passengerBriefing?.route_geometry) && passengerBriefing.route_geometry.length > 2) {
        routeState = 'ROUTE AVAILABLE';
        displayRouteGeometry = passengerBriefing.route_geometry;
      } else {
        routeState = 'ROUTE UNAVAILABLE';
      }
    }

    const displayRouteSegments = (isBriefingForThisRide && passengerBriefing?.route_segments && passengerBriefing.route_segments.length > 0)
      ? passengerBriefing.route_segments
      : [];

    return (
      <div className="fixed inset-0 bg-background overflow-hidden flex flex-col" data-testid="student-active-ride">
        {/* Map Layer */}
        <div className="flex-1 relative z-0">
          <PlatformMap
            center={
              (activeRide && activeRide.status === 'requested' && activeRide.pickup_location)
                ? activeRide.pickup_location
                : (driverPos || userLocation || { lat: -14.4087, lng: 28.2849 })
            }
            bounds={bounds}
            cameraMode={cameraMode}
            driverLocation={driverPos}
            zoom={15}
            markers={mapMarkers}
            drivers={driversArray}
            routes={displayRouteSegments}
            routeGeometry={displayRouteGeometry}
            rideStatus={activeRide.status}
            onRouteAnimationChange={setIsRouteAnimating}
            showRouteLine={true}
            interactive={true}
            className="w-full h-full"
          />
        </div>

        {/* Bottom Sheet Overlay */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-20 flex flex-col"
          animate={{ y: isSheetExpanded ? 0 : "calc(max(0px, 100% - 150px))" }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, info) => {
            if (info.offset.y > 50) setIsSheetExpanded(false);
            if (info.offset.y < -50) setIsSheetExpanded(true);
          }}
        >
          {/* Drag Handle Zone */}
          <div 
            className="w-full pt-4 pb-2 flex justify-center cursor-grab active:cursor-grabbing"
            onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          >
            <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
          </div>

          <div className="px-6 pb-6 pt-2 flex flex-col gap-6">
            
            {/* Minimized Header Row */}
            <div className="flex items-center justify-between" onClick={() => setIsSheetExpanded(!isSheetExpanded)}>
              <div className="flex-1 min-w-0 pr-4">
                <div className="h-7 flex items-center overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.h2 
                      key={`msg-${activeBriefingText}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="font-heading text-lg font-bold text-gold truncate"
                    >
                      {activeBriefingText}
                    </motion.h2>
                  </AnimatePresence>
                </div>
                {activeRide.driver && (
                  <p className="text-sm text-muted-foreground font-medium truncate">
                    {activeRide.driver.vehicle_color} {activeRide.driver.vehicle_model} • <span className="text-foreground uppercase bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{activeRide.driver.plate_number}</span>
                  </p>
                )}
              </div>
              
              {/* Status Badge right side */}
              <div className="text-right">
                <div className="text-2xl font-bold font-heading text-gold">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={passengerBriefing?.eta_text || 'Calculating...'}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="whitespace-nowrap"
                    >
                      {passengerBriefing?.eta_text || 'Calculating...'}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* EXPANDED CONTENT */}
            <AnimatePresence>
              {isSheetExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-6 overflow-hidden"
                >
                   {/* Driver Profile */}
                   {activeRide.driver && (
                     <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                          <Car className="w-7 h-7 text-gold" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-lg text-foreground">{activeRide.driver.user?.name}</p>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Star className="w-4 h-4 text-gold fill-gold" />
                            <span className="font-medium text-sm">{activeRide.driver.rating?.toFixed(1)}</span>
                          </div>
                        </div>
                        
                        {/* Quick Contact Icons */}
                        <div className="flex gap-2">
                           <button 
                             className="w-10 h-10 rounded-full bg-black flex items-center justify-center active:scale-95 transition-transform"
                             onClick={() => navigate(`/ride/chat/${activeRide.id}`)}
                           >
                             <MessageCircle className="w-5 h-5 text-white" />
                           </button>
                           <button 
                             className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center active:scale-95 transition-transform"
                             onClick={() => window.location.href = `tel:${activeRide.driver.user?.phone}`}
                           >
                             <PhoneCall className="w-5 h-5 text-foreground" />
                           </button>
                        </div>
                     </div>
                   )}

                   {/* Ride Details (Locations + Fare) */}
                   <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col gap-4">
                      <div className="flex items-start gap-3 relative">
                         <div className="absolute left-[11px] top-6 bottom-[-20px] w-0.5 bg-zinc-300 dark:bg-zinc-700 border-dashed" />
                         <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center shrink-0 z-10 mt-1">
                           <div className="w-2 h-2 rounded-full bg-white" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="font-medium text-sm line-clamp-1">{activeRide.pickup_location?.address}</p>
                         </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                         <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shrink-0 z-10 mt-1">
                           <div className="w-2 h-2 rounded-full bg-white" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="font-medium text-sm line-clamp-1">{activeRide.dropoff_location?.address}</p>
                         </div>
                         <div className="text-right shrink-0">
                           <p className="text-xs text-muted-foreground">Fare</p>
                           <p className="font-bold text-gold text-lg">K{activeRide.fare?.toFixed(2)}</p>
                           <p className={`text-[10px] uppercase font-bold tracking-wider mt-1 ${activeRide.ride_mode === 'shared' ? 'text-blue-500' : 'text-muted-foreground'}`}>{activeRide.ride_mode === 'shared' ? 'Shared Ride' : 'Private Ride'}</p>
                         </div>
                      </div>
                   </div>

                   {/* Actions Group */}
                   <div className="flex flex-col gap-3 pt-2">
                     {['requested', 'accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding'].includes(activeRide.status) && (
                        <button 
                          onClick={handleCancelRide} 
                          className="w-full py-4 bg-zinc-100 dark:bg-zinc-900 text-red-500 rounded-xl font-bold text-base active:scale-95 transition-transform"
                        >
                          Cancel Ride
                        </button>
                     )}
                     
                     {['accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination', 'ongoing'].includes(activeRide.status) && (
                        <button
                          onClick={handleSOS}
                          className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                        >
                          <AlertCircle className="w-5 h-5" />
                          Emergency SOS
                        </button>
                     )}
                   </div>

                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
        
        {/* Rating Modal explicitly mapped to active ride completion */}
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          driverName={driverName}
          rideId={ratingRideId}
          onSubmit={async (data) => {
            await api.post(`/rides/${ratingRideId}/rate`, data);
            toast.success('Rating submitted successfully');
            fetchData();
          }}
        />
      </div>
    );
  }

  // ==========================================
  // STANDARD DASHBOARD VIEW (NO ACTIVE RIDE)
  // ==========================================
  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="student-dashboard">
        {/* Header */}
        <div className="mb-8 font-heading">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Hello, {(user?.name || '').split(' ')[0] || 'Passenger'} ≡ƒæï
          </h1>
          <p className="text-muted-foreground">Where would you like to go today?</p>
        </div>

        <GlassCard
          className="p-6 cursor-pointer group"
          onClick={() => navigate('/ride')}
          data-testid="request-ride-card"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
              <Navigation className="w-7 h-7 text-gold" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-semibold text-foreground text-lg mb-1">Request a Ride</h3>
              <p className="text-muted-foreground text-sm">Tap to set your pickup and destination</p>
            </div>
            <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-gold transition-colors" />
          </div>
        </GlassCard>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Car className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-foreground">{recentRides.length}</p>
                <p className="text-xs text-muted-foreground">Total Rides</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-foreground">5.0</p>
                <p className="text-xs text-muted-foreground">Your Rating</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Recent Rides */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-foreground text-lg">Recent Rides</h2>
            <button
              onClick={() => navigate('/history')}
              className="text-gold text-sm hover:underline"
            >
              View all
            </button>
          </div>

          {recentRides.length > 0 ? (
            <div className="space-y-3">
              {recentRides.slice(0, 3).map((ride) => (
                <GlassCard
                  key={ride.id}
                  className="p-4"
                  onClick={() => navigate(`/ride/${ride.id}`)}
                  data-testid={`ride-history-${ride.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {new Date(ride.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusBadge status={ride.status} />
                  </div>
                  <div className="flex items-center gap-2 text-foreground mb-1">
                    <MapPin className="w-4 h-4 text-gold shrink-0" />
                    <span className="truncate text-sm">{ride.pickup_location?.address || 'Pickup location'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="truncate text-sm">{ride.dropoff_location?.address || 'Dropoff location'}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-gold font-semibold">K{ride.fare?.toFixed(2)}</span>
                    {ride.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-gold fill-gold" />
                        <span className="text-muted-foreground text-sm">{ride.rating}</span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Car}
              title="No rides yet"
              description="Your ride history will appear here"
              action={
                <GoldButton size="sm" onClick={() => navigate('/ride')}>
                  Book your first ride
                </GoldButton>
              }
            />
          )}
        </div>
      </div>

      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        driverName={driverName}
        rideId={ratingRideId}
        onSubmit={async (data) => {
          await api.post(`/rides/${ratingRideId}/rate`, data);
          toast.success('Rating submitted successfully');
          fetchData(); 
        }}
      />
    </Layout >
  );
};

export default StudentDashboard;
