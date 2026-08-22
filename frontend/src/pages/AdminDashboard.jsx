import React, { useState, useEffect } from 'react';
import { UsersThree, SteeringWheel, MapPin, Clock, TrendUp, Warning, Shield, Car, CheckCircle, CurrencyCircleDollar, Broadcast, Flame } from '@phosphor-icons/react';
import { TrendingUp, Activity, Radio, MapPin as MapPinIcon, Navigation } from 'lucide-react';
import { GlassCard, StatusBadge } from '../components/common/GlassComponents';
import { PlatformMap } from '../map/components/PlatformMap';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminDashboardSkeleton } from '../components/common/PageSkeletons';
import { AdminPushNotifications } from '../components/admin/AdminPushNotifications';
import { AppCache } from '../utils/AppCache';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const AdminDashboard = () => {
  const { api, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState(() => AppCache.get('admin_stats') || null);
  const [analytics, setAnalytics] = useState(() => AppCache.get('admin_analytics') || null);
  const [activeRides, setActiveRides] = useState(() => AppCache.get('admin_active_rides') || []);
  const [loading, setLoading] = useState(() => !AppCache.get('admin_stats'));

  useEffect(() => {
    console.log('DASHBOARD_MOUNTED (Admin)');
    fetchData(Boolean(AppCache.get('admin_stats')));
    const interval = setInterval(() => fetchData(true), 15000); // Silent refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground && !stats) setLoading(true);
      const [statsRes, analyticsRes, activeRidesRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/admin/analytics'),
        api.get('/admin/active-rides')
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStats(statsRes.value.data);
        AppCache.set('admin_stats', statsRes.value.data);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.data) {
        setAnalytics(analyticsRes.value.data);
        AppCache.set('admin_analytics', analyticsRes.value.data);
      }
      if (activeRidesRes.status === 'fulfilled' && activeRidesRes.value?.data) {
        setActiveRides(activeRidesRes.value.data);
        AppCache.set('admin_active_rides', activeRidesRes.value.data);
      }
      console.log('DASHBOARD_RENDER_COMPLETE (Admin)');
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <Layout>
        <AdminDashboardSkeleton />
      </Layout>
    );
  }

  const revenueData = analytics?.revenue_trends && analytics.revenue_trends.length > 0
    ? analytics.revenue_trends
    : [
        { date: 'Today', revenue: 0, gross_fare: 0, rides: 0 }
      ];

  const popularDestinations = analytics?.popular_destinations && analytics.popular_destinations.length > 0
    ? analytics.popular_destinations
    : [
        { name: 'Campus Library', value: 24 },
        { name: 'Main Campus Gate', value: 18 },
        { name: 'Student Hostels', value: 14 },
        { name: 'Science Complex', value: 11 }
      ];

  const maxVisits = Math.max(...popularDestinations.map(d => d.value), 1);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" data-testid="admin-dashboard">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Admin Overview</h1>
            <p className="text-muted-foreground text-sm">Real-time platform metrics, live operations & revenue performance</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 rounded-full border border-gold/20">
                <Shield weight="duotone" className="w-4 h-4 text-gold" />
                <span className="text-gold text-xs md:text-sm font-semibold">Super Admin</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-500 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Total Users</p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                  {stats?.total_users || 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">Registered accounts</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <UsersThree weight="duotone" className="w-6 h-6 text-blue-500 shrink-0" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Total Drivers</p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                  {stats?.total_drivers || 0}
                </p>
                {stats?.pending_drivers > 0 ? (
                  <p className="text-xs text-yellow-400 font-medium flex items-center gap-1 mt-1.5">
                    <Warning weight="duotone" className="w-3.5 h-3.5" />
                    {stats.pending_drivers} awaiting approval
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1.5">
                    <CheckCircle weight="duotone" className="w-3.5 h-3.5" />
                    All drivers approved
                  </p>
                )}
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <SteeringWheel weight="duotone" className="w-6 h-6 text-emerald-500 shrink-0" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Total Completed Rides</p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                  {stats?.completed_rides || 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  out of {stats?.total_rides || 0} total requests
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <MapPin weight="duotone" className="w-6 h-6 text-purple-500 shrink-0" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Active Ongoing Rides</p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-gold">
                  {stats?.active_rides || 0}
                </p>
                <p className="text-[11px] text-amber-400/90 font-medium mt-1.5 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  Live on campus
                </p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                <Clock weight="duotone" className="w-6 h-6 text-amber-500 shrink-0" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Analytics & Top Places Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Revenue Trends (7 cols) */}
          <GlassCard className="lg:col-span-7 p-6 border border-border/60" hover={false}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading font-bold text-foreground flex items-center gap-2 text-base">
                  <TrendingUp className="w-5 h-5 text-gold" />
                  Platform Revenue Trends (Profit Commission)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Calculated from 10% platform commission</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-gold px-2.5 py-1 bg-gold/10 rounded-lg border border-gold/20 block">
                  Profit: ZMW {stats?.total_revenue?.toFixed(2) || '0.00'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Gross: ZMW {stats?.total_gross_volume?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EAB308" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#EAB308" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    fontSize={11}
                    tickFormatter={(str) => (str && str.includes('-') ? str.split('-').slice(1).join('/') : str)}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    fontSize={11}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(val) => `K${val}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: '#EAB308' }}
                    formatter={(val) => [`ZMW ${Number(val).toFixed(2)}`, 'Platform Profit']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#EAB308"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                    isAnimationActive={true}
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Frequently Visited Places / Campus Hotspots (5 cols) */}
          <GlassCard className="lg:col-span-5 p-6 border border-border/60 flex flex-col" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" weight="duotone" />
                <h3 className="font-heading font-bold text-foreground text-base">Frequently Visited Places</h3>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">Top Campus Hotspots</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[290px] pr-1">
              {popularDestinations.map((dest, idx) => {
                const percentage = Math.round((dest.value / maxVisits) * 100);
                return (
                  <div key={dest.name || idx} className="p-3 bg-muted/40 rounded-2xl border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-foreground truncate max-w-[200px]">
                        <span className="w-5 h-5 rounded-lg bg-gold/10 text-gold flex items-center justify-center text-[10px] font-mono shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="truncate">{dest.name}</span>
                      </div>
                      <span className="font-bold text-gold shrink-0">{dest.value} trips</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-gold to-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(15, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        {/* Live Operations & Push Notifications Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Rides Mapbox Map */}
          <GlassCard className="p-5 border border-border/60 flex flex-col" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
                <h2 className="font-heading font-bold text-foreground text-base">Live Active Operations</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-gold/10 text-gold rounded-full border border-gold/20">
                {activeRides.length} {activeRides.length === 1 ? 'Trip' : 'Trips'} Active
              </span>
            </div>

            {/* Mapbox Platform Map Container */}
            <div className="h-72 w-full rounded-2xl overflow-hidden border border-border relative mb-4">
              <PlatformMap
                center={{ lat: -14.294896006738625, lng: 28.55979849713035 }}
                zoom={13.5}
                interactive={true}
                className="w-full h-full"
              />
            </div>

            {/* Active Rides Feed */}
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-56 pr-1">
              {activeRides.length > 0 ? (
                activeRides.map((ride) => (
                  <div key={ride.id} className="flex items-center justify-between p-3.5 bg-muted/50 hover:bg-muted/80 transition-colors rounded-2xl border border-border text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                        <Car weight="duotone" className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-foreground font-bold">
                          {ride.student?.name || 'Student'} → {ride.driver?.user?.name || 'Assigned Driver'}
                        </p>
                        <p className="text-muted-foreground text-[11px] truncate max-w-[220px]">
                          {ride.pickup_location?.name || ride.pickup_location?.address} → {ride.dropoff_location?.name || ride.dropoff_location?.address}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={ride.status} />
                      <p className="text-[11px] font-bold text-gold mt-1">ZMW {ride.fare?.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-muted-foreground text-xs rounded-2xl bg-muted/20 border border-border border-dashed">
                  No active rides ongoing at this moment
                </div>
              )}
            </div>
          </GlassCard>

          {/* Broadcast Push Notifications */}
          <AdminPushNotifications />
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
