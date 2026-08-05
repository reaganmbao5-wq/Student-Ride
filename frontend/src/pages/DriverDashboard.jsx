import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, MapPin, Clock, DollarSign, Star, Navigation, AlertCircle, Bell, Check, X, Upload, FileText, MessageCircle, PhoneCall, Loader2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton, StatusBadge, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { PlatformMap } from '../map/components/PlatformMap';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useWatchPosition } from '../map/hooks/useGeolocation';
import { routeCache } from '../map/route/RouteCache';
import { RouteProgress } from '../map/route/RouteProgress';
import { toast } from 'sonner';
import { App } from '@capacitor/app';
import { useRef } from 'react';

import { ActiveTripQueue } from '../components/driver/ActiveTripQueue';
import { SharedRideRequestPanel } from '../components/driver/SharedRideRequestPanel';
import { RideCard } from '../components/driver/RideCard';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, api, driverProfile, refreshDriverProfile, logout } = useAuth();
  const { newRideRequest, removedSharedRideId, clearRideRequest, sendLocationUpdate, requestHardRecalculation, rideUpdate, clearRideUpdate, routeQueueUpdate, clearRouteQueueUpdate, driverLocation, isConnected } = useWebSocket();

  const [routeQueue, setRouteQueue] = useState([]);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcTrigger, setRecalcTrigger] = useState(0);
  const hardCooldownRef = useRef(0);

  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [pendingRides, setPendingRides] = useState([]);
  const [masterSharedRidePool, setMasterSharedRidePool] = useState([]);
  const [routesData, setRoutesData] = useState([]);
  
  // Passenger Colors for Shared Rides
  const PASSENGER_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#ef4444'];
  
  const getColorForRideId = (rideId) => {
    if (!rideId) return '#3b82f6';
    const index = activeRides.findIndex(r => r.id === rideId);
    if (index === -1) return '#3b82f6';
    return PASSENGER_COLORS[index % PASSENGER_COLORS.length];
  };
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

  const getRideId = (r) => r?.id || r?._id || (typeof r === 'string' ? r : null);

  // Calculate dynamically based on Passenger States
  const occupiedPassengers = useMemo(() => {
    return activeRides.reduce((sum, ride) => {
      const state = getPassengerState(ride.status);
      if (['WAITING PICKUP', 'DRIVER ARRIVED', 'INSIDE VEHICLE'].includes(state)) {
        return sum + (ride.passenger_count || 1);
      }
      return sum;
    }, 0);
  }, [activeRides]);

  const availableSeats = useMemo(() => {
    return (driverProfile?.vehicle_capacity || 4) - occupiedPassengers;
  }, [driverProfile?.vehicle_capacity, occupiedPassengers]);

  const incomingSharedRequests = useMemo(() => {
    if (driverProfile?.accepts_shared_rides === false) return [];
    if (availableSeats <= 0) return [];
    
    // Filter out rides that are ALREADY active for this driver so accepted rides never remain on the side panel
    const activeRideIds = new Set(activeRides.map(r => getRideId(r)));
    return masterSharedRidePool.filter(r => !activeRideIds.has(getRideId(r)));
  }, [masterSharedRidePool, activeRides, driverProfile?.accepts_shared_rides, availableSeats]);
  
  const [isSimulating, setIsSimulating] = useState(() => {
    return localStorage.getItem('driver_is_simulating') === 'true';
  });

  const toggleSimulating = () => {
    setIsSimulating(prev => {
      const next = !prev;
      localStorage.setItem('driver_is_simulating', String(next));
      return next;
    });
  };

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
      const [activeRes, earningsRes, tripRes] = await Promise.all([
        api.get('/rides/driver/active'),
        api.get('/drivers/earnings'),
        api.get('/rides/driver/trip').catch(() => ({ data: { route_queue: [] } }))
      ]);

      const ridesArray = activeRes.data || [];
      setActiveRides(ridesArray);
      setActiveRide(ridesArray.length > 0 ? ridesArray[0] : null);
      setEarnings(earningsRes.data);
      if (tripRes?.data) {
        if (tripRes.data.route_queue) setRouteQueue(tripRes.data.route_queue);
        if (tripRes.data.full_driver_segments && Array.isArray(tripRes.data.full_driver_segments) && tripRes.data.full_driver_segments.length > 0) {
          setRoutesData(tripRes.data.full_driver_segments);
        }
      }
      
      const pendingRes = await api.get('/rides/pending');
      if (pendingRes.data) {
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
  // NOTE: driverProfile intentionally excluded — including it causes fetchData to
  // recreate on every profile update, triggering a stale GET that clobbers optimistic UI state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, navigate, refreshDriverProfile]);

  // Initial data load on mount — stable, runs exactly once
  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // On WebSocket reconnect: only refresh the route queue and earnings.
  // Do NOT call fetchData() here — it fetches activeRides from the backend and
  // clobbers any optimistic UI state that was set before the reconnect.
  useEffect(() => {
    if (isConnected) {
      api.get('/rides/driver/trip')
        .then(res => { if (res?.data?.route_queue) setRouteQueue(res.data.route_queue); })
        .catch(() => {});
    }
  }, [isConnected, api]);

  useEffect(() => {
    if (!rideUpdate) return;
    
    if (rideUpdate.type === 'driver_arrived') {
      setActiveRides(prev => prev.map(r => getRideId(r) === rideUpdate.ride_id ? { ...r, status: 'driver_arrived' } : r));
      if (activeRide && getRideId(activeRide) === rideUpdate.ride_id) {
        setActiveRide(prev => ({ ...prev, status: 'driver_arrived' }));
      }
      clearRideUpdate();
    } else if (rideUpdate.type === 'started' || rideUpdate.type === 'ride_started') {
      setActiveRides(prev => prev.map(r => getRideId(r) === rideUpdate.ride_id ? { ...r, status: 'ongoing' } : r));
      if (activeRide && getRideId(activeRide) === rideUpdate.ride_id) {
        setActiveRide(prev => ({ ...prev, status: 'ongoing' }));
      }
      clearRideUpdate();
    } else if (rideUpdate.type === 'completed') {
      setActiveRides(prev => {
        const remaining = prev.filter(r => getRideId(r) !== rideUpdate.ride_id);
        if (activeRide && getRideId(activeRide) === rideUpdate.ride_id) {
          setActiveRide(remaining.length > 0 ? remaining[0] : null);
        }
        return remaining;
      });
      clearRideUpdate();
    } else if (rideUpdate.type === 'rating_received') {
      toast.success(`You received a ${rideUpdate.rating}-star rating!`);
      setEarnings(prev => ({ ...prev, rating: rideUpdate.new_average }));
      refreshDriverProfile();
      clearRideUpdate();
    } else if (rideUpdate.type === 'cancelled' || rideUpdate.type === 'declined') {
        if (activeRide && activeRide.ride_mode === 'shared' && getRideId(activeRide) === rideUpdate.ride_id && rideUpdate.student_id) {
          refreshActiveRide();
          toast.info("A passenger cancelled their shared ride request.");
        } 
        else if (getRideId(activeRide) === rideUpdate.ride_id) {
          setActiveRide(null);
          setRouteGeometry(null);
          toast.info('Ride was cancelled');
        }
        
        setPendingRides(prev => prev.filter(r => getRideId(r) !== rideUpdate.ride_id));
        setMasterSharedRidePool(prev => prev.filter(r => getRideId(r) !== rideUpdate.ride_id));
        clearRideUpdate();
      } else if (rideUpdate.type === 'accepted') {
        setPendingRides(prev => prev.filter(r => getRideId(r) !== getRideId(rideUpdate.ride)));
        setMasterSharedRidePool(prev => prev.filter(r => getRideId(r) !== getRideId(rideUpdate.ride)));
        clearRideUpdate();
    }
  }, [rideUpdate, refreshDriverProfile, activeRide, refreshActiveRide, clearRideUpdate]);

  useEffect(() => {
    if (routeQueueUpdate) {
      setRouteQueue(routeQueueUpdate);
      clearRouteQueueUpdate();
    }
  }, [routeQueueUpdate, clearRouteQueueUpdate]);

  // Handle real-time synchronization for shared pool
  useEffect(() => {
    if (removedSharedRideId) {
      setMasterSharedRidePool(prev => prev.filter(r => (r.id !== removedSharedRideId && r._id !== removedSharedRideId && r.ride_id !== removedSharedRideId)));
      setPendingRides(prev => prev.filter(r => (r.id !== removedSharedRideId && r._id !== removedSharedRideId && r.ride_id !== removedSharedRideId)));
    }
  }, [removedSharedRideId]);

  // Simulation Mode Logic: Just prevents watchPosition from overriding the python script
  useEffect(() => {
    if (isSimulating && isOnline) {
      toast.info("Simulation Mode ON: Python script can now control location safely.");
    }
  }, [isSimulating, isOnline]);

  // When simulating, if we receive a driverLocation from the WebSocket, use it!
  useEffect(() => {
    if (isSimulating && driverLocation && driverLocation.location) {
      setCurrentLocation({
        lat: driverLocation.location.lat,
        lng: driverLocation.location.lng,
        heading: driverLocation.location.heading || 0
      });
    }
  }, [isSimulating, driverLocation]);

  useEffect(() => {
    if (driverProfile) {
      setIsOnline(driverProfile.is_online);
      const profileLoc = driverProfile.current_location?.lat ? driverProfile.current_location : { lat: -14.294532832852411, lng: 28.54970049702143, heading: 0 };
      setCurrentLocation(prev => prev || profileLoc);
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
    if (newRideRequest) {
      const reqId = getRideId(newRideRequest);
      const isShared = !newRideRequest.ride_mode || String(newRideRequest.ride_mode).toLowerCase() === 'shared';
      
      // Shared rides also go into the Master Pool
      if (isShared) {
        setMasterSharedRidePool(prev => {
          if (!prev.some(r => getRideId(r) === reqId)) {
            return [newRideRequest, ...prev];
          }
          return prev;
        });
      }
      
      // All rides go into the Pending Rides list so they show up on the Idle Home Page
      setPendingRides(prev => {
        if (!prev.some(r => getRideId(r) === reqId)) {
          return [newRideRequest, ...prev];
        }
        return prev;
      });
      
      clearRideRequest();
    }
  }, [newRideRequest, clearRideRequest]);

  const driverLocRef = useRef(null);
  useEffect(() => {
    driverLocRef.current = currentLocation;
    
    // Phase 3.2.5C: Route Recalculation Watchdog
    if (currentLocation && routeQueue.length > 0 && routesData.length > 0) {
      if (isRecalculating) return;
      if (Date.now() < hardCooldownRef.current) return;
      
      const driverFirstSegment = routesData.find(r => r.rideId.startsWith('driver-'));
      if (driverFirstSegment && driverFirstSegment.geometry) {
        const deviationStatus = RouteProgress.checkDeviationLevel(currentLocation, driverFirstSegment.geometry);
        if (deviationStatus === 'OFF_ROUTE') {
           const logicalStatus = RouteProgress.evaluateLogicalThreshold(currentLocation, routeQueue);
           if (logicalStatus === 'SOFT') {
              setIsRecalculating(true);
              setRecalcTrigger(v => v + 1);
              // Unlock after 5 seconds to prevent spamming while API resolves
              setTimeout(() => setIsRecalculating(false), 5000);
           } else if (logicalStatus === 'HARD') {
              hardCooldownRef.current = Date.now() + 30000; // 30 second cooldown
              if (requestHardRecalculation) {
                requestHardRecalculation();
              }
           }
        }
      }
    }
  }, [currentLocation, routeQueue, routesData, isRecalculating, requestHardRecalculation]);

  useEffect(() => {
    if (routeQueue.length > 0) {
      const fetchRoutes = async () => {
        const waypoints = [];
        if (driverLocRef.current) {
          waypoints.push({ ...driverLocRef.current, ride_id: 'driver' });
        }
        routeQueue.forEach(stop => {
          if (stop.coordinates) waypoints.push({ ...stop.coordinates, ride_id: stop.ride_id });
        });

        const fetchPromises = [];
        const orderedSegments = [];

        for (let i = 0; i < waypoints.length - 1; i++) {
          const origin = waypoints[i];
          const dest = waypoints[i+1];
          if (!origin?.lat || !dest?.lat) continue;
          
          const segmentKey = `${origin.ride_id || 'p'+i}-${dest.ride_id || 'p'+(i+1)}`;
          const color = getColorForRideId(dest.ride_id);
          
          let cachedGeometry = routeCache.getRoute(origin, dest);
          if (!cachedGeometry && origin.ride_id === 'driver') {
            cachedGeometry = routeCache.getLenientRoute(origin, dest, 0.0002);
          }
          
          if (cachedGeometry) {
            const segment = { rideId: segmentKey, geometry: cachedGeometry, color, pIndex: '', status: 'active' };
            orderedSegments.push(segment);
            
            // Incrementally show cached segments to prevent empty map flicker
            setRoutesData(prev => {
              if (!prev.find(r => r.rideId === segmentKey)) return [...prev, segment];
              return prev;
            });
            continue;
          }
          
          const fetchPromise = api.post('/rides/estimate-fare', {
            pickup: origin,
            dropoff: dest
          }).then(res => {
            const geo = res.data?.geometry;
            if (geo && geo.length > 2) {
              routeCache.setRoute(origin, dest, geo);
              const newSegment = { rideId: segmentKey, geometry: geo, color, pIndex: '', status: 'active' };
              setRoutesData(prev => {
                const existingIndex = prev.findIndex(r => r.rideId === segmentKey);
                if (existingIndex === -1) return [...prev, newSegment];
                const updated = [...prev];
                updated[existingIndex] = newSegment;
                return updated;
              });
              return newSegment;
            }
            return null;
          }).catch(err => {
            console.error("Could not fetch route geometry for segment", err);
            return null;
          });
          
          orderedSegments.push(fetchPromise);
          fetchPromises.push(fetchPromise);
        }
        
        // Wait for all missing segments, then commit clean exact array to remove obsolete segments
        if (fetchPromises.length > 0) {
          await Promise.all(fetchPromises);
        }
        
        // Ensure final array matches exact current queue
        const finalSegments = orderedSegments.map(s => s instanceof Promise ? null : s).filter(Boolean);
        // Wait for promises to resolve inside orderedSegments! 
        // Actually, orderedSegments has raw promises, we need to await them
        const resolvedSegments = await Promise.all(orderedSegments);
        setRoutesData(resolvedSegments.filter(Boolean));
      };
      
      fetchRoutes();
    } else {
      // Don't clear immediately, wait for backend delay to settle, or if truly empty, clear
      if (activeRides.length === 0) setRoutesData([]);
    }
  }, [routeQueue, api, recalcTrigger]);

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
    const fakeAcceptedRide = pendingRides.find(r => getRideId(r) === rideId) || { id: rideId, status: 'accepted' };
    const targetRide = { ...fakeAcceptedRide, status: 'accepted' };

    setActiveRide(prev => prev || targetRide);
    setActiveRides(prev => {
      if (prev.some(r => getRideId(r) === rideId)) return prev;
      return [...prev, targetRide];
    });
    setPendingRides(prev => prev.filter(r => getRideId(r) !== rideId));
    clearRideRequest();
    toast.success('Ride accepted!');

    try {
      const response = await api.post(`/rides/${rideId}/accept`);
      if (response.data) setActiveRide(response.data);
      const tripRes = await api.get('/rides/driver/trip');
      if (tripRes.data?.route_queue) setRouteQueue(tripRes.data.route_queue);
      if (tripRes.data?.full_driver_segments && Array.isArray(tripRes.data.full_driver_segments) && tripRes.data.full_driver_segments.length > 0) {
        setRoutesData(tripRes.data.full_driver_segments);
      }
    } catch (error) {
      console.error('Error accepting ride:', error);
      toast.error(error.response?.data?.detail || 'Failed to accept ride');
      fetchData(); // Rollback on error
    }
  };

  const handleAcceptSharedRide = async (rideId) => {
    const fakeAcceptedRide = masterSharedRidePool.find(r => getRideId(r) === rideId) || pendingRides.find(r => getRideId(r) === rideId) || { id: rideId, status: 'accepted' };
    const targetRide = { ...fakeAcceptedRide, status: 'accepted' };

    setActiveRide(prev => prev || targetRide);
    setActiveRides(prev => {
      if (prev.some(r => getRideId(r) === rideId)) return prev;
      return [...prev, targetRide];
    });
    setMasterSharedRidePool(prev => prev.filter(r => getRideId(r) !== rideId));
    setPendingRides(prev => prev.filter(r => getRideId(r) !== rideId));
    toast.success('Shared ride accepted!');
    
    try {
      const response = await api.post(`/rides/${rideId}/accept`);
      if (response.data) setActiveRide(response.data);
      const tripRes = await api.get('/rides/driver/trip');
      if (tripRes.data?.route_queue) setRouteQueue(tripRes.data.route_queue);
      if (tripRes.data?.full_driver_segments && Array.isArray(tripRes.data.full_driver_segments) && tripRes.data.full_driver_segments.length > 0) {
        setRoutesData(tripRes.data.full_driver_segments);
      }
    } catch (error) {
      console.error('Error accepting shared ride:', error);
      toast.error(error.response?.data?.detail || 'Failed to accept ride');
      fetchData(); // Revert on error
    }
  };

  const handleDeclineSharedRide = (rideId) => {
    setMasterSharedRidePool(prev => prev.filter(r => r.id !== rideId));
    setPendingRides(prev => prev.filter(r => r.id !== rideId));
  };

  const handleDeclineRide = () => {
    clearRideRequest();
  };

  const handleDriverArrived = async (targetRide = activeRide) => {
    if (!targetRide) return;
    const targetId = getRideId(targetRide);
    if (!targetId) return;

    // Optimistic UI update: instantly reflect arrived status across activeRides & activeRide
    setActiveRides(prev => prev.map(r => getRideId(r) === targetId ? { ...r, status: 'driver_arrived' } : r));
    if (activeRide && getRideId(activeRide) === targetId) {
      setActiveRide(prev => ({ ...prev, status: 'driver_arrived' }));
    }
    toast.success('Passenger notified of your arrival');

    try {
      await api.post(`/rides/${targetId}/arrived`);
    } catch (error) {
      console.error('Failed to update arrived status asynchronously:', error);
      // Keep optimistic UI locked on driver_arrived (zero-flicker policy)
    }
  };

  const handleStartRide = async (targetRide = activeRide) => {
    if (!targetRide) return;
    const targetId = getRideId(targetRide);
    if (!targetId) return;

    // Optimistic UI update: instantly reflect started status
    setActiveRides(prev => prev.map(r => getRideId(r) === targetId ? { ...r, status: 'ongoing' } : r));
    if (activeRide && getRideId(activeRide) === targetId) {
      setActiveRide(prev => ({ ...prev, status: 'ongoing' }));
    }
    toast.success('Ride started');

    try {
      await api.post(`/rides/${targetId}/start`);
    } catch (error) {
      console.error('Failed to start ride asynchronously:', error);
      // Keep optimistic UI locked on ongoing (zero-flicker policy)
    }
  };

  const handleCompleteRide = async (targetRide = activeRide) => {
    if (!targetRide) return;
    const targetId = getRideId(targetRide);
    if (!targetId) return;

    // Optimistic UI update: instantly transition to remaining student ride if any
    setActiveRides(prev => {
      const remaining = prev.filter(r => getRideId(r) !== targetId);
      if (activeRide && getRideId(activeRide) === targetId) {
        setActiveRide(remaining.length > 0 ? remaining[0] : null);
      }
      return remaining;
    });
    toast.success('Ride completed!');

    try {
      const response = await api.post(`/rides/${targetId}/complete`);
      if (response.data?.fare) {
        toast.success(`Fare: K${response.data.fare}`);
      }
      fetchData(); // Refresh earnings
    } catch (error) {
      console.error('Failed to complete ride asynchronously:', error);
    }
  };

  const handleCancelRide = async (targetRide = activeRide) => {
    if (!targetRide) return;
    const targetId = getRideId(targetRide);
    if (!targetId) return;

    // Optimistic UI update: filter out cancelled ride immediately
    setActiveRides(prev => prev.filter(r => getRideId(r) !== targetId));
    if (activeRide && getRideId(activeRide) === targetId) {
      setActiveRide(null);
    }
    toast.info('Ride cancelled');

    try {
      await api.post(`/rides/${targetId}/cancel`);
      refreshActiveRide();
    } catch (error) {
      console.error('Failed to cancel ride:', error);
      toast.error('Failed to cancel ride');
      refreshActiveRide();
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
    
    // 1. Always show driver car (falling back to Mulungushi University if GPS is offline)
    const activeDriverLoc = currentLocation || driverProfile?.current_location || { lat: -14.294532832852411, lng: 28.54970049702143, heading: 0 };
    const driversArray = [{ id: 'driver-self', latitude: activeDriverLoc.lat, longitude: activeDriverLoc.lng, heading: activeDriverLoc.heading || 0 }];
    if (activeDriverLoc?.lat) bounds.push([activeDriverLoc.lat, activeDriverLoc.lng]);

    // 2. Loop through routeQueue to show stops in optimized order
    routeQueue.forEach((stop, index) => {
      if (!stop.coordinates || !stop.coordinates.lat) return;
      
      mapMarkers.push({
        lat: stop.coordinates.lat,
        lng: stop.coordinates.lng,
        iconType: stop.stop_type,
        pIndex: `${index + 1}`, // Sequential Stop Numbering
        color: getColorForRideId(stop.ride_id), // Colored by Passenger Ownership
        key: stop.stop_id
      });
      bounds.push([stop.coordinates.lat, stop.coordinates.lng]);
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
          {/* Animated Capacity Indicator for Shared Rides */}
          {activeRide.ride_mode === 'shared' && driverProfile?.accepts_shared_rides && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute top-6 left-4 z-10"
            >
              <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-zinc-200/50 dark:border-zinc-800/50 flex items-center gap-3">
                <div className="relative">
                  <Users className="w-5 h-5 text-emerald-500" />
                  <AnimatePresence>
                    {availableSeats <= 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"
                      />
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Capacity</span>
                  <div className="flex items-baseline gap-1 leading-none">
                    <motion.span 
                      key={availableSeats}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className={`font-heading font-bold text-lg ${availableSeats > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}
                    >
                      {Math.max(0, availableSeats)}
                    </motion.span>
                    <span className="text-sm font-medium text-muted-foreground">/ {driverProfile?.vehicle_capacity || 4} seats</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <PlatformMap
            center={currentLocation || { lat: -14.294532832852411, lng: 28.54970049702143 }}
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
          initial={{ y: "calc(100% - 160px)" }}
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
            <div className="flex flex-col gap-8 overflow-y-auto flex-1 pt-4 pb-12 pr-2">
                  {(() => {
                    const activeStopRideId = routeQueue && routeQueue.length > 0 ? routeQueue[0].ride_id : null;
                    const sortedActiveRides = activeStopRideId 
                      ? [...activeRides].sort((a, b) => (a.id === activeStopRideId ? -1 : b.id === activeStopRideId ? 1 : 0))
                      : activeRides;

                    return sortedActiveRides.map((ride) => {
                      const color = getColorForRideId(ride.id);
                      const originalIndex = activeRides.findIndex(r => r.id === ride.id);
                      const pIndex = `P${(originalIndex >= 0 ? originalIndex : 0) + 1}`;
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
                   });
                  })()}
            </div>
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
                onClick={toggleSimulating}
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
