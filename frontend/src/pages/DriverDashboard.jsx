import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, MapPin, Clock, DollarSign, Star, Navigation, AlertCircle, Bell, Check, X, Upload, FileText, MessageCircle, PhoneCall, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton, StatusBadge, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { PlatformMap } from '../map/components/PlatformMap';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useWatchPosition } from '../map/hooks/useGeolocation';
import { routeCache } from '../map/route/RouteCache';
import { toast } from 'sonner';
import { App } from '@capacitor/app';

import { ActiveTripQueue } from '../components/driver/ActiveTripQueue';
import { SharedRideRequestPanel } from '../components/driver/SharedRideRequestPanel';
import { RideCard } from '../components/driver/RideCard';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, api, driverProfile, refreshDriverProfile, logout } = useAuth();
  const { newRideRequest, removedSharedRideId, clearRideRequest, sendLocationUpdate, rideUpdate, clearRideUpdate, driverLocation, isConnected } = useWebSocket();

  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [pendingRides, setPendingRides] = useState([]);
  const [masterSharedRidePool, setMasterSharedRidePool] = useState([]);
  const [routesData, setRoutesData] = useState([]);
  
  // Passenger Colors for Shared Rides
  const PASSENGER_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f97316'];
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  
  const getPassengerState = (status) => {
    if (['requested', 'accepted', 'driver_accepted', 'driver_en_route_to_pickup'].includes(status)) return 'WAITING PICKUP';
    if (['driver_arrived'].includes(status)) return 'DRIVER ARRIVED';
    if (['passenger_boarding', 'ride_started', 'ongoing', 'ride_in_progress', 'arriving_destination'].includes(status)) return 'INSIDE VEHICLE';
    if (['completed', 'ended'].includes(status)) return 'COMPLETED';
    if (['cancelled', 'declined'].includes(status)) return 'CANCELLED';
    return 'UNKNOWN';
  };

  const incomingSharedRequests = useMemo(() => {
    if (!driverProfile?.accepts_shared_rides) return [];
    
    // Calculate dynamically based on Passenger States
    const occupiedPassengers = activeRides.reduce((sum, ride) => {
      const state = getPassengerState(ride.status);
      if (['WAITING PICKUP', 'DRIVER ARRIVED', 'INSIDE VEHICLE'].includes(state)) {
        return sum + (ride.passenger_count || 1);
      }
      return sum;
    }, 0);

    const availableSeats = (driverProfile?.vehicle_capacity || 4) - occupiedPassengers;
    
    if (availableSeats <= 0) {
      return [];
    }
    
    // Return FULL synchronized pool (capacity decides ACCEPTANCE, not VISIBILITY)
    return masterSharedRidePool;
  }, [masterSharedRidePool, driverProfile?.accepts_shared_rides, driverProfile?.vehicle_capacity, activeRides]);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Bottom Sheet State
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  // Watch position when online
  const { startWatching, stopWatching, isWatching } = useWatchPosition(
    useCallback((location) => {
      // Only use real GPS if not simulating
      if (!isSimulating) {
        setCurrentLocation(location);
        if (isOnline) {
          sendLocationUpdate(location.lat, location.lng);
          api.post('/drivers/location', {
            latitude: location.lat,
            longitude: location.lng
          }).catch(console.error);
        }
      }
    }, [isOnline, isSimulating, sendLocationUpdate, api]),
    { enableHighAccuracy: true }
  );

  const refreshActiveRide = useCallback(async () => {
    try {
      const res = await api.get('/rides/driver/active');
      const ridesArray = res.data || [];
      setActiveRides(ridesArray);
      setActiveRide(ridesArray.length > 0 ? ridesArray[0] : null);
    } catch (err) {
      console.error("Error refreshing active ride:", err);
    }
  }, [api]);

  const fetchData = useCallback(async () => {
    try {
      const [activeRes, earningsRes] = await Promise.all([
        api.get('/rides/driver/active'),
        api.get('/drivers/earnings')
      ]);

      const ridesArray = activeRes.data || [];
      setActiveRides(ridesArray);
      setActiveRide(ridesArray.length > 0 ? ridesArray[0] : null);
      setEarnings(earningsRes.data);
      
      const pendingRes = await api.get('/rides/pending');
      if (pendingRes.data) {
        // Pending rides list should show BOTH private and shared rides if no active ride
        const allPending = pendingRes.data || [];
        setPendingRides(allPending);
        setMasterSharedRidePool(allPending.filter(r => r.ride_mode === 'shared'));
      }
      
      const profile = await refreshDriverProfile();
      if (!profile && !driverProfile) {
        navigate('/driver/register');
        return;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 404) {
        navigate('/driver/register');
      }
    } finally {
      setLoading(false);
    }
  }, [api, navigate, refreshDriverProfile, driverProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Capacitor App State (Background -> Foreground)
  useEffect(() => {
    let listener = null;
    const setupListener = async () => {
      listener = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('App resumed, refreshing driver dashboard data...');
          fetchData();
        }
      });
    };
    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [fetchData]);

  useEffect(() => {
    if (isConnected) {
      console.log('WebSocket connected. Fetching latest state for driver...');
      fetchData();
    }
  }, [isConnected, fetchData]);

  useEffect(() => {
    if (!rideUpdate) return;
    
    if (rideUpdate.type === 'rating_received') {
      toast.success(`You received a ${rideUpdate.rating}-star rating!`);
      setEarnings(prev => ({ ...prev, rating: rideUpdate.new_average }));
      refreshDriverProfile();
    } else if (rideUpdate.type === 'cancelled' || rideUpdate.type === 'declined') {
        // Find if this was an active shared ride being cancelled by a specific student
        if (activeRide && activeRide.ride_mode === 'shared' && rideUpdate.ride_id === activeRide.id && rideUpdate.student_id) {
          // It's a partial cancellation (one student cancelled their seat)
          // We don't remove the whole activeRide, we just refresh it
          refreshActiveRide();
          toast.info("A passenger cancelled their shared ride request.");
        } 
        else if (activeRide?.id === rideUpdate.ride_id) {
          // The entire ride was cancelled
          setActiveRide(null);
          setRouteGeometry(null);
          toast.info('Ride was cancelled');
        }
        
        // Always remove from pending lists
        setPendingRides(prev => prev.filter(r => r.id !== rideUpdate.ride_id));
        setMasterSharedRidePool(prev => prev.filter(r => r.id !== rideUpdate.ride_id));
      } else if (rideUpdate.type === 'accepted') {
        // Remove from pending rides once someone accepts it
        setPendingRides(prev => prev.filter(r => r.id !== rideUpdate.ride?.id));
        setMasterSharedRidePool(prev => prev.filter(r => r.id !== rideUpdate.ride?.id));
    }
  }, [rideUpdate, refreshDriverProfile, activeRide, refreshActiveRide]);

  // Handle real-time synchronization for shared pool
  useEffect(() => {
    if (removedSharedRideId) {
      setMasterSharedRidePool(prev => prev.filter(r => r.id !== removedSharedRideId));
      setPendingRides(prev => prev.filter(r => r.id !== removedSharedRideId));
    }
  }, [removedSharedRideId]);

  // Simulation Mode Logic: Just prevents watchPosition from overriding the python script
  useEffect(() => {
    if (isSimulating && isOnline) {
      toast.info("Simulation Mode ON: Python script can now control location safely.");
    }
  }, [isSimulating, isOnline]);

  useEffect(() => {
    if (driverProfile) {
      setIsOnline(driverProfile.is_online);
    }
  }, [driverProfile]);

  useEffect(() => {
    if (isOnline && !isWatching && !isSimulating) {
      startWatching();
    } else if ((!isOnline || isSimulating) && isWatching) {
      stopWatching();
    }
  }, [isOnline, isWatching, isSimulating, startWatching, stopWatching]);

  // Handle new incoming ride requests
  useEffect(() => {
    if (newRideRequest && isOnline) {
      // Shared rides also go into the Master Pool
      if (newRideRequest.ride_mode === 'shared') {
        setMasterSharedRidePool(prev => {
          if (!prev.find(r => r.id === newRideRequest.id)) {
            return [...prev, newRideRequest];
          }
          return prev;
        });
      }
      
      // All rides go into the Pending Rides list so they show up on the Idle Home Page
      setPendingRides(prev => {
        if (!prev.find(r => r.id === newRideRequest.id)) {
          return [newRideRequest, ...prev];
        }
        return prev;
      });
      
      clearRideRequest();
    }
  }, [newRideRequest, isOnline, clearRideRequest]);

  useEffect(() => {
    if (activeRides.length > 0) {
      const fetchRoutes = async () => {
        const routes = await Promise.all(
          activeRides.map(async (ride, index) => {
            if (!ride.pickup_location || !ride.dropoff_location) return null;
            
            const color = PASSENGER_COLORS[index % PASSENGER_COLORS.length];
            const pIndex = `P${index + 1}`;
            
            const cachedGeometry = routeCache.getRoute(ride.pickup_location, ride.dropoff_location);
            if (cachedGeometry) {
              return { rideId: ride.id, geometry: cachedGeometry, color, pIndex, status: ride.status };
            }
            
            try {
              const res = await api.post('/rides/estimate-fare', {
                pickup: ride.pickup_location,
                dropoff: ride.dropoff_location
              });
              if (res.data?.geometry) {
                routeCache.setRoute(ride.pickup_location, ride.dropoff_location, res.data.geometry);
                return { rideId: ride.id, geometry: res.data.geometry, color, pIndex, status: ride.status };
              }
            } catch (err) {
              console.error("Could not fetch route geometry for ride", ride.id, err);
            }
            return null;
          })
        );
        setRoutesData(routes.filter(Boolean));
      };
      
      fetchRoutes();
    } else {
      setRoutesData([]);
    }
  }, [activeRides, api]);

  const handleToggleOnline = async () => {
    if (!driverProfile?.is_approved) {
      toast.error('Your account is pending approval');
      return;
    }

    try {
      const response = await api.post('/drivers/toggle-online');
      setIsOnline(response.data.is_online);
      toast.success(response.data.is_online ? 'You are now online' : 'You are now offline');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to toggle status');
    }
  };

  const handleAcceptRide = async (rideId) => {
    try {
      setLoading(true);
      const response = await api.post(`/rides/${rideId}/accept`);
      setActiveRide(response.data);
      clearRideRequest();
      toast.success('Ride accepted!');
    } catch (error) {
      console.error('Error accepting ride:', error);
      toast.error(error.response?.data?.detail || 'Failed to accept ride');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSharedRide = async (rideId) => {
    try {
      setLoading(true);
      const response = await api.post(`/rides/${rideId}/accept`);
      setActiveRide(response.data);
      setMasterSharedRidePool(prev => prev.filter(r => r.id !== rideId));
      setPendingRides(prev => prev.filter(r => r.id !== rideId));
      toast.success('Shared ride accepted!');
      fetchData(); // Refresh everything safely
    } catch (error) {
      console.error('Error accepting shared ride:', error);
      toast.error(error.response?.data?.detail || 'Failed to accept ride');
      setIncomingSharedRequests(prev => prev.filter(r => r.id !== rideId));
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineSharedRide = (rideId) => {
    setIncomingSharedRequests(prev => prev.filter(r => r.id !== rideId));
  };

  const handleDeclineRide = () => {
    clearRideRequest();
  };

  const handleDriverArrived = async (targetRide = activeRide) => {
    if (!targetRide) return;
    try {
      await api.post(`/rides/${targetRide.id}/arrived`);
      refreshActiveRide();
      toast.success('Passenger notified of your arrival');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleStartRide = async (targetRide = activeRide) => {
    if (!targetRide) return;
    try {
      await api.post(`/rides/${targetRide.id}/start`);
      refreshActiveRide();
      toast.success('Ride started');
    } catch (error) {
      toast.error('Failed to start ride');
    }
  };

  const handleCompleteRide = async (targetRide = activeRide) => {
    if (!targetRide) return;
    try {
      const response = await api.post(`/rides/${targetRide.id}/complete`);
      toast.success(`Ride completed! Fare: K${response.data.fare}`);
      refreshActiveRide();
      fetchData(); // Refresh earnings
    } catch (error) {
      toast.error('Failed to complete ride');
    }
  };

  const handleCancelRide = async (targetRide = activeRide) => {
    if (!targetRide) return;
    try {
      await api.post(`/rides/${targetRide.id}/cancel`);
      toast.info('Ride cancelled');
      refreshActiveRide();
    } catch (error) {
      toast.error('Failed to cancel ride');
    }
  };

  const openNavigation = (location) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
    window.open(url, '_blank');
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Max 2MB allowed.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await api.post(`/drivers/documents?doc_type=${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`);
      refreshDriverProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
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

  // Not approved state
  if (driverProfile && !driverProfile.is_approved) {
    return (
      <Layout>
        <div className="p-4 md:p-8" data-testid="driver-pending">
          <GlassCard className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
              Pending Approval
            </h2>
            <p className="text-muted-foreground mb-6">
              Your driver account is being reviewed. You'll be notified once approved.
            </p>
            <div className="p-4 bg-muted rounded-xl text-left mb-6 font-body border border-border">
              <p className="text-sm text-muted-foreground mb-2">Vehicle Details:</p>
              <p className="text-foreground">{driverProfile.vehicle_model} • {driverProfile.vehicle_color}</p>
              <p className="text-muted-foreground">{driverProfile.plate_number}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-white font-medium text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-gold" />
                Required Documents
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DocumentUploadCard
                  title="Driver's License"
                  type="license"
                  url={driverProfile.verification_docs?.license}
                  onUpload={(e) => handleFileUpload(e, 'license')}
                  uploading={uploading}
                />
                <DocumentUploadCard
                  title="Vehicle Registration"
                  type="registration"
                  url={driverProfile.verification_docs?.registration}
                  onUpload={(e) => handleFileUpload(e, 'registration')}
                  uploading={uploading}
                />
              </div>
            </div>
          </GlassCard>
        </div>
      </Layout>
    );
  }

  // ==========================================
  // ACTIVE RIDE FULL-SCREEN VIEW (DRIVER)
  // ==========================================
  if (activeRide) {
    // Markers Logic
    const mapMarkers = [];
    const bounds = [];
    
    // 1. Always show driver car
    const driversArray = currentLocation ? [{ id: 'driver-self', latitude: currentLocation.lat, longitude: currentLocation.lng, heading: 0 }] : [];
    if (currentLocation) bounds.push([currentLocation.lat, currentLocation.lng]);

    // 2. Loop through ALL active rides to show pickups and dropoffs
    activeRides.forEach((ride, index) => {
      const pIndex = `P${index + 1}`;
      const color = PASSENGER_COLORS[index % PASSENGER_COLORS.length];
      const state = getPassengerState(ride.status);
      
      // WAITING PICKUP: Show pickup location
      if (['WAITING PICKUP', 'DRIVER ARRIVED'].includes(state) && ride.pickup_location) {
        mapMarkers.push({
          lat: ride.pickup_location.lat,
          lng: ride.pickup_location.lng,
          iconType: 'pickup',
          pIndex,
          color,
          key: `pickup-${ride.id}`
        });
        bounds.push([ride.pickup_location.lat, ride.pickup_location.lng]);
      }
      
      // INSIDE VEHICLE / WAITING: Show destination location
      if (['WAITING PICKUP', 'DRIVER ARRIVED', 'INSIDE VEHICLE'].includes(state) && ride.dropoff_location) {
        mapMarkers.push({
          lat: ride.dropoff_location.lat,
          lng: ride.dropoff_location.lng,
          iconType: 'dropoff',
          pIndex,
          color,
          key: `dropoff-${ride.id}`
        });
        bounds.push([ride.dropoff_location.lat, ride.dropoff_location.lng]);
      }
    });

    const getStatusText = () => {
      switch(activeRide.status) {
        case 'accepted': return 'Pick up passenger';
        case 'driver_arrived': return 'Wait for passenger';
        case 'ongoing': return 'Drop off passenger';
        default: return 'Active Ride';
      }
    };

    // Make sure we have a valid target location for navigation
    const targetLocation = activeRide.status === 'requested' || activeRide.status === 'accepted' 
      ? activeRide.pickup_location 
      : activeRide.dropoff_location;

    return (
      <div className="fixed inset-0 bg-background overflow-hidden flex flex-col" data-testid="driver-active-ride">
        {/* Render intelligent shared ride requests here */}
        <SharedRideRequestPanel 
          requests={incomingSharedRequests}
          onAccept={handleAcceptSharedRide}
          onDecline={handleDeclineSharedRide}
          driverLocation={currentLocation}
        />
        
        {/* Map Layer */}
        <div className="flex-1 relative z-0">
          <PlatformMap
            center={currentLocation || { lat: -14.4087, lng: 28.2849 }}
            bounds={bounds.length > 1 ? bounds : null}
            zoom={16}
            markers={mapMarkers}
            drivers={driversArray}
            routes={routesData}
            rideStatus={activeRide.status}
            showRouteLine={true}
            interactive={true}
            className="w-full h-full"
          />
          
          {/* Navigation Overlay Button */}
          {targetLocation && (
            <div className="absolute top-4 right-4 z-10 pointer-events-auto">
              <button
                onClick={() => openNavigation(targetLocation)}
                className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform border-4 border-black/10"
              >
                <Navigation className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Sheet Overlay */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-20 flex flex-col min-h-[60vh] max-h-[70vh] overflow-hidden"
          animate={{ y: isSheetExpanded ? 0 : "calc(100% - 160px)" }}
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

          <div className="px-6 pb-6 pt-2 flex flex-col gap-6 flex-1 overflow-hidden">
            
            {/* Minimized Header Row */}
            <div className="flex flex-col gap-4 text-center cursor-pointer" onClick={() => setIsSheetExpanded(!isSheetExpanded)}>
               <div className="font-bold text-sm tracking-wider text-muted-foreground uppercase">
                 {activeRide.ride_mode === 'shared' ? 'Shared Ride' : 'Private Ride'}
               </div>
               
               {activeRides.length > 1 ? (
                 <div className="flex flex-col items-center gap-1">
                   <h2 className="font-heading text-2xl font-bold text-foreground">
                     {activeRides.reduce((sum, r) => sum + (r.passenger_count || 1), 0)} PASSENGERS
                   </h2>
                   {activeRides.filter(r => ['accepted', 'driver_accepted'].includes(r.status)).length > 0 && (
                     <span className="text-sm font-bold text-gold uppercase tracking-wider">
                       +{activeRides.filter(r => ['accepted', 'driver_accepted'].includes(r.status)).length} WAITING
                     </span>
                   )}
                 </div>
               ) : (
                 <div className="flex flex-col items-center gap-1">
                   <h2 className="font-heading text-2xl font-bold text-foreground">
                     {activeRides[0]?.passenger_count || 1} PASSENGER
                   </h2>
                   {['accepted', 'driver_accepted'].includes(activeRides[0]?.status) && (
                     <span className="text-sm font-bold text-gold uppercase tracking-wider">
                       +1 WAITING
                     </span>
                   )}
                 </div>
               )}
            </div>

            {/* EXPANDED CONTENT */}
            <AnimatePresence>
              {isSheetExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-8 overflow-y-auto flex-1 pt-4 pb-12 pr-2"
                >
                  {activeRides.map((ride, index) => {
                    const color = PASSENGER_COLORS[index % PASSENGER_COLORS.length];
                    const pIndex = `P${index + 1}`;
                    const rideStatusStr = ['accepted', 'driver_accepted'].includes(ride.status) ? 'WAITING' :
                                          ['driver_arrived', 'passenger_boarding'].includes(ride.status) ? 'ARRIVED' :
                                          ['ride_started', 'ride_in_progress', 'ongoing'].includes(ride.status) ? 'ACTIVE' :
                                          ride.status.toUpperCase();
                                          
                    return (
                      <div key={ride.id} className="flex flex-col gap-4 pb-8 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0">
                        {/* Student Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span 
                              className="text-white font-bold text-sm px-2.5 py-1 rounded-md"
                              style={{ backgroundColor: color }}
                            >
                              {pIndex}
                            </span>
                            <span className="font-bold text-lg">{ride.student?.name || 'Passenger'}</span>
                          </div>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${rideStatusStr === 'ACTIVE' ? 'bg-blue-500/10 text-blue-600' : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground'}`}>
                            {rideStatusStr}
                          </span>
                        </div>
                        
                        {/* Trip Info */}
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-muted-foreground uppercase tracking-wider font-bold">Pickup:</span>
                            <span className="text-sm font-medium text-right max-w-[60%] truncate">{ride.pickup_location?.address}</span>
                          </div>
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-muted-foreground uppercase tracking-wider font-bold">Destination:</span>
                            <span className="text-sm font-medium text-right max-w-[60%] truncate">{ride.dropoff_location?.address}</span>
                          </div>
                          <div className="flex justify-between items-start mt-2">
                            <span className="text-lg font-bold text-gold uppercase tracking-wider">K{ride.driver_earning?.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Quick Contact Icons */}
                        <div className="flex gap-2 mt-2">
                           <button 
                             className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                             onClick={() => navigate(`/ride/chat/${ride.id}`)}
                           >
                             <MessageCircle className="w-5 h-5" />
                             <span className="font-bold">Chat</span>
                           </button>
                           <button 
                             className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                             onClick={() => window.location.href = `tel:${ride.student?.phone}`}
                           >
                             <PhoneCall className="w-5 h-5" />
                             <span className="font-bold">Call</span>
                           </button>
                        </div>
                        
                        {/* Classic Actions Group */}
                        <div className="flex flex-col gap-3 pt-2">
                           {['accepted', 'driver_accepted'].includes(ride.status) && (
                              <div className="flex gap-2">
                                 <button onClick={() => handleCancelRide(ride)} className="w-1/3 py-4 bg-zinc-100 dark:bg-zinc-900 text-red-500 rounded-xl font-bold active:scale-95 transition-transform">
                                   Cancel
                                 </button>
                                 <button onClick={() => handleDriverArrived(ride)} className="w-2/3 py-4 bg-black text-white rounded-xl font-bold active:scale-95 transition-transform">
                                   I've Arrived
                                 </button>
                              </div>
                           )}
                           
                           {ride.status === 'driver_arrived' && (
                              <button onClick={() => handleStartRide(ride)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95 shadow-lg shadow-blue-600/20 transition-transform">
                                Start Ride
                              </button>
                           )}

                           {['ride_started', 'ride_in_progress', 'ongoing'].includes(ride.status) && (
                              <button onClick={() => handleCompleteRide(ride)} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold active:scale-95 shadow-lg shadow-emerald-500/20 transition-transform">
                                Complete Ride
                              </button>
                           )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      </div>
    );
  }


    // ==========================================
    // STANDARD DASHBOARD VIEW (NO ACTIVE RIDE)
    // ==========================================
    return (
      <Layout>
        <div className="p-4 md:p-8 space-y-6" data-testid="driver-dashboard">

        {/* Header with Online Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-1">
              {isOnline ? 'Ready for Rides' : 'You\'re Offline'}
            </h1>
            <p className="text-muted-foreground">
              {isOnline ? 'Waiting for ride requests...' : 'Go online to start accepting rides'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleToggleOnline}
              className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isOnline
                ? 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                : 'bg-muted hover:bg-muted/80 border border-border'
                }`}
              data-testid="online-toggle"
            >
              <Power className={`w-8 h-8 ${isOnline ? 'text-white' : 'text-muted-foreground'}`} />
              {isOnline && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping" />
              )}
            </button>
            {isOnline && (
              <button
                onClick={() => setIsSimulating(!isSimulating)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all shadow-sm ${isSimulating
                  ? 'bg-amber-500/10 border-amber-500 text-amber-600 font-bold'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                title="When ON, your phone's real GPS is ignored so Python scripts can simulate movement smoothly."
              >
                {isSimulating ? 'Simulation Mode: ON' : 'Simulation Mode: OFF'}
              </button>
            )}
          </div>
        </div>

        {/* Restriction Alert */}
        {driverProfile?.wallet_status === 'restricted' && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-4 mb-6">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
            <div>
              <h3 className="font-heading font-bold text-foreground text-lg">Wallet Restricted</h3>
              <p className="text-muted-foreground text-sm mb-2">
                Your balance (K{driverProfile?.wallet_balance?.toFixed(2)}) is below the minimum requirement.
                You cannot accept new rides until you top up.
              </p>
              <div className="bg-black/20 rounded px-2 py-1 inline-block">
                <span className="text-xs text-red-400 font-mono">
                  Min Required: K{driverProfile?.minimum_required_balance?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Earnings Summary */}
        {earnings && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <GlassCard className="p-4" hover={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-lg font-heading font-bold text-foreground">
                    K{earnings.today_earnings?.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4" hover={false}>
              <div className="flex items-center gap-3">
                {/* Wallet Card Concept */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${driverProfile?.wallet_status === 'restricted' ? 'bg-red-500/20' : 'bg-blue-500/10'
                  }`}>
                  <div className={`font-bold ${driverProfile?.wallet_status === 'restricted' ? 'text-red-400' : 'text-blue-400'
                    }`}>
                    W
                  </div>
                </div>
                <div>
                  <p className={`text-lg font-heading font-bold ${driverProfile?.wallet_status === 'restricted' ? 'text-red-400' : 'text-foreground'
                    }`}>
                    K{driverProfile?.wallet_balance?.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Wallet Bal</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4 col-span-2 md:col-span-1" hover={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-heading font-bold text-foreground">{earnings.total_rides}</p>
                  <p className="text-xs text-muted-foreground">Total Rides</p>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Pending Rides */}
        {isOnline && pendingRides.length > 0 && (
          <div>
            <h2 className="font-heading font-semibold text-foreground text-lg mb-4">Available Rides</h2>
            <div className="space-y-3">
              {pendingRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  mode="FULL"
                  request={ride}
                  driverLocation={currentLocation}
                  onAccept={(id) => handleAcceptRide(id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {isOnline && pendingRides.length === 0 && !activeRide && (
          <EmptyState
            icon={MapPin}
            title="No rides available"
            description="Stay online, new ride requests will appear here"
          />
        )}

        {/* Rating */}
        {earnings && (
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Your Rating</span>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-gold fill-gold" />
                <span className="font-heading font-bold text-foreground text-lg">
                  {earnings.rating?.toFixed(1)}
                </span>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    </Layout >
  );
};

const DocumentUploadCard = ({ title, type, url, onUpload, uploading }) => (
  <div className="relative group">
    <div className={`p-4 rounded-xl border transition-all ${url
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : 'border-white/10 bg-white/5 hover:border-gold/30'
      }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {url && <Check className="w-3 h-3 text-emerald-400" />}
      </div>

      {url ? (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] text-emerald-400 font-medium uppercase">Uploaded</span>
        </div>
      ) : (
        <label className="flex items-center gap-2 cursor-pointer">
          <div className={`w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center transition-colors ${uploading ? 'animate-pulse' : 'group-hover:bg-gold/20'
            }`}>
            <Upload className="w-4 h-4 text-gold" />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium uppercase group-hover:text-foreground">
            {uploading ? 'Uploading...' : 'Tap to Upload'}
          </span>
          <input
            type="file"
            className="hidden"
            accept="image/*,.pdf"
            onChange={onUpload}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  </div>
);

export default DriverDashboard;
