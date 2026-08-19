import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { GlassCard } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AccountantPricingPage = () => {
  const { api } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/pricing-settings');
      setSettings(res.data);
    } catch (e) {
      toast.error('Failed to load pricing matrix');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Layout><div className="p-8 text-center text-muted-foreground">Loading pricing matrix...</div></Layout>;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Active Pricing Matrix (Audit View)</h1>
            <p className="text-muted-foreground text-sm">Read-only audit record of active platform rates and multipliers</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full border border-border text-xs text-muted-foreground font-semibold">
            <Shield className="w-3.5 h-3.5 text-gold" />
            Audit Read-Only
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <h3 className="font-bold text-base text-foreground mb-4">Distance & Time Parameters</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border/40">
                <span className="text-muted-foreground">Base Starting Fare</span>
                <span className="font-bold text-foreground">K{settings?.base_fare?.toFixed(2) ?? '15.00'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/40">
                <span className="text-muted-foreground">Per Kilometer Rate</span>
                <span className="font-bold text-foreground">K{settings?.per_km_rate?.toFixed(2) ?? '5.00'} / km</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/40">
                <span className="text-muted-foreground">Minimum Fare Cap</span>
                <span className="font-bold text-foreground">K{settings?.minimum_fare?.toFixed(2) ?? '20.00'}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 border border-border/60" hover={false}>
            <h3 className="font-bold text-base text-foreground mb-4">Platform Commissions & Multipliers</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border/40">
                <span className="text-muted-foreground">Platform Commission Rate</span>
                <span className="font-bold text-gold">{((settings?.commission_rate ?? 0.10) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/40">
                <span className="text-muted-foreground">Private Ride Multiplier</span>
                <span className="font-bold text-foreground">{settings?.private_multiplier ?? 3.5}x</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/40">
                <span className="text-muted-foreground">Driver Debt Wallet Restriction Limit</span>
                <span className="font-bold text-red-400">K{settings?.max_commission_owed_limit?.toFixed(2) ?? '500.00'}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </Layout>
  );
};

export default AccountantPricingPage;
