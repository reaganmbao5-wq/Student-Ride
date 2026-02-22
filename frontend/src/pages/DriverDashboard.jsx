import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, MapPin, Clock, DollarSign, Star, Navigation, AlertCircle, Bell, Check, X, Upload, FileText } from 'lucide-react';
import { GlassCard, GoldButton, StatusBadge, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { RideMap } from '../components/map/RideMap';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useWatchPosition } from '../hooks/useGeolocation';
import { toast } from 'sonner';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, api, driverProfile, refreshDriverProfile, logout } = useAuth();
  const { newRideRequest, clearRideRequest, sendLocationUpdate, rideUpdate } = useWebSocket();

  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [pendingRides, setPendingRides] = useState([]);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showRideRequest, setShowRideRequest] = useState(false);
  const [incomingRide, setIncomingRide] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [uploading, setUploading] = useState(false);


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
    if (rideUpdate && rideUpdate.type === 'rating_received') {
      toast.success(`You received a ${rideUpdate.rating}-star rating!`);
      // Update earnings state directly or fetch fresh data
      setEarnings(prev => ({ ...prev, rating: rideUpdate.new_average }));
      // Also refresh profile to ensure consistency
      refreshDriverProfile();
    }
  }, [rideUpdate, refreshDriverProfile]);

  // Simulation Logic
  useEffect(() => {
    let interval;
    if (isSimulating && isOnline) {
      interval = setInterval(() => {
        setCurrentLocation(prev => {
          // Default to Kabwe center if no location
          const baseLat = prev?.lat || -14.42;
          const baseLng = prev?.lng || 28.45;

          // Simulate small movement (approx 10m northeast)
          const newLat = baseLat + 0.0001;
          const newLng = baseLng + 0.0001;

          const newLoc = { lat: newLat, lng: newLng };

          // Send update via WS
          sendLocationUpdate(newLat, newLng);

          // Also update backend occasionally if needed, but WS is primary for live tracking
          return newLoc;
        });
      }, 2000); // Update every 2 seconds
    }
    return () => clearInterval(interval);
  }, [isSimulating, isOnline, sendLocationUpdate]);

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
    if (newRideRequest && isOnline && !activeRide) {
      setIncomingRide(newRideRequest);
      setShowRideRequest(true);

      // Auto-dismiss after 30 seconds
      const timeout = setTimeout(() => {
        setShowRideRequest(false);
        setIncomingRide(null);
        clearRideRequest();
      }, 30000);

      return () => clearTimeout(timeout);
    }
  }, [newRideRequest, isOnline, activeRide, clearRideRequest]);

  useEffect(() => {
    if (activeRide?.pickup_location && activeRide?.dropoff_location) {
      api.post('/rides/estimate-fare', {
        pickup: activeRide.pickup_location,
        dropoff: activeRide.dropoff_location
      }).then(res => {
        if (res.data?.geometry) {
          setRouteGeometry(res.data.geometry);
        }
      }).catch(err => console.error("Could not fetch route geometry:", err));
    } else {
      setRouteGeometry(null);
    }
  }, [activeRide?.id, activeRide?.pickup_location, activeRide?.dropoff_location, api]);

  const formatAddress = (location) => {
    if (!location?.address) return "Location not provided";
    // Check if address is just coordinates (e.g., "-29.8486, 31.0049" or similar)
    if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(location.address)) {
      return "Current Location";
    }
    return location.address;
  };

  const fetchData = async () => {
    try {
      const [activeRes, earningsRes, pendingRes] = await Promise.all([
        api.get('/rides/active'),
        api.get('/drivers/earnings'),
        api.get('/rides/pending')
      ]);

      setActiveRide(activeRes.data);
      setEarnings(earningsRes.data);
      setPendingRides(pendingRes.data || []);
      await refreshDriverProfile();
    } catch (error) {
      console.error('Error fetching data:', error);
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
      setActiveRide(response.data);
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

  const handleDriverArrived = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/arrived`);
      setActiveRide(prev => ({ ...prev, status: 'driver_arrived' }));
      toast.success('Passenger notified of your arrival');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/start`);
      setActiveRide(prev => ({ ...prev, status: 'ongoing' }));
      toast.success('Ride started');
    } catch (error) {
      toast.error('Failed to start ride');
    }
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    try {
      const response = await api.post(`/rides/${activeRide.id}/complete`);
      toast.success(`Ride completed! Fare: K${response.data.fare}`);
      setActiveRide(null);
      fetchData(); // Refresh earnings
    } catch (error) {
      toast.error('Failed to complete ride');
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/cancel`);
      toast.info('Ride cancelled');
      setActiveRide(null);
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

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="driver-dashboard">
        {/* Incoming Ride Request Modal */}
        {showRideRequest && incomingRide && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <GlassCard className="w-full max-w-md p-6 animate-in slide-in-from-bottom" data-testid="ride-request-modal">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center animate-pulse-gold">
                  <Bell className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground">New Ride Request!</h3>
                  <p className="text-muted-foreground text-sm">K{incomingRide.fare?.toFixed(2)} • {incomingRide.distance?.toFixed(1)} km</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-gold mt-1.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="text-foreground text-sm">{incomingRide.pickup_location?.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="text-foreground text-sm">{incomingRide.dropoff_location?.address}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <GoldButton
                  variant="secondary"
                  className="flex-1"
                  onClick={handleDeclineRide}
                  data-testid="decline-ride-btn"
                >
                  <X className="w-5 h-5 mr-2" />
                  Decline
                </GoldButton>
                <GoldButton
                  className="flex-1"
                  onClick={() => handleAcceptRide(incomingRide.id)}
                  data-testid="accept-ride-btn"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Accept
                </GoldButton>
              </div>
            </GlassCard>
          </div>
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
                className={`text-xs px-2 py-1 rounded-lg border transition-colors ${isSimulating
                  ? 'bg-gold/20 border-gold text-gold'
                  : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
              >
                {isSimulating ? 'Simulating...' : 'Test GPS'}
              </button>
            )}
          </div>
        </div>

        {/* Active Ride */}
        {activeRide ? (
          <GlassCard className="overflow-hidden" data-testid="active-ride-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-foreground text-lg">Active Ride</h2>
              <StatusBadge status={activeRide.status} />
            </div>

            {/* Map */}
            <div className="h-48 -mx-6 mb-4">
              <RideMap
                pickup={activeRide.pickup_location}
                dropoff={activeRide.dropoff_location}
                driverLocation={currentLocation}
                routeGeometry={routeGeometry}
                showRoute
                interactive={false}
                className="h-full"
              />
            </div>

            {/* Passenger Info */}
            <div className="p-4 bg-muted rounded-xl mb-4 border border-border">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                  <span className="text-gold font-heading font-bold text-lg">
                    {activeRide.student?.name?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{activeRide.student?.name || 'Passenger'}</p>
                  <p className="text-sm text-muted-foreground">{activeRide.student?.phone || 'No phone provided'}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <GoldButton
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/ride/chat/${activeRide.id}`)}
                  data-testid="chat-passenger-btn"
                >
                  Chat
                </GoldButton>
                <GoldButton
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.location.href = `tel:${activeRide.student?.phone}`}
                  data-testid="call-passenger-btn"
                >
                  Call
                </GoldButton>
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-gold mt-1.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-foreground">{formatAddress(activeRide.pickup_location)}</p>
                </div>
                {activeRide.status === 'accepted' && (
                  <GoldButton
                    size="icon"
                    variant="ghost"
                    onClick={() => openNavigation(activeRide.pickup_location)}
                    data-testid="navigate-pickup-btn"
                  >
                    <Navigation className="w-5 h-5" />
                  </GoldButton>
                )}
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="text-foreground">{formatAddress(activeRide.dropoff_location)}</p>
                </div>
                {activeRide.status === 'ongoing' && (
                  <GoldButton
                    size="icon"
                    variant="ghost"
                    onClick={() => openNavigation(activeRide.dropoff_location)}
                    data-testid="navigate-dropoff-btn"
                  >
                    <Navigation className="w-5 h-5" />
                  </GoldButton>
                )}
              </div>
            </div>

            {/* Fare */}
            <div className="flex items-center justify-between p-4 bg-gold/10 rounded-xl mb-4">
              <span className="text-muted-foreground">Your Earning</span>
              <span className="font-heading font-bold text-gold text-xl">
                K{activeRide.driver_earning?.toFixed(2)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {activeRide.status === 'accepted' && (
                <>
                  <GoldButton variant="secondary" className="flex-1" onClick={handleCancelRide}>
                    Cancel
                  </GoldButton>
                  <GoldButton className="flex-1" onClick={handleDriverArrived} data-testid="arrived-btn">
                    I've Arrived
                  </GoldButton>
                </>
              )}
              {activeRide.status === 'driver_arrived' && (
                <GoldButton className="w-full" onClick={handleStartRide} data-testid="start-ride-btn">
                  Start Ride
                </GoldButton>
              )}
              {activeRide.status === 'ongoing' && (
                <GoldButton className="w-full" onClick={handleCompleteRide} data-testid="complete-ride-btn">
                  Complete Ride
                </GoldButton>
              )}
            </div>
          </GlassCard>
        ) : (
          <>
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
            {isOnline && pendingRides.length === 0 && !activeRide && (
              <EmptyState
                icon={MapPin}
                title="No rides available"
                description="Stay online, new ride requests will appear here"
              />
            )}
          </>
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
