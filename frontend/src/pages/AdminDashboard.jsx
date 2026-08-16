import React, { useState, useEffect } from 'react';
import { UsersThree, SteeringWheel, MapPin, Clock, TrendUp, Warning, Shield, Car } from '@phosphor-icons/react';
import { TrendingUp } from 'lucide-react';
import { GlassCard, LoadingSpinner, StatusBadge } from '../components/common/GlassComponents';
import { RideMap } from '../map/components/RideMap';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminDashboardSkeleton } from '../components/common/PageSkeletons';
import { AdminPushNotifications } from '../components/admin/AdminPushNotifications';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const PIE_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#eab308', '#10b981', '#3b82f6'];

const AdminDashboard = () => {
  const { api, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('DASHBOARD_MOUNTED (Admin)');
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, analyticsRes, activeRidesRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/analytics'),
        api.get('/admin/active-rides')
      ]);
      setStats(statsRes.data);
      setAnalytics(analyticsRes.data);
      setActiveRides(activeRidesRes.data || []);
      console.log('DASHBOARD_RENDER_COMPLETE (Admin)');
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <Layout>
        <AdminDashboardSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6" data-testid="admin-dashboard">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
            <p className="text-muted-foreground text-sm">Platform overview and analytics</p>
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 rounded-full border border-gold/20">
              <Shield weight="duotone" className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Super Admin</span>
            </div>
          )}
          <AdminPushNotifications />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Total Users</p>
                <p className="font-heading text-2xl font-bold text-foreground">
                  {stats?.total_users || 0}
                </p>
              </div>
              <UsersThree weight="duotone" className="w-7 h-7 text-blue-500 shrink-0" />
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Total Drivers</p>
                <p className="font-heading text-2xl font-bold text-foreground">
                  {stats?.total_drivers || 0}
                </p>
                {stats?.pending_drivers > 0 && (
                  <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                    <Warning weight="duotone" className="w-3 h-3" />
                    {stats.pending_drivers} pending
                  </p>
                )}
              </div>
              <SteeringWheel weight="duotone" className="w-7 h-7 text-emerald-500 shrink-0" />
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Total Rides</p>
                <p className="font-heading text-2xl font-bold text-foreground">
                  {stats?.total_rides || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.completed_rides || 0} completed
                </p>
              </div>
              <MapPin weight="duotone" className="w-7 h-7 text-purple-500 shrink-0" />
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Active Rides</p>
                <p className="font-heading text-2xl font-bold text-gold">
                  {stats?.active_rides || 0}
                </p>
              </div>
              <Clock weight="duotone" className="w-7 h-7 text-amber-500 shrink-0" />
            </div>
          </GlassCard>
        </div>


        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-6" hover={false}>
            <h3 className="font-heading font-semibold text-foreground dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Revenue Trends (Last 30 Days)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.revenue_trends?.length === 1 ? [{ date: 'Prev', revenue: 0 }, ...analytics.revenue_trends] : (analytics?.revenue_trends || [])}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--foreground))' }}
                    fontSize={12}
                    tickFormatter={(str) => str === 'Prev' ? '' : str.split('-').slice(1).join('/')}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--foreground))' }} fontSize={12} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: '#EAB308' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#EAB308"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                    isAnimationActive={true}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-6" hover={false}>
            <h3 className="font-heading font-semibold text-foreground dark:text-white mb-6 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              Popular Destinations
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--foreground))' }} />
                  <Pie
                    data={analytics?.popular_destinations || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    labelLine={false}
                    label={({ name, percent, cx, cy, midAngle, outerRadius, fill }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius * 1.2;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={2000}
                    animationEasing="ease-out"
                  >
                    {(analytics?.popular_destinations || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Map and Notifications Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Active Rides Map */}
          {activeRides.length > 0 ? (
            <GlassCard className="p-4" hover={false}>
              <h2 className="font-heading font-semibold text-foreground mb-4">Live Rides</h2>
              <div className="h-64 rounded-xl overflow-hidden mb-4">
                <RideMap
                  center={{ lat: -14.4087, lng: 28.2849 }}
                  zoom={13}
                  className="h-full"
                />
              </div>
              <div className="space-y-3">
                {activeRides.slice(0, 5).map((ride) => (
                  <div key={ride.id} className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <Car weight="duotone" className="w-5 h-5 text-gold shrink-0" />
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {ride.student?.name} → {ride.driver?.user?.name || 'Finding driver'}
                        </p>
                        <p className="text-muted-foreground text-xs">{ride.pickup_location?.address}</p>
                      </div>
                    </div>
                    <StatusBadge status={ride.status} />
                  </div>
                ))}
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-4" hover={false}>
              <h2 className="font-heading font-semibold text-foreground mb-4">Live Rides</h2>
              <div className="h-64 rounded-xl border border-border border-dashed flex items-center justify-center">
                <p className="text-muted-foreground text-sm">No active rides at the moment</p>
              </div>
            </GlassCard>
          )}

          {/* Push Notifications Broadcast Panel */}
          <AdminPushNotifications />
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
