import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Clock, Star, Calendar } from 'lucide-react';
import { GlassCard, LoadingSpinner } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';

const DriverEarningsPage = () => {
  const { api } = useAuth();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <div className="p-4 md:p-8 space-y-6" data-testid="driver-earnings-page">
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
            Earnings
          </h1>
          <p className="text-white/50">Track your income and performance</p>
        </div>

        {/* Total Earnings Card */}
        <GlassCard className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-full blur-[60px]" />
          <div className="relative z-10">
            <p className="text-white/60 mb-2">Total Earnings</p>
            <p className="font-heading text-4xl md:text-5xl font-bold text-gold mb-4">
              K{earnings?.total_earnings?.toFixed(2) || '0.00'}
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>All time earnings</span>
            </div>
          </div>
        </GlassCard>

        {/* Period Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-gold" />
              </div>
              <span className="text-white/60 text-sm">Today</span>
            </div>
            <p className="font-heading text-2xl font-bold text-white">
              K{earnings?.today_earnings?.toFixed(2) || '0.00'}
            </p>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-white/60 text-sm">This Week</span>
            </div>
            <p className="font-heading text-2xl font-bold text-white">
              K{earnings?.week_earnings?.toFixed(2) || '0.00'}
            </p>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-white/60 text-sm">This Month</span>
            </div>
            <p className="font-heading text-2xl font-bold text-white">
              K{earnings?.month_earnings?.toFixed(2) || '0.00'}
            </p>
          </GlassCard>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-white">
                  {earnings?.total_rides || 0}
                </p>
                <p className="text-xs text-white/40">Total Rides</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-white">
                  {earnings?.rating?.toFixed(1) || '5.0'}
                </p>
                <p className="text-xs text-white/40">Your Rating</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Commission Info */}
        <GlassCard className="p-4" hover={false}>
          <h3 className="font-heading font-semibold text-white mb-3">How Earnings Work</h3>
          <div className="space-y-2 text-sm text-white/60">
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
