import React, { useState, useEffect } from 'react';
import { Car, Search, Check, X, Star, AlertCircle } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AdminDriversPage = () => {
  const { api } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, approved

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const response = await api.get('/admin/drivers');
      setDrivers(response.data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast.error('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (driverId) => {
    try {
      await api.post(`/admin/drivers/${driverId}/approve`);
      toast.success('Driver approved');
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to approve driver');
    }
  };

  const handleSuspend = async (driverId) => {
    try {
      await api.post(`/admin/drivers/${driverId}/suspend`);
      toast.success('Driver suspended');
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to suspend driver');
    }
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = 
      driver.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.plate_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'pending') return matchesSearch && !driver.is_approved;
    if (filter === 'approved') return matchesSearch && driver.is_approved;
    return matchesSearch;
  });

  const pendingCount = drivers.filter(d => !d.is_approved).length;

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
      <div className="p-4 md:p-8 space-y-6" data-testid="admin-drivers-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
            Driver Management
          </h1>
          <p className="text-white/50">{drivers.length} total drivers</p>
        </div>

        {/* Pending Alert */}
        {pendingCount > 0 && (
          <GlassCard className="p-4 border-yellow-500/30" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{pendingCount} driver(s) pending approval</p>
                <p className="text-white/50 text-sm">Review and approve drivers to let them accept rides</p>
              </div>
              <GoldButton size="sm" onClick={() => setFilter('pending')} data-testid="show-pending-btn">
                Review
              </GoldButton>
            </div>
          </GlassCard>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <GlassInput
              type="text"
              placeholder="Search drivers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12"
              data-testid="search-drivers-input"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'approved'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-gold text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Drivers List */}
        {filteredDrivers.length > 0 ? (
          <div className="space-y-3">
            {filteredDrivers.map((driver) => (
              <GlassCard key={driver.id} className="p-4" data-testid={`driver-card-${driver.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center">
                      <Car className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{driver.user?.name}</p>
                        {driver.is_online && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <p className="text-sm text-white/50">{driver.user?.phone}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span>{driver.vehicle_model}</span>
                        <span>•</span>
                        <span>{driver.vehicle_color}</span>
                        <span>•</span>
                        <span className="font-mono">{driver.plate_number}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-white font-semibold">{driver.total_rides || 0}</p>
                        <p className="text-white/40 text-xs">Rides</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-3 h-3 text-gold" />
                          <p className="text-white font-semibold">{driver.rating?.toFixed(1) || '5.0'}</p>
                        </div>
                        <p className="text-white/40 text-xs">Rating</p>
                      </div>
                    </div>

                    {/* Actions */}
                    {driver.is_approved ? (
                      <button
                        onClick={() => handleSuspend(driver.id)}
                        className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                        data-testid={`suspend-driver-${driver.id}`}
                      >
                        <X className="w-4 h-4 inline mr-1" />
                        Suspend
                      </button>
                    ) : (
                      <GoldButton size="sm" onClick={() => handleApprove(driver.id)} data-testid={`approve-driver-${driver.id}`}>
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </GoldButton>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Car}
            title="No drivers found"
            description={searchQuery ? 'Try a different search term' : 'No drivers registered yet'}
          />
        )}
      </div>
    </Layout>
  );
};

export default AdminDriversPage;
