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
import { useNearbyDrivers } from '../hooks/useNearbyDrivers';
import { toast } from 'sonner';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const { isConnected, rideUpdate, driverLocation, clearRideUpdate } = useWebSocket();
  const { location: userLocation } = useGeolocation();
  const { drivers: nearbyDrivers } = useNearbyDrivers(api, userLocation);

  const [activeRide, setActiveRide] = useState(null);
  const [recentRides, setRecentRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverPos, setDriverPos] = useState(null);
  
  // Bottom Sheet State
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  useEffect(() => {
    console.log('DASHBOARD_MOUNTED (Student)');
    fetchData();
  }, []);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingRideId, setRatingRideId] = useState(null);
  const [driverName, setDriverName] = useState('');

  useEffect(() => {
    if (rideUpdate) {
      if (rideUpdate.type === 'accepted') {
        setActiveRide(prev => ({ ...prev, ...rideUpdate.ride, driver: rideUpdate.driver }));
        toast.success('Driver accepted your ride!');
      } else if (rideUpdate.type === 'driver_arrived') {
        setActiveRide(prev => prev ? { ...prev, status: 'driver_arrived' } : null);
        toast.success('Driver has arrived at pickup!');
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
      setDriverPos(driverLocation.location);
      
      // Safety check: if we missed the "accepted" event, resync from DB
      if (activeRide.status === 'requested') {
        console.log('Received driver location but ride is still requested. Fetching state...');
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

      setActiveRide(activeRes.data);
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
    const isArrivedOrStarted = ['driver_arrived', 'ongoing'].includes(activeRide.status);
    
    // Debug overlay to verify websocket data
    const debugOverlay = (
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 9999, background: 'rgba(255,0,0,0.8)', color: 'white', padding: '10px', borderRadius: '8px', pointerEvents: 'none' }}>
        Live WS Lat: {driverPos?.lat}<br/>
        Live WS Lng: {driverPos?.lng}
      </div>
    );

    // Markers Logic
    const mapMarkers = [];
    
    if (userLocation) {
      mapMarkers.push({
        lat: userLocation.lat,
        lng: userLocation.lng,
        iconType: 'user',
        key: 'user-loc'
      });
    }

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

    const bounds = [];
    if (driverPos) bounds.push([driverPos.lat, driverPos.lng]);
    
    // When driver is on the way, frame Driver + Pickup
    if (!isArrivedOrStarted && activeRide.pickup_location) {
      bounds.push([activeRide.pickup_location.lat, activeRide.pickup_location.lng]);
    }
    
    // When searching for a driver, frame Pickup + Nearby Drivers
    if (activeRide.status === 'requested') {
      nearbyDrivers.slice(0, 5).forEach(d => {
        if (d.latitude && d.longitude) {
          bounds.push([d.latitude, d.longitude]);
        }
      });
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
    } else if (['accepted', 'driver_arrived', 'ongoing'].includes(activeRide.status)) {
      cameraMode = CAMERA_MODES.FOLLOW_DRIVER;
    }

    return (
      <div className="fixed inset-0 bg-background overflow-hidden flex flex-col" data-testid="student-active-ride">
        {/* Map Layer */}
        <div className="flex-1 relative z-0">
          <PlatformMap
            center={driverPos || userLocation || { lat: -14.4087, lng: 28.2849 }}
            bounds={bounds.length > 1 ? bounds : null}
            cameraMode={cameraMode}
            driverLocation={driverPos}
            zoom={15}
            markers={mapMarkers}
            drivers={driversArray}
            routeGeometry={activeRide.verified_geometry}
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
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">{getStatusText()}</h2>
                {activeRide.driver && (
                  <p className="text-sm text-muted-foreground font-medium">
                    {activeRide.driver.vehicle_color} {activeRide.driver.vehicle_model} • <span className="text-foreground uppercase bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{activeRide.driver.plate_number}</span>
                  </p>
                )}
              </div>
              
              {/* Status Badge right side */}
              <div className="text-right">
                <div className="text-2xl font-bold font-heading text-gold">
                  {/* Mock ETA for now until we have real ones */}
                  {activeRide.status === 'ongoing' ? '...' : '2 min'}
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
                         </div>
                      </div>
                   </div>

                   {/* Actions Group */}
                   <div className="flex flex-col gap-3 pt-2">
                     {['requested', 'accepted', 'driver_arrived'].includes(activeRide.status) && (
                        <button 
                          onClick={handleCancelRide} 
                          className="w-full py-4 bg-zinc-100 dark:bg-zinc-900 text-red-500 rounded-xl font-bold text-base active:scale-95 transition-transform"
                        >
                          Cancel Ride
                        </button>
                     )}
                     
                     {['accepted', 'driver_arrived', 'ongoing'].includes(activeRide.status) && (
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
            Hello, {(user?.name || '').split(' ')[0] || 'Passenger'} 👋
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
