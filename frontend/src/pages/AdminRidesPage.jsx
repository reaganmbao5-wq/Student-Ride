import React, { useState, useEffect } from 'react';
import { MapPin, Search, Calendar } from 'lucide-react';
import { GlassCard, GlassInput, LoadingSpinner, StatusBadge, EmptyState } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AdminRidesPage = () => {
  const { api } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchRides();
  }, [statusFilter]);

  const fetchRides = async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await api.get(`/admin/rides${params}`);
      setRides(response.data);
    } catch (error) {
      console.error('Error fetching rides:', error);
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  const filteredRides = rides.filter(ride => {
    const searchLower = searchQuery.toLowerCase();
    return (
      ride.student?.name?.toLowerCase().includes(searchLower) ||
      ride.driver?.user?.name?.toLowerCase().includes(searchLower) ||
      ride.pickup_location?.address?.toLowerCase().includes(searchLower) ||
      ride.dropoff_location?.address?.toLowerCase().includes(searchLower)
    );
  });

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
      <div className="p-4 md:p-8 space-y-6" data-testid="admin-rides-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
            Ride Management
          </h1>
          <p className="text-white/50">{rides.length} total rides</p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <GlassInput
              type="text"
              placeholder="Search rides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12"
              data-testid="search-rides-input"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['all', 'requested', 'ongoing', 'completed', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? 'bg-gold text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Rides List */}
        {filteredRides.length > 0 ? (
          <div className="space-y-3">
            {filteredRides.map((ride) => (
              <GlassCard key={ride.id} className="p-4" data-testid={`ride-card-${ride.id}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Ride Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-white/40" />
                        <span className="text-sm text-white/60">
                          {new Date(ride.created_at).toLocaleString()}
                        </span>
                      </div>
                      <StatusBadge status={ride.status} />
                    </div>

                    {/* Locations */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-gold shrink-0" />
                        <span className="text-white truncate">{ride.pickup_location?.address || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-white/60 truncate">{ride.dropoff_location?.address || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Users */}
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-white/40">Student:</span>
                        <span className="text-white ml-1">{ride.student?.name || 'N/A'}</span>
                      </div>
                      {ride.driver && (
                        <div>
                          <span className="text-white/40">Driver:</span>
                          <span className="text-white ml-1">{ride.driver.user?.name || 'N/A'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fare Info */}
                  <div className="flex items-center gap-6 lg:border-l lg:border-white/10 lg:pl-6">
                    <div className="text-center">
                      <p className="text-lg font-heading font-bold text-gold">K{ride.fare?.toFixed(2)}</p>
                      <p className="text-xs text-white/40">Fare</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-heading font-bold text-white">{ride.distance?.toFixed(1)} km</p>
                      <p className="text-xs text-white/40">Distance</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-heading font-bold text-emerald-400">K{ride.commission?.toFixed(2)}</p>
                      <p className="text-xs text-white/40">Commission</p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MapPin}
            title="No rides found"
            description={searchQuery ? 'Try a different search term' : 'No rides yet'}
          />
        )}
      </div>
    </Layout>
  );
};

export default AdminRidesPage;
