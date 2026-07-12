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
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">
            Ride Management
          </h1>
          <p className="text-muted-foreground">{rides.length} total rides</p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30" />
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
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize whitespace-nowrap transition-colors ${statusFilter === status
                  ? 'bg-gold text-black'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(ride.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${ride.ride_mode === 'shared' ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground'}`}>
                          {ride.ride_mode === 'shared' ? 'Shared' : 'Private'}
                        </span>
                        <StatusBadge status={ride.status} />
                      </div>
                    </div>

                    {/* Locations */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-gold shrink-0" />
                        <span className="text-foreground truncate">{ride.pickup_location?.address || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-muted-foreground truncate">{ride.dropoff_location?.address || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Users */}
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Student:</span>
                        <span className="text-foreground ml-1">{ride.student?.name || 'N/A'}</span>
                      </div>
                      {ride.driver && (
                        <div>
                          <span className="text-muted-foreground">Driver:</span>
                          <span className="text-foreground ml-1">{ride.driver.user?.name || 'N/A'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fare Info */}
                  <div className="flex items-center gap-6 lg:border-l lg:border-muted-foreground/10 lg:pl-6">
                    <div className="text-center">
                      <p className="text-lg font-heading font-bold text-gold">K{ride.fare?.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Fare</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-heading font-bold text-foreground">{ride.distance?.toFixed(1)} km</p>
                      <p className="text-xs text-muted-foreground">Distance</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-heading font-bold text-emerald-400">K{ride.commission?.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Commission</p>
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
