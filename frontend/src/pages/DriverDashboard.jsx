import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, MapPin, Clock, DollarSign, Star, Navigation, AlertCircle, Bell, Check, X } from 'lucide-react';
import { GlassCard, GoldButton, StatusBadge, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { RideMap } from '../components/map/RideMap';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useWatchPosition } from '../hooks/useGeolocation';
import { toast } from 'sonner';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, api, driverProfile, refreshDriverProfile } = useAuth();
  const { newRideRequest, clearRideRequest, sendLocationUpdate } = useWebSocket();
  
  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [pendingRides, setPendingRides] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showRideRequest, setShowRideRequest] = useState(false);
  const [incomingRide, setIncomingRide] = useState(null);

  // Watch position when online
  const { startWatching, stopWatching, isWatching } = useWatchPosition(
    useCallback((location) => {
      setCurrentLocation(location);
      if (isOnline) {
        sendLocationUpdate(location.lat, location.lng);
        api.post('/drivers/location', {
          latitude: location.lat,
          longitude: location.lng
        }).catch(console.error);
      }
    }, [isOnline, sendLocationUpdate, api]),
    { enableHighAccuracy: true }
  );

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (driverProfile) {
      setIsOnline(driverProfile.is_online);
    }
  }, [driverProfile]);

  useEffect(() => {
    if (isOnline && !isWatching) {
      startWatching();
    } else if (!isOnline && isWatching) {
      stopWatching();
    }
  }, [isOnline, isWatching, startWatching, stopWatching]);

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
            <h2 className="font-heading text-xl font-semibold text-white mb-2">
              Pending Approval
            </h2>
            <p className="text-white/50 mb-6">
              Your driver account is being reviewed. You'll be notified once approved.
            </p>
            <div className="p-4 bg-white/5 rounded-xl text-left">
              <p className="text-sm text-white/60 mb-2">Vehicle Details:</p>
              <p className="text-white">{driverProfile.vehicle_model} • {driverProfile.vehicle_color}</p>
              <p className="text-white/60">{driverProfile.plate_number}</p>
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
                  <h3 className="font-heading font-semibold text-white">New Ride Request!</h3>
                  <p className="text-white/50 text-sm">K{incomingRide.fare?.toFixed(2)} • {incomingRide.distance?.toFixed(1)} km</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-gold mt-1.5" />
                  <div>
                    <p className="text-xs text-white/40">Pickup</p>
                    <p className="text-white text-sm">{incomingRide.pickup_location?.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5" />
                  <div>
                    <p className="text-xs text-white/40">Dropoff</p>
                    <p className="text-white text-sm">{incomingRide.dropoff_location?.address}</p>
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
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-1">
              {isOnline ? 'Ready for Rides' : 'You\'re Offline'}
            </h1>
            <p className="text-white/50">
              {isOnline ? 'Waiting for ride requests...' : 'Go online to start accepting rides'}
            </p>
          </div>
          <button
            onClick={handleToggleOnline}
            className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
              isOnline 
                ? 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]' 
                : 'bg-white/10 hover:bg-white/20'
            }`}
            data-testid="online-toggle"
          >
            <Power className={`w-8 h-8 ${isOnline ? 'text-white' : 'text-white/40'}`} />
            {isOnline && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping" />
            )}
          </button>
        </div>

        {/* Active Ride */}
        {activeRide ? (
          <GlassCard className="overflow-hidden" data-testid="active-ride-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-white text-lg">Active Ride</h2>
              <StatusBadge status={activeRide.status} />
            </div>

            {/* Map */}
            <div className="h-48 -mx-6 mb-4">
              <RideMap
                pickup={activeRide.pickup_location}
                dropoff={activeRide.dropoff_location}
                driverLocation={currentLocation}
                showRoute
                interactive={false}
                className="h-full"
              />
            </div>

            {/* Passenger Info */}
            <div className="p-4 bg-white/5 rounded-xl mb-4">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                  <span className="text-gold font-heading font-bold text-lg">
                    {activeRide.student?.name?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{activeRide.student?.name}</p>
                  <p className="text-sm text-white/50">{activeRide.student?.phone}</p>
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
                  <p className="text-xs text-white/40">Pickup</p>
                  <p className="text-white">{activeRide.pickup_location?.address}</p>
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
                  <p className="text-xs text-white/40">Dropoff</p>
                  <p className="text-white">{activeRide.dropoff_location?.address}</p>
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
              <span className="text-white/60">Your Earning</span>
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
            {/* Earnings Summary */}
            {earnings && (
              <div className="grid grid-cols-2 gap-4">
                <GlassCard className="p-4" hover={false}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-lg font-heading font-bold text-white">
                        K{earnings.today_earnings?.toFixed(2)}
                      </p>
                      <p className="text-xs text-white/40">Today</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4" hover={false}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-lg font-heading font-bold text-white">{earnings.total_rides}</p>
                      <p className="text-xs text-white/40">Total Rides</p>
                    </div>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* Pending Rides */}
            {isOnline && pendingRides.length > 0 && (
              <div>
                <h2 className="font-heading font-semibold text-white text-lg mb-4">Available Rides</h2>
                <div className="space-y-3">
                  {pendingRides.map((ride) => (
                    <GlassCard key={ride.id} className="p-4" data-testid={`pending-ride-${ride.id}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gold font-heading font-bold">K{ride.fare?.toFixed(2)}</span>
                        <span className="text-white/50 text-sm">{ride.distance?.toFixed(1)} km</span>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-gold" />
                          <span className="text-white truncate">{ride.pickup_location?.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-emerald-500" />
                          <span className="text-white/60 truncate">{ride.dropoff_location?.address}</span>
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
              <span className="text-white/60">Your Rating</span>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-gold fill-gold" />
                <span className="font-heading font-bold text-white text-lg">
                  {earnings.rating?.toFixed(1)}
                </span>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    </Layout>
  );
};

export default DriverDashboard;
