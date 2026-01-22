import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Percent, Clock, Save, Loader2, AlertCircle } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AdminSettingsPage = () => {
  const { api, isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState({
    commission_rate: 15,
    base_fare: 10,
    per_km_rate: 5,
    per_minute_rate: 1
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings', settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
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
      <div className="p-4 md:p-8 space-y-6" data-testid="admin-settings-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
            Platform Settings
          </h1>
          <p className="text-white/50">Configure pricing and commission rates</p>
        </div>

        {/* Permission Warning */}
        {!isSuperAdmin && (
          <GlassCard className="p-4 border-yellow-500/30" hover={false}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <p className="text-white/80 text-sm">
                Only Super Admin can modify platform settings. Contact the Super Admin to make changes.
              </p>
            </div>
          </GlassCard>
        )}

        {/* Commission Rate */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
              <Percent className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-white text-lg">Commission Rate</h2>
              <p className="text-white/50 text-sm">Percentage taken from each ride</p>
            </div>
          </div>

          <div className="relative">
            <GlassInput
              type="number"
              value={settings.commission_rate}
              onChange={(e) => handleChange('commission_rate', e.target.value)}
              disabled={!isSuperAdmin}
              min="0"
              max="100"
              step="0.5"
              className="text-2xl font-heading font-bold"
              data-testid="commission-rate-input"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-xl">%</span>
          </div>

          <p className="text-white/40 text-sm mt-3">
            Example: On a K50 ride, platform earns K{(50 * settings.commission_rate / 100).toFixed(2)}
          </p>
        </GlassCard>

        {/* Fare Settings */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-white text-lg">Fare Calculation</h2>
              <p className="text-white/50 text-sm">Configure base fare and rates</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Base Fare (K)</label>
              <GlassInput
                type="number"
                value={settings.base_fare}
                onChange={(e) => handleChange('base_fare', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
                data-testid="base-fare-input"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Per KM (K)</label>
              <GlassInput
                type="number"
                value={settings.per_km_rate}
                onChange={(e) => handleChange('per_km_rate', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
                data-testid="per-km-input"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Per Minute (K)</label>
              <GlassInput
                type="number"
                value={settings.per_minute_rate}
                onChange={(e) => handleChange('per_minute_rate', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
                data-testid="per-minute-input"
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-white/5 rounded-xl">
            <h3 className="text-white font-medium mb-2">Fare Formula</h3>
            <p className="text-white/60 text-sm font-mono">
              Total = K{settings.base_fare} + (distance × K{settings.per_km_rate}) + (time × K{settings.per_minute_rate})
            </p>
            <p className="text-white/40 text-sm mt-2">
              Example: 5km, 15 min ride = K{(settings.base_fare + 5 * settings.per_km_rate + 15 * settings.per_minute_rate).toFixed(2)}
            </p>
          </div>
        </GlassCard>

        {/* Save Button */}
        {isSuperAdmin && (
          <GoldButton
            className="w-full"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-settings-btn"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save Settings
              </>
            )}
          </GoldButton>
        )}

        {/* Admin Logs Info */}
        <GlassCard className="p-4" hover={false}>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-white/40" />
            <p className="text-white/50 text-sm">
              All setting changes are logged in the admin activity log
            </p>
          </div>
        </GlassCard>
      </div>
    </Layout>
  );
};

export default AdminSettingsPage;
