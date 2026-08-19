import React, { useState, useEffect } from 'react';
import { CurrencyCircleDollar, TrendUp, Shield, CheckCircle } from '@phosphor-icons/react';
import { TrendingUp } from 'lucide-react';
import { GlassCard } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminDashboardSkeleton } from '../components/common/PageSkeletons';
import { AppCache } from '../utils/AppCache';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const AccountantDashboard = () => {
  const { api } = useAuth();
  const [stats, setStats] = useState(() => AppCache.get('accountant_stats') || null);
  const [analytics, setAnalytics] = useState(() => AppCache.get('accountant_analytics') || null);
  const [loading, setLoading] = useState(() => !AppCache.get('accountant_stats'));

  useEffect(() => {
    fetchData(Boolean(AppCache.get('accountant_stats')));
    const interval = setInterval(() => fetchData(true), 20000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground && !stats) setLoading(true);
      const [statsRes, analyticsRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/admin/analytics')
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStats(statsRes.value.data);
        AppCache.set('accountant_stats', statsRes.value.data);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.data) {
        setAnalytics(analyticsRes.value.data);
        AppCache.set('accountant_analytics', analyticsRes.value.data);
      }
    } catch (error) {
      console.error('Error fetching accountant data:', error);
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
    : [{ date: 'Today', revenue: 0, gross_fare: 0, rides: 0 }];

  const totalGross = stats?.total_gross_volume || 0;
  const totalNet = stats?.total_revenue || 0;
  const driverPayouts = Math.max(0, totalGross - totalNet);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Accountant Financial Suite</h1>
            <p className="text-muted-foreground text-sm">Audited platform cash flows, commission ledger & driver settlements</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 rounded-full border border-gold/20 text-gold text-xs font-semibold">
              <Shield weight="duotone" className="w-4 h-4" />
              Audited Financial Access
            </div>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Gross Fare Volume */}
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Gross Fare Volume</p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                  ZMW {totalGross.toFixed(2)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">100% total rider expenditure</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <CurrencyCircleDollar weight="duotone" className="w-6 h-6 text-blue-500 shrink-0" />
              </div>
            </div>
          </GlassCard>

          {/* Platform Net Profit (Commission) */}
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Platform Commission (10%)</p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-gold">
                  ZMW {totalNet.toFixed(2)}
                </p>
                <p className="text-[11px] text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Net platform retained revenue
                </p>
              </div>
              <div className="p-3 bg-gold/10 rounded-2xl border border-gold/20">
                <TrendUp weight="duotone" className="w-6 h-6 text-gold shrink-0" />
              </div>
            </div>
          </GlassCard>

          {/* Total Driver Payouts (90%) */}
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">Driver Earnings (90%)</p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-emerald-400">
                  ZMW {driverPayouts.toFixed(2)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">Disbursed/retained by active drivers</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <CheckCircle weight="duotone" className="w-6 h-6 text-emerald-500 shrink-0" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Revenue Trends Chart */}
        <GlassCard className="p-6 border border-border/60" hover={false}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-heading font-bold text-foreground flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-gold" />
                Revenue & Profit Trajectory
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily audited platform profit volume</p>
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
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(val) => `K${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))' }}
                  formatter={(val) => [`ZMW ${Number(val).toFixed(2)}`, 'Platform Profit']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#EAB308" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </Layout>
  );
};

export default AccountantDashboard;
