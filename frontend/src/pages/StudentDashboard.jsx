import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { MapPin, Clock, Star, ChevronRight, Navigation, AlertCircle, MessageCircle, Phone, PhoneCall, Loader2, Trash2, User as UserIcon, Bug } from 'lucide-react';
import { Car, Star as PhosphorStar } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton, StatusBadge, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { RatingModal } from '../components/common/RatingModal';

import SwipableRideCard from '../components/common/SwipableRideCard';
import { PlatformMap } from '../map/components/PlatformMap';
import { CAMERA_MODES } from '../map/camera/CameraConfig';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useGeolocation } from '../map/hooks/useGeolocation';
import { useDriverDiscovery } from '../map/discovery/DriverDiscoveryEngine';
import { toast } from 'sonner';
import { routeCache } from '../map/route/RouteCache';
import { TilePreloader } from '../map/services/TilePreloader';
import { haptics } from '../utils/haptics';
import { AppCache } from '../utils/AppCache';
import { StudentDashboardSkeleton } from '../components/common/PageSkeletons';
import { systemNotification } from '../services/SystemNotificationService';
import { DriverPhotoModal } from '../components/common/DriverPhotoModal';

const STATUS_RANK = {
  'requested': 1,
  'driver_accepted': 2,
  'accepted': 2,
  'driver_en_route_to_pickup': 2,
  'driver_arrived': 3,
  'passenger_boarding': 3,
  'ongoing': 4,
  'ride_started': 4,
  'ride_in_progress': 4,
  'arriving_destination': 4,
  'completed': 5,
  'ride_completed': 5,
  'ride_archived': 5,
  'cancelled': 5
};

