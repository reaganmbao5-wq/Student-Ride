import React, { useState, useEffect } from 'react';
import { CurrencyCircleDollar, TrendUp, Clock, Star, CalendarBlank } from '@phosphor-icons/react';
import { GlassCard, LoadingSpinner } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { DriverEarningsSkeleton } from '../components/common/PageSkeletons';

const DriverEarningsPage = () => {
  const { api } = useAuth();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const response = await api.get('/drivers/earnings');
      setEarnings(response.data);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DriverEarningsSkeleton />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="driver-earnings-page">
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">
            Earnings
          </h1>
          <p className="text-muted-foreground">Track your income and performance</p>
        </div>

        {/* Total Earnings Card */}
        <GlassCard className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-full blur-[60px]" />
          <div className="relative z-10">
            <p className="text-muted-foreground/80 mb-2">Total Earnings</p>
            <p className="font-heading text-4xl md:text-5xl font-bold text-gold mb-4">
              K{earnings?.total_earnings?.toFixed(2) || '0.00'}
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <TrendUp weight="duotone" className="w-4 h-4" />
              <span>All time earnings</span>
            </div>
          </div>
        </GlassCard>

        {/* Period Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <CurrencyCircleDollar weight="duotone" className="w-5 h-5 text-gold" />
              </div>
              <span className="text-muted-foreground text-sm">Today</span>
            </div>
            <p className="font-heading text-2xl font-bold text-foreground">
              K{earnings?.today_earnings?.toFixed(2) || '0.00'}
            </p>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CalendarBlank weight="duotone" className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-muted-foreground text-sm">This Week</span>
            </div>
            <p className="font-heading text-2xl font-bold text-foreground">
              K{earnings?.week_earnings?.toFixed(2) || '0.00'}
            </p>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendUp weight="duotone" className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-muted-foreground text-sm">This Month</span>
            </div>
            <p className="font-heading text-2xl font-bold text-foreground">
              K{earnings?.month_earnings?.toFixed(2) || '0.00'}
            </p>
          </GlassCard>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Clock weight="duotone" className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-foreground">
                  {earnings?.total_rides || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Rides</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Star weight="duotone" className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-foreground">
                  {earnings?.rating?.toFixed(1) || '5.0'}
                </p>
                <p className="text-xs text-muted-foreground">Your Rating</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Commission Info */}
        <GlassCard className="p-4" hover={false}>
          <h3 className="font-heading font-semibold text-foreground mb-3">How Earnings Work</h3>
          <div className="space-y-2 text-sm text-muted-foreground/60">
            <p>• You receive your fare minus the platform commission</p>
            <p>• Payments are collected in cash from passengers</p>
            <p>• Commission rates may vary based on promotions</p>
            <p>• Higher ratings can lead to more ride requests</p>
          </div>
        </GlassCard>
      </div>
    </Layout>
  );
};

export default DriverEarningsPage;
