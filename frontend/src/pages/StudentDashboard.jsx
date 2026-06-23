import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Car, Star, ChevronRight, Navigation, AlertCircle } from 'lucide-react';
import { GlassCard, GoldButton, StatusBadge, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { RatingModal } from '../components/common/RatingModal';
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

        {/* Active Ride or Request CTA */}
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
                driverLocation={driverPos}
                userLocation={userLocation}
                routeGeometry={activeRide.verified_geometry}
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
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-foreground truncate">{activeRide.pickup_location?.address || 'Selected location'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="text-foreground truncate">{activeRide.dropoff_location?.address || 'Selected location'}</p>
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
                    <p className="font-medium text-foreground">{activeRide.driver.user?.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{activeRide.driver.vehicle_color} {activeRide.driver.vehicle_model}</span>
                      <span>•</span>
                      <span>{activeRide.driver.plate_number}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-gold fill-gold" />
                    <span className="text-foreground font-medium">{activeRide.driver.rating?.toFixed(1)}</span>
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
                <p className="text-xs text-muted-foreground">Estimated Fare</p>
                <p className="text-xl font-heading font-bold text-gold">K{activeRide.fare?.toFixed(2)}</p>
              </div>
              {['requested', 'accepted', 'driver_arrived'].includes(activeRide.status) && (
                <GoldButton variant="ghost" size="sm" onClick={handleCancelRide} data-testid="cancel-ride-btn" className="text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors">
                  Cancel Ride
                </GoldButton>
              )}
            </div>

            {/* Emergency SOS Button */}
            {['accepted', 'driver_arrived', 'ongoing'].includes(activeRide.status) && (
              <div className="mt-4">
                <button
                  onClick={handleSOS}
                  className="w-full group relative overflow-hidden rounded-2xl bg-red-600/10 border border-red-500/20 p-4 transition-all hover:bg-red-600/20 active:scale-95"
                >
                  <div className="absolute inset-0 bg-red-600/5 animate-pulse" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40">
                        <AlertCircle className="w-6 h-6 text-foreground animate-bounce" />
                      </div>
                      <div className="text-left">
                        <p className="text-red-500 font-bold text-sm uppercase tracking-wider">Emergency SOS</p>
                        <p className="text-muted-foreground text-[10px]">Alerts admins & calls 911 equivalent</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-red-600/20 text-red-500 text-[10px] font-bold border border-red-500/30 group-hover:bg-red-500 group-hover:text-white transition-colors">
                      TRIGGER NOW
                    </div>
                  </div>
                </button>
              </div>
            )}
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
                <h3 className="font-heading font-semibold text-foreground text-lg mb-1">Request a Ride</h3>
                <p className="text-muted-foreground text-sm">Tap to set your pickup and destination</p>
              </div>
              <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-gold transition-colors" />
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
          fetchData(); // Refresh history with new rating
        }}
      />
    </Layout >
  );
};

export default StudentDashboard;