const getNameGradient = (accent) => {
  switch (accent) {
    case 'gold':
      return 'linear-gradient(135deg, #FDE047 0%, #FACC15 25%, #FB923C 50%, #EAB308 75%, #FDE047 100%)';
    case 'green':
      return 'linear-gradient(135deg, #34D399 0%, #4ADE80 25%, #2DD4BF 50%, #22C55E 75%, #34D399 100%)';
    case 'pink':
      return 'linear-gradient(135deg, #F472B6 0%, #FB7185 25%, #E879F9 50%, #EC4899 75%, #F472B6 100%)';
    case 'orange':
      return 'linear-gradient(135deg, #FDBA74 0%, #FB923C 25%, #EF4444 50%, #F97316 75%, #FDBA74 100%)';
    case 'purple':
      return 'linear-gradient(135deg, #C084FC 0%, #A855F7 25%, #818CF8 50%, #E879F9 75%, #C084FC 100%)';
    case 'black':
      return 'linear-gradient(135deg, #F4F4F5 0%, #A1A1AA 25%, #E4E4E7 50%, #71717A 75%, #F4F4F5 100%)';
    case 'default':
    case 'blue':
    default:
      return 'linear-gradient(135deg, #38BDF8 0%, #60A5FA 25%, #818CF8 50%, #3B82F6 75%, #38BDF8 100%)';
  }
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialRideState = location.state?.initialRide || null;

  const { user, api } = useAuth();
  const { accentColor } = useTheme();
  const { isConnected, rideUpdate, driverLocation, passengerBriefing, clearRideUpdate, setPassengerBriefing } = useWebSocket();
  const { location: userLocation } = useGeolocation();
  
  const [activeRide, setActiveRide] = useState(() => initialRideState || AppCache.get('active_ride') || null);
  // Always start with loading=false — render from cache immediately, fetch happens silently in background
  const [loading, setLoading] = useState(false);
  
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

  // Smart Dynamic Average Wait Time Estimation (Free, 0 API credits burned, instant)
  const smartWaitTime = React.useMemo(() => {
    if (!nearbyDrivers || nearbyDrivers.length === 0 || !userLocation) {
      return '~3 min';
    }
    
    // Haversine formula to find distance to closest driver in km
    const R = 6371; // Earth's radius in km
    let minDistance = Infinity;

    for (const d of nearbyDrivers) {
      const dLat = d.latitude ?? d.lat;
      const dLng = d.longitude ?? d.lng;
      if (typeof dLat === 'number' && typeof dLng === 'number') {
        const radLat1 = (userLocation.lat * Math.PI) / 180;
        const radLat2 = (dLat * Math.PI) / 180;
        const diffLat = ((dLat - userLocation.lat) * Math.PI) / 180;
        const diffLng = ((dLng - userLocation.lng) * Math.PI) / 180;

        const a =
          Math.sin(diffLat / 2) * Math.sin(diffLat / 2) +
          Math.cos(radLat1) * Math.cos(radLat2) *
          Math.sin(diffLng / 2) * Math.sin(diffLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        if (distance < minDistance) {
          minDistance = distance;
        }
      }
    }

    if (minDistance === Infinity) {
      return '~3 min';
    }

    // Estimate based on ~25km/h campus driving speed + 1 min dispatch buffer
    const estimatedMinutes = Math.max(1, Math.min(15, Math.ceil((minDistance / 25) * 60) + 1));
    return `~${estimatedMinutes} min`;
  }, [nearbyDrivers, userLocation]);

  const getInitialRecentRides = () => {
    const recent = AppCache.get('recent_rides');
    if (Array.isArray(recent) && recent.length > 0) return recent;
    const fullHistory = AppCache.get('history');
    if (Array.isArray(fullHistory) && fullHistory.length > 0) return fullHistory.slice(0, 5);
    return [];
  };

  const [recentRides, setRecentRides] = useState(getInitialRecentRides);
  const [driverPos, setDriverPos] = useState(null);
  const [isRouteAnimating, setIsRouteAnimating] = useState(false);
  
  // Bottom Sheet & Modal State
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);


  // Track locally cancelled ride IDs to prevent in-flight fetchData race conditions from restoring cancelled rides
  const cancelledRideIdsRef = React.useRef(new Set());
  const sheetTouchStartY = React.useRef(0);

  // Touch gesture handlers for stationary bottom sheet swipe up/down expand/collapse
  const handleSheetTouchStart = (e) => {
    sheetTouchStartY.current = e.touches[0].clientY;
  };

  const handleSheetTouchMove = (e) => {
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  const handleSheetTouchEnd = (e) => {
    const deltaY = e.changedTouches[0].clientY - sheetTouchStartY.current;
    if (deltaY < -25) {
      setIsSheetExpanded(true);
      haptics.tap();
    } else if (deltaY > 25) {
      setIsSheetExpanded(false);
      haptics.tap();
    }
  };

  useEffect(() => {
    console.log('DASHBOARD_MOUNTED (Student)');
    fetchData();
    // Clear initialRide from history state so browser refresh (F5) doesn't re-read stale initialRide
    if (window.history.state && window.history.state.usr?.initialRide) {
      window.history.replaceState({}, document.title);
    }
  }, []);

  // Handle Capacitor App State (Background -> Foreground) for instant zero-delay sync
  useEffect(() => {
    let listener = null;
    const setupListener = async () => {
      try {
        listener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            console.log('Student App resumed, refreshing student dashboard data immediately...');
            fetchData();
          }
        });
      } catch (e) {
        // App listener unavailable on browser
      }
    };
    setupListener();

    return () => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    };
  }, []);

  // Pre-load map tiles in 3km radius around user location in background for zero-delay instant map rendering
  useEffect(() => {
    if (userLocation?.lat && userLocation?.lng) {
      TilePreloader.preloadArea(userLocation.lat, userLocation.lng, 3);
    }
  }, [userLocation]);

  // Automatic 4-Second Resync Loop: Guarantees status & route transitions update automatically without manual refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingRideId, setRatingRideId] = useState(null);
  const [driverName, setDriverName] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [requestedRouteGeometry, setRequestedRouteGeometry] = useState(null);

  // Fetch route geometry for requested (searching) state from cache or backend estimate (auto-retry straight lines)
  useEffect(() => {
    let retryInterval = null;

    const fetchRequestedRoute = () => {
      if (activeRide && activeRide.status === 'requested' && activeRide.pickup_location && activeRide.dropoff_location) {
        const p = activeRide.pickup_location;
        const d = activeRide.dropoff_location;
        
        const cached = routeCache.getRoute(p, d);
        if (cached && cached.length > 2) {
          setRequestedRouteGeometry(cached);
          if (retryInterval) clearInterval(retryInterval);
        } else {
          api.post('/rides/estimate-fare', { pickup: p, dropoff: d })
            .then(res => {
              const geo = res.data?.geometry;
              if (geo && geo.length > 0) {
                setRequestedRouteGeometry(geo);
                if (geo.length > 2) {
                  routeCache.setRoute(p, d, geo);
                  if (retryInterval) clearInterval(retryInterval);
                }
              }
            })
            .catch(err => console.error("Error fetching requested route geometry:", err));
        }
      }
    };

    fetchRequestedRoute();

    // If geometry is missing or still a 2-point straight line, retry every 5 seconds until OSRM returns curve
    retryInterval = setInterval(() => {
      setRequestedRouteGeometry(prev => {
        if (!prev || prev.length <= 2) {
          fetchRequestedRoute();
        }
        return prev;
      });
    }, 5000);

    return () => {
      if (retryInterval) clearInterval(retryInterval);
    };
  }, [activeRide, api]);

  // Expandable & Swipable Ride History States
  const [expandedRideId, setExpandedRideId] = useState(null);
  const [rideToDelete, setRideToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [isDriving, setIsDriving] = useState(false);

  const handleRequestRideClick = () => {
    if (isDriving) return;
    setIsDriving(true);

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([30, 40, 30, 40, 50]);
      } catch (e) {
        // ignore if not supported
      }
    }

    setTimeout(() => {
      navigate('/ride');
    }, 850);
  };

  const handleToggleExpand = (id) => {
    setExpandedRideId((prev) => (prev === id ? null : id));
  };

  const confirmDeleteRide = async () => {
    if (!rideToDelete) return;
    setDeleting(true);
    try {
      try {
        await api.delete(`/rides/${rideToDelete.id}`);
      } catch (err) {
        console.warn('Backend API delete endpoint notice:', err);
      }
      setRecentRides((prev) => prev.filter((r) => r.id !== rideToDelete.id));
      toast.success('Ride record deleted from history');
    } catch (error) {
      console.error('Error deleting ride:', error);
      toast.error('Failed to delete ride');
    } finally {
      setDeleting(false);
      setRideToDelete(null);
    }
  };

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
        const fullDriver = rideUpdate.driver || null;
        const updatedRide = {
          ...(rideUpdate.ride || {}),
          status: rideUpdate.ride?.status && rideUpdate.ride.status !== 'requested' ? rideUpdate.ride.status : 'driver_accepted',
          driver: fullDriver
        };
        setActiveRide(prev => ({ ...(prev || {}), ...updatedRide }));
        AppCache.set('active_ride', updatedRide);

        // Instantly populate driver position for immediate 3D follow camera lock
        const dLoc = fullDriver?.current_location || fullDriver?.location;
        if (dLoc) {
          const lat = dLoc.lat ?? dLoc.latitude ?? (Array.isArray(dLoc.coordinates) ? dLoc.coordinates[1] : null);
          const lng = dLoc.lng ?? dLoc.longitude ?? (Array.isArray(dLoc.coordinates) ? dLoc.coordinates[0] : null);
          if (lat !== null && lng !== null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
            setDriverPos({
              lat: Number(lat),
              lng: Number(lng),
              heading: Number(dLoc.heading || 0)
            });
          }
        }

        // Instantly populate passenger briefing & route geometry if provided
        if (updatedRide.passenger_briefing) {
          setPassengerBriefing(updatedRide.passenger_briefing);
        }

        systemNotification.notifyDriverAccepted(
          fullDriver?.user?.name,
          `${fullDriver?.vehicle_color || ''} ${fullDriver?.vehicle_model || ''}`
        );
        fetchData();
      } else if (rideUpdate.type === 'driver_arrived') {
        setActiveRide(prev => prev ? { ...prev, status: 'driver_arrived' } : null);
        systemNotification.notifyDriverArrived(activeRide?.driver?.user?.name);
      } else if (rideUpdate.type === 'state_changed') {
        setActiveRide(prev => prev ? { ...prev, status: rideUpdate.state } : null);
      } else if (rideUpdate.type === 'started') {
        setActiveRide(prev => prev ? { ...prev, status: 'ongoing' } : null);
        systemNotification.notifyRideStarted();
      } else if (rideUpdate.type === 'completed') {
        const completedId = activeRide?.id || rideUpdate.ride_id;
        if (completedId) {
          cancelledRideIdsRef.current.add(completedId);
        }
        systemNotification.notifyRideCompleted();
        setRatingRideId(completedId);
        setDriverName(activeRide?.driver?.user?.name || rideUpdate.driver_name || 'your driver');
        setShowRatingModal(true);
        setActiveRide(null);
        setPassengerBriefing(null);
        setDriverPos(null);
        AppCache.remove('active_ride');
      } else if (rideUpdate.type === 'cancelled') {
        const cancelledId = activeRide?.id || rideUpdate.ride_id;
        if (cancelledId) {
          cancelledRideIdsRef.current.add(cancelledId);
        }
        systemNotification.notifyRideCancelled('The ride was cancelled');
        setActiveRide(null);
        setPassengerBriefing(null);
        setDriverPos(null);
        AppCache.remove('active_ride');
        if (cancelledId) {
          setRecentRides(prev => {
            const updated = prev.map(r => r.id === cancelledId ? { ...r, status: 'cancelled' } : r);
            AppCache.set('recent_rides', updated);
            AppCache.set('history', updated);
            return updated;
          });
        }
        fetchData();
      } else if (rideUpdate.type === 'reassigning') {
        systemNotification.notifyRideCancelled('Driver cancelled. Finding a new driver...');
        setActiveRide(prev => prev ? { ...prev, status: 'requested', driver_id: null, driver: null } : null);
        AppCache.remove('active_ride');
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
        const serverData = activeRes.data;
        if (serverData.status === 'cancelled' || 
            serverData.status === 'completed' || 
            serverData.status === 'ride_completed' || 
            serverData.status === 'ride_archived' ||
            cancelledRideIdsRef.current.has(serverData.id)) {
          AppCache.remove('active_ride');
          return null;
        }

        // Monotonic Status Lock: If current client state is already at a higher rank for the same ride, NEVER downgrade!
        if (prev && prev.id === serverData.id) {
          const prevRank = STATUS_RANK[prev.status] || 0;
          const serverRank = STATUS_RANK[serverData.status] || 0;
          if (prevRank > serverRank) {
            console.log(`[StudentDashboard] Preventing status downgrade from ${prev.status} (${prevRank}) to ${serverData.status} (${serverRank})`);
            return {
              ...serverData,
              ...prev,
              passenger_briefing: prev.passenger_briefing || serverData.passenger_briefing
            };
          }
        }

        return {
          ...serverData,
          passenger_briefing: serverData.passenger_briefing || prev?.passenger_briefing
        };
      });
      
      // Restore Passenger Briefing instantly with strict ride_id ETA preservation guard
      if (activeRes.data?.passenger_briefing && activeRes.data.status !== 'cancelled' && !cancelledRideIdsRef.current.has(activeRes.data.id)) {
        setPassengerBriefing(prev => {
          const isSameRide = Boolean(prev && prev.ride_id && prev.ride_id === activeRes.data.passenger_briefing.ride_id);
          return {
            ...activeRes.data.passenger_briefing,
            eta_seconds: (activeRes.data.passenger_briefing.eta_seconds !== undefined && activeRes.data.passenger_briefing.eta_seconds !== null)
              ? activeRes.data.passenger_briefing.eta_seconds
              : (isSameRide ? (prev?.eta_seconds ?? null) : null),
            eta_text: (activeRes.data.passenger_briefing.eta_text)
              ? activeRes.data.passenger_briefing.eta_text
              : (isSameRide ? (prev?.eta_text || null) : null)
          };
        });
      } else {
        setPassengerBriefing(null);
      }
      
      if (activeRes.data?.driver?.current_location) {
        setDriverPos(activeRes.data.driver.current_location);
      } else {
        setDriverPos(null);
      }
      const ridesList = historyRes.data || [];
      setRecentRides(ridesList);
      AppCache.set('recent_rides', ridesList);
      AppCache.set('active_ride', activeRes.data);
      AppCache.set('history', ridesList);
      console.log('DASHBOARD_RENDER_COMPLETE (Student)');
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;

    const rideIdToCancel = activeRide.id;
    try {
      cancelledRideIdsRef.current.add(rideIdToCancel);
      setActiveRide(null);
      setDriverPos(null);
      setPassengerBriefing(null);
      AppCache.remove('active_ride');

      // Optimistically update recentRides and history cache immediately
      setRecentRides(prev => {
        const updated = prev.map(r => r.id === rideIdToCancel ? { ...r, status: 'cancelled' } : r);
        AppCache.set('recent_rides', updated);
        AppCache.set('history', updated);
        return updated;
      });

      await api.post(`/rides/${rideIdToCancel}/cancel`);
      toast.success('Ride cancelled');
      fetchData();
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
      toast.success('Emergency alert sent to admins.', {
        description: 'Help is on the way.',
        duration: 10000
      });
    } catch (error) {
      console.error('Failed to send SOS alert:', error);
    }
  };

  if (loading) {
    return <StudentDashboardSkeleton />;
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

    // 1.5 Intermediate & Target Stop Markers for Student Route Engine
    const currentRideId = activeRide?.id || activeRide?._id;
    const isBriefingForThisRide = Boolean(
      passengerBriefing && 
      currentRideId &&
      passengerBriefing.ride_id === currentRideId &&
      activeRide?.status !== 'requested' &&
      activeRide?.status !== 'cancelled'
    );

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

    const isSharedRide = activeRide.ride_mode === 'shared' || activeRide.ride_type === 'shared' || Boolean(passengerBriefing?.is_shared);
    const stopsRemaining = (isBriefingForThisRide && passengerBriefing?.stops_remaining !== undefined) ? passengerBriefing.stops_remaining : 0;
    const isPriorStopsActive = isSharedRide && stopsRemaining > 0 && ['accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'ongoing', 'ride_started'].includes(currentStatus);

    let bounds = [];
    if (driverPos) bounds.push([driverPos.lat, driverPos.lng]);
    
    if (isPriorStopsActive) {
      // Driver is visiting other students first: Frame Driver + Student Pickup + Intermediate Stops in 2D Overview
      if (activeRide.pickup_location) bounds.push([activeRide.pickup_location.lat, activeRide.pickup_location.lng]);
      if (isBriefingForThisRide && Array.isArray(passengerBriefing?.intermediate_stops)) {
        const myPickupIdx = passengerBriefing.intermediate_stops.findIndex(st => st.is_my_stop && st.stop_type === 'pickup');
        const limitIdx = myPickupIdx !== -1 ? myPickupIdx : passengerBriefing.intermediate_stops.length;
        passengerBriefing.intermediate_stops.slice(0, limitIdx).forEach(st => {
          if (st.lat && st.lng && !st.is_my_stop) bounds.push([st.lat, st.lng]);
        });
      }
    } else if (currentStatus === 'requested') {
      // Searching for driver: frame Pickup + Destination stably
      if (activeRide.pickup_location) bounds.push([activeRide.pickup_location.lat, activeRide.pickup_location.lng]);
      if (activeRide.dropoff_location) bounds.push([activeRide.dropoff_location.lat, activeRide.dropoff_location.lng]);
      
      // Include nearby drivers within 3.0km radius so camera frames all active roaming drivers cleanly
      if (activeRide.pickup_location && nearbyDrivers && nearbyDrivers.length > 0) {
        const pLat = activeRide.pickup_location.lat;
        const pLng = activeRide.pickup_location.lng;
        nearbyDrivers.forEach(d => {
          const dLat = d.latitude || d.lat;
          const dLng = d.longitude || d.lng;
          if (dLat && dLng) {
            const distSq = Math.pow(dLat - pLat, 2) + Math.pow(dLng - pLng, 2);
            if (distSq <= 0.00075) { // ~3.0 km radius threshold
              bounds.push([dLat, dLng]);
            }
          }
        });
      }
    }

    // Bounds Assignment:
    // If prior stops are active OR requested state: provide bounds for 2D Overview framing.
    // When it's this student's turn or in private rides: bounds is null so FOLLOW_DRIVER drives 45° 3D camera.
    if (isPriorStopsActive || currentStatus === 'requested') {
      bounds = bounds.length > 1 ? bounds : null;
    } else {
      bounds = null;
    }

    let getStatusText = () => {
      switch(activeRide?.status) {
        case 'requested': 
          return 'Finding a driver...';
        case 'accepted':
        case 'driver_accepted':
        case 'driver_en_route_to_pickup': 
          return 'Driver is approaching your pickup point';
        case 'driver_arrived':
        case 'passenger_boarding': 
          return 'Driver has arrived at your pickup point!';
        case 'ride_started':
        case 'ride_in_progress':
        case 'ongoing': 
          return 'Driver is heading to your destination';
        case 'arriving_destination': 
          return 'Driver has arrived at your destination!';
        case 'completed':
        case 'ride_completed': 
          return 'Ride completed!';
        default: 
          return 'Active Ride';
      }
    };

    let cameraMode = CAMERA_MODES.FREE;
    if (activeRide.status === 'requested' || isPriorStopsActive) {
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
      : (isBriefingForThisRide && passengerBriefing?.briefing_text ? [passengerBriefing.briefing_text] : []);

    let activeBriefingText = (activeRide.ride_mode !== 'shared')
      ? (isPinnedState && passengerBriefing?.briefing_text ? passengerBriefing.briefing_text : getStatusText())
      : (activeRide.status === 'requested'
          ? getStatusText()
          : (isPinnedState
              ? (passengerBriefing?.briefing_text || getStatusText())
              : (carouselMessages.length > 0 ? carouselMessages[carouselIndex % carouselMessages.length] : getStatusText())));

    // Route State Tracking
    let routeState = 'ROUTE UNAVAILABLE';
    let displayRouteGeometry = [];
    
    if (activeRide?.status === 'requested') {
      displayRouteGeometry = requestedRouteGeometry || [];
      routeState = displayRouteGeometry.length > 0 ? 'ROUTE AVAILABLE' : 'Loading route...';
    } else if (activeRide && activeRide.status !== 'cancelled') {
      if ((!passengerBriefing || passengerBriefing.ride_id !== currentRideId) && activeRide.ride_mode === 'shared') {
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

        {/* Bottom Sheet Overlay (Fixed flush at bottom-0, zero-flicker rock solid stability with swipe up/down) */}
        <div
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          style={{ touchAction: 'none' }}
          className="fixed bottom-0 left-0 right-0 bg-card text-card-foreground border-t border-border rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.25)] z-20 flex flex-col will-change-transform transform-gpu select-none"
        >
          {/* Drag Handle Zone */}
          <div 
            className="w-full pt-3.5 pb-1 flex justify-center cursor-pointer select-none"
            onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          >
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
          </div>

          <motion.div 
            className="px-6 pb-6 pt-2 flex flex-col gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            
            {/* Collapsed Briefing Title & Status */}
            <div className="flex items-center justify-between gap-4">
              {/* Briefing Text (Restored to full width without avatar truncation) */}
              <div className="flex-1 min-w-0">
                <div className="h-14 flex items-center">
                  <AnimatePresence mode="wait">
                    <motion.h2 
                      key={`msg-${activeBriefingText}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="font-heading text-base md:text-lg font-bold text-foreground whitespace-normal break-words leading-tight"
                    >
                      {activeBriefingText}
                    </motion.h2>
                  </AnimatePresence>
                </div>
                {activeRide.driver && (
                  <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">
                    {activeRide.driver.vehicle_color} {activeRide.driver.vehicle_model} • <span className="text-foreground uppercase bg-muted px-1.5 py-0.5 rounded border border-border">{activeRide.driver.plate_number}</span>
                  </p>
                )}
              </div>
              
              {/* Status Badge right side */}
              <div className="text-right shrink-0 min-w-[4.5rem] flex flex-col justify-center items-end">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={passengerBriefing?.eta_text || 'Calculating...'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap"
                  >
                    {passengerBriefing?.eta_text ? (
                      <span className="text-2xl font-bold font-heading text-gold">
                        {passengerBriefing.eta_text}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase animate-pulse">
                        Calculating...
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* EXPANDED CONTENT (Pre-rendered 100% in DOM for 0ms instant 120Hz smooth GPU expansion) */}
            <div 
              className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden flex flex-col gap-6 transform-gpu ${
                isSheetExpanded 
                  ? 'max-h-[600px] opacity-100 pointer-events-auto' 
                  : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
                   {/* Driver Profile Card */}
                   {activeRide.driver && (
                     <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-2xl border border-border">
                        {/* Static Prominent Round Driver Face Image */}
                        <div className="relative group shrink-0 rounded-full">
                          {(typeof activeRide.driver.user?.avatar_url === 'string' && activeRide.driver.user.avatar_url.trim()) ||
                           (typeof activeRide.driver.avatar_url === 'string' && activeRide.driver.avatar_url.trim()) ? (
                            <img 
                              src={activeRide.driver.user?.avatar_url || activeRide.driver.avatar_url} 
                              alt={activeRide.driver.user?.name || 'Driver'} 
                              className="w-16 h-16 rounded-full object-cover border-2 border-gold shadow-lg shadow-gold/20" 
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gold/20 border-2 border-gold flex items-center justify-center">
                              <UserIcon className="w-8 h-8 text-gold" />
                            </div>
                          )}
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
                             className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-foreground active:scale-95 transition-transform"
                             onClick={() => navigate(`/ride/chat/${activeRide.id}`)}
                           >
                             <MessageCircle className="w-5 h-5 text-foreground" />
                           </button>
                           <button 
                             className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-foreground active:scale-95 transition-transform"
                             onClick={() => window.location.href = `tel:${activeRide.driver.user?.phone}`}
                           >
                             <PhoneCall className="w-5 h-5 text-foreground" />
                           </button>
                        </div>
                     </div>
                   )}
                   <div className="bg-muted/40 p-4 rounded-2xl border border-border flex flex-col gap-4">
                      <div className="flex items-start gap-3 relative">
                         <div className="absolute left-[11px] top-6 bottom-[-20px] w-0.5 bg-border border-dashed" />
                         <div className="w-6 h-6 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0 z-10 mt-1">
                           <div className="w-2 h-2 rounded-full bg-white dark:bg-black" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="font-medium text-sm text-foreground line-clamp-1">{activeRide.pickup_location?.address}</p>
                         </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                         <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shrink-0 z-10 mt-1">
                           <div className="w-2 h-2 rounded-full bg-white" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="font-medium text-sm text-foreground line-clamp-1">{activeRide.dropoff_location?.address}</p>
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
                          className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-bold text-base active:scale-95 transition-transform cursor-pointer"
                        >
                          Cancel Ride
                        </button>
                     )}
                     
                     {['accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination', 'ongoing'].includes(activeRide.status) && (
                        <div className="flex items-center gap-2.5 w-full">
                          <button
                            onClick={handleSOS}
                            className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                          >
                            <AlertCircle className="w-5 h-5" />
                            Emergency SOS
                          </button>
                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-bug-report-modal', { detail: { isFromActiveRide: true, locationData: userLocation } }))}
                            className="shrink-0 px-3 py-2 bg-muted hover:bg-muted/80 border border-border text-foreground rounded-xl font-medium text-xs active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 shadow-md"
                          >
                            <Bug className="w-4 h-4 text-foreground" />
                            <span className="text-[10px] leading-none">Report bug</span>
                          </button>
                        </div>
                     )}
                  </div>
                </div>

          </motion.div>
        </div>
        
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
      <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto" data-testid="student-dashboard">
        {/* Top Greeting & Hero Ride Request Feature matching Mockup */}
        <div className="flex flex-col items-center text-center space-y-2 pt-0 pb-1">
          {/* Header Greeting (Bigger typography, clean Hello, smoothly animated gradient on name with !) */}
          <div className="w-full text-left font-heading pb-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
              Hello,{' '}
              <span
                className="animate-name-gradient"
                style={{
                  backgroundImage: getNameGradient(accentColor)
                }}
              >
                {user?.name ? user.name.split(' ')[0] : 'Student'}!
              </span>
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm font-medium mt-1">
              Where Would You Like To Go ?
            </p>
          </div>

          {/* Hero Top-Down Car with Yellow Circle Background (Exact commit 546fe09 drive-under structure) */}
          <div className="relative w-full flex flex-col items-center justify-center pt-8 sm:pt-10 md:pt-12 pb-2 overflow-hidden">
            {/* Yellow/Gold Circle Background (Flat yellow circle with unclipped car) */}
            <div className="relative w-56 h-56 md:w-64 md:h-64 rounded-full bg-amber-400 flex items-center justify-center my-2">
              {/* Top-Down Transparent Car Image (Bigger than circle, overflowing circle cleanly) */}
              <motion.img
                src="/car_top.png"
                alt="Ride Car"
                initial={{ y: 0, scale: 1, opacity: 1 }}
                animate={isDriving ? { y: 450, scale: 0.85, opacity: [1, 1, 0] } : { y: 0, scale: 1, opacity: 1 }}
                transition={{ duration: 0.85, ease: [0.45, 0, 0.55, 1] }}
                className="w-60 md:w-72 h-auto drop-shadow-xl z-10 select-none pointer-events-none absolute"
              />
            </div>

            {/* Subtext Guidance (Positioned above car layer with z-20) */}
            <p className="text-xs md:text-sm text-muted-foreground font-medium mt-10 md:mt-12 mb-4 max-w-xs relative z-20">
              Tap to set your pickup point and destination
            </p>

            {/* Request a Ride Button (Positioned above car layer with z-20 so car drives under it) */}
            <motion.button
              type="button"
              onClick={handleRequestRideClick}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              disabled={isDriving}
              className="w-full max-w-xs py-4 px-8 rounded-2xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-heading font-bold text-base md:text-lg shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 relative z-20"
              data-testid="request-ride-card"
            >
              <span>Request a Ride</span>
            </motion.button>
          </div>
        </div>

        {/* Quick Stats - Standalone Clean Icons without Background Boxes */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard className="p-3.5 sm:p-4" hover={false}>
            <div className="flex items-center gap-3">
              <Car weight="duotone" className="w-7 h-7 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-heading font-bold text-foreground leading-tight">
                  {AppCache.get('history')?.length || recentRides.length}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium whitespace-nowrap mt-0.5">Total Rides</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-3.5 sm:p-4 cursor-pointer hover:border-gold/30 transition-all" hover={false} onClick={() => navigate('/ride')}>
            <div className="flex items-center gap-3">
              <Clock className="w-7 h-7 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-heading font-bold text-foreground leading-tight">{smartWaitTime}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium whitespace-nowrap mt-0.5">Avg. Wait Time</p>
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
              className="text-gold text-sm hover:underline cursor-pointer font-semibold"
            >
              View all
            </button>
          </div>

          {recentRides.length > 0 ? (
            <div className="bg-card rounded-3xl overflow-hidden shadow-lg border border-border">
              {recentRides.slice(0, 3).map((ride) => (
                <SwipableRideCard
                  key={ride.id}
                  ride={ride}
                  isExpanded={expandedRideId === ride.id}
                  onToggleExpand={handleToggleExpand}
                  onDeleteClick={setRideToDelete}
                  onRateClick={(r) => {
                    setRatingRideId(r.id);
                    setDriverName(r.driver?.user?.name || 'Driver');
                    setShowRatingModal(true);
                  }}
                  isDriver={false}
                />
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

        {/* Delete Confirmation Popup Modal */}
        <AnimatePresence>
          {rideToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl backdrop-blur-2xl relative space-y-4"
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                    <Trash2 className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold font-heading text-foreground">Delete Ride Record?</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Are you sure you want to delete this trip from your history?
                    </p>
                  </div>

                  {/* Ride Summary Preview */}
                  <div className="w-full bg-muted/40 border border-border rounded-2xl p-3.5 text-left space-y-1.5 text-xs text-foreground">
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>
                        {new Date(rideToDelete.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      <span className="text-gold font-bold">
                        K{rideToDelete.fare?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <p className="truncate text-muted-foreground">
                      <span className="text-gold font-medium">From:</span> {rideToDelete.pickup_location?.address || 'Pickup'}
                    </p>
                    <p className="truncate text-muted-foreground">
                      <span className="text-emerald-500 font-medium">To:</span> {rideToDelete.dropoff_location?.address || 'Dropoff'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 w-full pt-1">
                    <button
                      type="button"
                      onClick={() => setRideToDelete(null)}
                      className="flex-1 py-3 px-4 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteRide}
                      disabled={deleting}
                      className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                    >
                      {deleting ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <RatingModal
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          setRatingRideId(null);
          AppCache.remove('active_ride');
          fetchData();
        }}
        driverName={driverName}
        rideId={ratingRideId}
        onSubmit={async (data) => {
          try {
            await api.post(`/rides/${ratingRideId}/rate`, data);
            toast.success('Rating submitted successfully');
          } catch (e) {
            console.error('Failed to submit rating:', e);
          }
          setShowRatingModal(false);
          setRatingRideId(null);
          AppCache.remove('active_ride');
          fetchData(); 
        }}
      />

      <DriverPhotoModal
        isOpen={isPhotoModalOpen}
        photoUrl={activeRide?.driver?.user?.avatar_url || activeRide?.driver?.avatar_url}
        driver={activeRide?.driver}
        onClose={() => setIsPhotoModalOpen(false)}
      />


    </Layout>
  );
};

export default StudentDashboard;
