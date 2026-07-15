import React, { useState, useEffect, useCallback } from 'react';
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

import { RotaryActiveRides } from '../components/driver/RotaryActiveRides';
import { IncomingRequestPanel } from '../components/driver/IncomingRequestPanel';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, api, driverProfile, refreshDriverProfile, logout } = useAuth();
  const { newRideRequest, clearRideRequest, sendLocationUpdate, rideUpdate, driverLocation } = useWebSocket();

  const [isOnline, setIsOnline] = useState(false);
  const [activeRides, setActiveRides] = useState([]);
  const [pendingRides, setPendingRides] = useState([]);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showRideRequest, setShowRideRequest] = useState(false);
  const [incomingRide, setIncomingRide] = useState(null);
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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!rideUpdate) return;
    
    if (rideUpdate.type === 'rating_received') {
      toast.success(`You received a ${rideUpdate.rating}-star rating!`);
      setEarnings(prev => ({ ...prev, rating: rideUpdate.new_average }));
      refreshDriverProfile();
    } else if (rideUpdate.type === 'cancelled') {
      setPendingRides(prev => prev.filter(r => r.id !== rideUpdate.ride_id));
      setActiveRides(prev => prev.filter(r => r.id !== rideUpdate.ride_id));
      if (incomingRide?.id === rideUpdate.ride_id) {
        setShowRideRequest(false);
        setIncomingRide(null);
      }
    } else if (rideUpdate.type === 'accepted') {
      setPendingRides(prev => prev.filter(r => r.id !== rideUpdate.ride?.id));
    } else if (rideUpdate.type === 'wallet_updated') {
      refreshDriverProfile();
    } else if (rideUpdate.type === 'capacity_changed') {
      refreshDriverProfile();
    } else if (rideUpdate.type === 'completed') {
      setActiveRides(prev => prev.filter(r => r.id !== rideUpdate.ride_id));
      fetchData();
    }
  }, [rideUpdate, refreshDriverProfile, incomingRide, fetchData]);

  // Simulation Mode Logic: Just prevents watchPosition from overriding the python script
  useEffect(() => {
    if (isSimulating && isOnline) {
      toast.info("Simulation Mode ON: Python script can now control location safely.");
    }
  }, [isSimulating, isOnline]);

  // When simulating, update our map if the backend broadcasts our simulated location
  useEffect(() => {
    if (isSimulating && driverLocation?.location) {
      setCurrentLocation(driverLocation.location);
    }
  }, [isSimulating, driverLocation]);

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

  useEffect(() => {
    if (newRideRequest && isOnline) {
      // Don't show if vehicle is full
      const capacity = driverProfile?.vehicle_capacity || 4;
      const occupied = activeRides.reduce((acc, r) => acc + (r.passenger_count || 1), 0);
      if (occupied >= capacity) return;

      setIncomingRide(newRideRequest);
      setShowRideRequest(true);

      // Fix for real-time list appearance (Appends instantly)
      setPendingRides(prev => {
        if (!prev.find(r => r.id === newRideRequest.id)) {
          return [newRideRequest, ...prev];
        }
        return prev;
      });

      // Auto-dismiss after 30 seconds
      const timeout = setTimeout(() => {
        setShowRideRequest(false);
        setIncomingRide(null);
        clearRideRequest();
      }, 30000);

      return () => clearTimeout(timeout);
    }
  }, [newRideRequest, isOnline, activeRides, clearRideRequest, driverProfile]);

  useEffect(() => {
    if (activeRides.length > 0) {
      // Just fetch for the first active ride for now to show the primary route
      const primaryRide = activeRides[0];
      if (primaryRide?.pickup_location && primaryRide?.dropoff_location) {
        const cachedGeometry = routeCache.getRoute(primaryRide.pickup_location, primaryRide.dropoff_location);
        if (cachedGeometry) {
          setRouteGeometry(cachedGeometry);
          return;
        }

        api.post('/rides/estimate-fare', {
          pickup: primaryRide.pickup_location,
          dropoff: primaryRide.dropoff_location
        }).then(res => {
          if (res.data?.geometry) {
            setRouteGeometry(res.data.geometry);
            routeCache.setRoute(primaryRide.pickup_location, primaryRide.dropoff_location, res.data.geometry);
          }
        }).catch(err => console.error("Could not fetch route geometry:", err));
      } else {
        setRouteGeometry(null);
      }
    }
  }, [activeRides, api]);

  const formatAddress = (location) => {
    if (!location?.address) return "Location not provided";
    if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(location.address)) {
      return "Current Location";
    }
    return location.address;
  };

  const fetchData = async () => {
    try {
      const [activeRes, earningsRes, pendingRes] = await Promise.all([
        api.get('/rides/driver/active'),
        api.get('/drivers/earnings'),
        api.get('/rides/pending')
      ]);

      setActiveRides(activeRes.data || []);
      setEarnings(earningsRes.data);
      setPendingRides(pendingRes.data || []);
      
      const profile = await refreshDriverProfile();
      if (!profile) {
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
  };

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
      const response = await api.post(`/rides/${rideId}/accept`);
      setActiveRides(prev => [...prev, response.data]);
      setShowRideRequest(false);
      setIncomingRide(null);
      clearRideRequest();
      toast.success('Ride accepted!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept ride');
    }
  };

  const handleDeclineRide = () => {
    setShowRideRequest(false);
    setIncomingRide(null);
    clearRideRequest();
  };

  const handleUpdateStatus = async (rideId, nextStatus) => {
    try {
      const endpointMap = {
        'driver_arrived': 'arrived',
        'ride_started': 'start',
        'ride_completed': 'complete'
      };
      const endpoint = endpointMap[nextStatus];
      if (!endpoint) return;

      const response = await api.post(`/rides/${rideId}/${endpoint}`);
      if (nextStatus === 'ride_completed') {
        toast.success(`Ride completed! Fare: K${response.data.fare}`);
        setActiveRides(prev => prev.filter(r => r.id !== rideId));
        fetchData(); // Refresh earnings
      } else {
        setActiveRides(prev => prev.map(r => r.id === rideId ? { ...r, status: nextStatus } : r));
        toast.success(`Status updated to ${nextStatus.replace(/_/g, ' ')}`);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };



  const handleCancelRide = async (rideId) => {
    try {
      await api.post(`/rides/${rideId}/cancel`);
      toast.info('Ride cancelled');
      setActiveRides(prev => prev.filter(r => r.id !== rideId));
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
  if (activeRides.length > 0) {
    // Markers Logic
    const mapMarkers = [];
    const bounds = [];
    
    // 1. Always show driver car
    const driversArray = currentLocation ? [{ 
      id: 'driver-self', 
      latitude: currentLocation.lat, 
      longitude: currentLocation.lng, 
      heading: currentLocation.heading || 0,
      is_online: true
    }] : [];

    if (currentLocation) bounds.push([currentLocation.lat, currentLocation.lng]);

    // Add markers for all active rides
    activeRides.forEach((ride) => {
      const isArrivedOrStarted = ['driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination', 'ongoing'].includes(ride.status);
      
      if (!isArrivedOrStarted && ride.pickup_location) {
        mapMarkers.push({
          lat: ride.pickup_location.lat,
          lng: ride.pickup_location.lng,
          iconType: 'user', 
          key: `pickup-${ride.id}`
        });
        bounds.push([ride.pickup_location.lat, ride.pickup_location.lng]);
      }

      if (ride.dropoff_location) {
        mapMarkers.push({
          lat: ride.dropoff_location.lat,
          lng: ride.dropoff_location.lng,
          iconType: 'dropoff',
          key: `dropoff-${ride.id}`
        });
        if (isArrivedOrStarted) {
          bounds.push([ride.dropoff_location.lat, ride.dropoff_location.lng]);
        }
      }
    });

    return (
      <div className="fixed inset-0 bg-background overflow-hidden flex flex-col" data-testid="driver-active-ride">
        {/* Map Layer */}
        <div className="flex-1 relative z-0">
          <PlatformMap
            center={currentLocation || { lat: -14.4087, lng: 28.2849 }}
            bounds={bounds.length > 1 ? bounds : null}
            zoom={16}
            markers={mapMarkers}
            drivers={driversArray}
            routeGeometry={routeGeometry}
            showRouteLine={true}
            interactive={true}
            className="w-full h-full"
          />
        </div>

        {/* Incoming Request Overlay */}
        {showRideRequest && incomingRide && (
          <IncomingRequestPanel 
            request={incomingRide} 
            onAccept={handleAcceptRide} 
            onReject={handleDeclineRide} 
            seatsLeft={(driverProfile?.vehicle_capacity || 4) - activeRides.reduce((acc, r) => acc + (r.passenger_count || 1), 0)}
          />
        )}

        {/* Rotary UI Overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <RotaryActiveRides 
            activeRides={activeRides}
            onUpdateStatus={handleUpdateStatus}
            onCall={(phone) => window.location.href = `tel:${phone}`}
            onChat={(studentId) => navigate(`/ride/chat/${activeRides.find(r => r.student?.id === studentId)?.id}`)}
          />
        </div>
      </div>
    );
  }


  // ==========================================
  // STANDARD DASHBOARD VIEW (NO ACTIVE RIDE)
  // ==========================================
  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="driver-dashboard">
        {/* Incoming Ride Request Panel handled globally, but here is fallback for idle state */}
        {showRideRequest && incomingRide && (
          <IncomingRequestPanel 
            request={incomingRide} 
            onAccept={handleAcceptRide} 
            onReject={handleDeclineRide} 
            seatsLeft={driverProfile?.vehicle_capacity || 4}
          />
        )}

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
                <GlassCard key={ride.id} className="p-4" data-testid={`pending-ride-${ride.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gold font-heading font-bold">K{ride.fare?.toFixed(2)}</span>
                    <span className="text-muted-foreground text-sm">{ride.distance?.toFixed(1)} km</span>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gold" />
                      <span className="text-foreground truncate">{ride.pickup_location?.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      <span className="text-muted-foreground truncate">{ride.dropoff_location?.address}</span>
                    </div>
                  </div>
                  <GoldButton
                    size="sm"
                    className="w-full"
                    onClick={() => handleAcceptRide(ride.id)}
                  >
                    Accept Ride
                  </GoldButton>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {isOnline && pendingRides.length === 0 && activeRides.length === 0 && (
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
