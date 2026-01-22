import React, { useState, useEffect } from 'react';
import { Users, Car, MapPin, DollarSign, TrendingUp, Clock, Shield, AlertCircle } from 'lucide-react';
import { GlassCard, LoadingSpinner, StatusBadge } from '../components/common/GlassComponents';
import { RideMap } from '../components/map/RideMap';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { api, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ridesRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/rides?status=ongoing&limit=10')
      ]);
      
      setStats(statsRes.data);
      setActiveRides(ridesRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
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
      <div className="p-4 md:p-8 space-y-6" data-testid="admin-dashboard">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
              Admin Dashboard
            </h1>
            <p className="text-white/50">Platform overview and analytics</p>
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 rounded-full border border-gold/20">
              <Shield className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Super Admin</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/50 text-sm mb-1">Total Users</p>
                <p className="font-heading text-2xl font-bold text-white">
                  {stats?.total_users || 0}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/50 text-sm mb-1">Total Drivers</p>
                <p className="font-heading text-2xl font-bold text-white">
                  {stats?.total_drivers || 0}
                </p>
                {stats?.pending_drivers > 0 && (
                  <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {stats.pending_drivers} pending
                  </p>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Car className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/50 text-sm mb-1">Total Rides</p>
                <p className="font-heading text-2xl font-bold text-white">
                  {stats?.total_rides || 0}
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {stats?.completed_rides || 0} completed
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/50 text-sm mb-1">Active Rides</p>
                <p className="font-heading text-2xl font-bold text-gold">
                  {stats?.active_rides || 0}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-gold" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard className="p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-[50px]" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <p className="text-white/50 text-sm">Total Revenue</p>
                  <p className="font-heading text-3xl font-bold text-white">
                    K{stats?.total_revenue?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px]" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/50 text-sm">Platform Commission</p>
                  <p className="font-heading text-3xl font-bold text-white">
                    K{stats?.total_commission?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-white/40">
                Commission Rate: {stats?.commission_rate || 15}%
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Active Rides Map */}
        {activeRides.length > 0 && (
          <GlassCard className="p-4" hover={false}>
            <h2 className="font-heading font-semibold text-white mb-4">Live Rides</h2>
            <div className="h-64 rounded-xl overflow-hidden mb-4">
              <RideMap
                center={[-14.4087, 28.2849]}
                zoom={13}
                className="h-full"
              />
            </div>
            <div className="space-y-3">
              {activeRides.slice(0, 5).map((ride) => (
                <div key={ride.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                      <Car className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {ride.student?.name} → {ride.driver?.user?.name || 'Finding driver'}
                      </p>
                      <p className="text-white/40 text-xs">{ride.pickup_location?.address}</p>
                    </div>
                  </div>
                  <StatusBadge status={ride.status} />
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
