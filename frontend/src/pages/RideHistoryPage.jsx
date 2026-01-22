import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Star, Car } from 'lucide-react';
import { GlassCard, LoadingSpinner, StatusBadge, EmptyState, RatingStars } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';

const RideHistoryPage = () => {
  const { api, isDriver } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/rides/history?limit=50');
      setRides(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
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
      <div className="p-4 md:p-8 space-y-6" data-testid="ride-history-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
            Ride History
          </h1>
          <p className="text-white/50">{rides.length} trips</p>
        </div>

        {/* Rides List */}
        {rides.length > 0 ? (
          <div className="space-y-4">
            {rides.map((ride) => (
              <GlassCard key={ride.id} className="p-4" data-testid={`history-ride-${ride.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white/60">
                      {new Date(ride.created_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <StatusBadge status={ride.status} />
                </div>

                {/* Locations */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-gold mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/40">Pickup</p>
                      <p className="text-white text-sm truncate">
                        {ride.pickup_location?.address || 'Location'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/40">Dropoff</p>
                      <p className="text-white text-sm truncate">
                        {ride.dropoff_location?.address || 'Location'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Section */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-4">
                    {/* Driver/Student Info */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                        <Car className="w-4 h-4 text-white/40" />
                      </div>
                      <div>
                        <p className="text-sm text-white">
                          {isDriver ? ride.student?.name : ride.driver?.user?.name || 'Driver'}
                        </p>
                        <p className="text-xs text-white/40">
                          {isDriver ? 'Passenger' : ride.driver?.plate_number || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Rating */}
                    {ride.status === 'completed' && (
                      <div className="flex items-center gap-1">
                        {ride.rating ? (
                          <>
                            <Star className="w-4 h-4 text-gold fill-gold" />
                            <span className="text-white text-sm">{ride.rating}</span>
                          </>
                        ) : !isDriver && (
                          <span className="text-xs text-white/40">Not rated</span>
                        )}
                      </div>
                    )}

                    {/* Fare */}
                    <div className="text-right">
                      <p className="text-gold font-heading font-bold">
                        K{isDriver ? ride.driver_earning?.toFixed(2) : ride.fare?.toFixed(2)}
                      </p>
                      <p className="text-xs text-white/40">{ride.distance?.toFixed(1)} km</p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Clock}
            title="No ride history"
            description="Your completed rides will appear here"
          />
        )}
      </div>
    </Layout>
  );
};

export default RideHistoryPage;
