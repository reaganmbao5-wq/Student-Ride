import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Car, Star, ChevronRight, Navigation } from 'lucide-react';
import { GlassCard, GoldButton, StatusBadge, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { RideMap } from '../components/map/RideMap';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { toast } from 'sonner';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const { rideUpdate, driverLocation, clearRideUpdate } = useWebSocket();
  const { location: userLocation } = useGeolocation();
  
  const [activeRide, setActiveRide] = useState(null);
  const [recentRides, setRecentRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverPos, setDriverPos] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

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
        toast.success('Ride completed! Don\'t forget to rate your driver.');
        setActiveRide(null);
        fetchData();
      } else if (rideUpdate.type === 'cancelled') {
        toast.error('Ride was cancelled');
        setActiveRide(null);
      }
      clearRideUpdate();
    }
  }, [rideUpdate]);

  useEffect(() => {
    if (driverLocation && activeRide) {
      setDriverPos(driverLocation.location);
    }
  }, [driverLocation, activeRide]);

  const fetchData = async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/rides/active'),
        api.get('/rides/history?limit=5')
      ]);
      
      setActiveRide(activeRes.data);
      setRecentRides(historyRes.data);
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
    } catch (error) {
      toast.error('Failed to cancel ride');
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

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="student-dashboard">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
            Hello, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-white/50">Where would you like to go today?</p>
        </div>

        {/* Active Ride or Request CTA */}
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
                driverLocation={driverPos}
                userLocation={userLocation}
                showRoute
                interactive={false}
                className="h-full"
              />
            </div>

            {/* Locations */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-gold mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/40">Pickup</p>
                  <p className="text-white truncate">{activeRide.pickup_location?.address || 'Selected location'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/40">Dropoff</p>
                  <p className="text-white truncate">{activeRide.dropoff_location?.address || 'Selected location'}</p>
                </div>
              </div>
            </div>

            {/* Driver Info */}
            {activeRide.driver && (
              <div className="p-4 bg-white/5 rounded-xl mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                    <Car className="w-6 h-6 text-gold" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{activeRide.driver.user?.name}</p>
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      <span>{activeRide.driver.vehicle_model}</span>
                      <span>•</span>
                      <span>{activeRide.driver.plate_number}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-gold fill-gold" />
                    <span className="text-white font-medium">{activeRide.driver.rating?.toFixed(1)}</span>
                  </div>
                </div>
                
                {/* Contact Options */}
                <div className="flex gap-2 mt-4">
                  <GoldButton 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/ride/chat/${activeRide.id}`)}
                    data-testid="chat-driver-btn"
                  >
                    Chat
                  </GoldButton>
                  <GoldButton 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => window.location.href = `tel:${activeRide.driver.user?.phone}`}
                    data-testid="call-driver-btn"
                  >
                    Call
                  </GoldButton>
                </div>
              </div>
            )}

            {/* Fare & Actions */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40">Estimated Fare</p>
                <p className="text-xl font-heading font-bold text-gold">K{activeRide.fare?.toFixed(2)}</p>
              </div>
              {activeRide.status === 'requested' && (
                <GoldButton variant="ghost" size="sm" onClick={handleCancelRide} data-testid="cancel-ride-btn">
                  Cancel Ride
                </GoldButton>
              )}
            </div>
          </GlassCard>
        ) : (
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
                <h3 className="font-heading font-semibold text-white text-lg mb-1">Request a Ride</h3>
                <p className="text-white/50 text-sm">Tap to set your pickup and destination</p>
              </div>
              <ChevronRight className="w-6 h-6 text-white/30 group-hover:text-gold transition-colors" />
            </div>
          </GlassCard>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Car className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-white">{recentRides.length}</p>
                <p className="text-xs text-white/40">Total Rides</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-white">5.0</p>
                <p className="text-xs text-white/40">Your Rating</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Recent Rides */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-white text-lg">Recent Rides</h2>
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
                      <Clock className="w-4 h-4 text-white/40" />
                      <span className="text-sm text-white/60">
                        {new Date(ride.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusBadge status={ride.status} />
                  </div>
                  <div className="flex items-center gap-2 text-white mb-1">
                    <MapPin className="w-4 h-4 text-gold shrink-0" />
                    <span className="truncate text-sm">{ride.pickup_location?.address || 'Pickup location'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="truncate text-sm">{ride.dropoff_location?.address || 'Dropoff location'}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-gold font-semibold">K{ride.fare?.toFixed(2)}</span>
                    {ride.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-gold fill-gold" />
                        <span className="text-white/60 text-sm">{ride.rating}</span>
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
    </Layout>
  );
};

export default StudentDashboard;
