import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Percent, Clock, Save, Loader2, AlertCircle, UploadCloud, Smartphone, CheckCircle2 } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminSettingsSkeleton } from '../components/common/PageSkeletons';
import { AndroidRobotIcon } from '../components/common/AppUpdateModal';
import { getBackendUrl } from '../utils/urlHelpers';
import { toast } from 'sonner';

const AdminSettingsPage = () => {
  const { api, isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState({
    commission_rate: 15,
    base_fare: 15,
    per_km_rate: 5,
    per_minute_rate: 2,
    shared_base_fare: 8,
    shared_per_km_rate: 3,
    shared_per_minute_rate: 1
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // APK Release Management State
  const [apkFile, setApkFile] = useState(null);
  const [apkVersionName, setApkVersionName] = useState('2.1.0');
  const [apkVersionCode, setApkVersionCode] = useState(11);
  const [apkMinVersion, setApkMinVersion] = useState('2.0.0');
  const [apkForceUpdate, setApkForceUpdate] = useState(false);
  const [apkNotes, setApkNotes] = useState('Enhanced multi-passenger route optimization and real-time live navigation.');
  const [apkUploading, setApkUploading] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchLatestRelease();
  }, []);

  const fetchLatestRelease = async () => {
    try {
      const res = await api.get('/app/version-check');
      setLatestRelease(res.data);
      if (res.data?.version_code) {
        setApkVersionCode(res.data.version_code);
      }
    } catch (err) {
      console.warn('Failed to fetch latest release:', err);
    }
  };

  const handleUploadApk = async (e) => {
    if (e) e.preventDefault();
    if (!apkFile) {
      toast.error('Please select an .apk file to upload.');
      return;
    }

    setApkUploading(true);
    const formData = new FormData();
    formData.append('file', apkFile);

    try {
      const url = `/admin/app-releases/upload?version_name=${encodeURIComponent(apkVersionName)}&version_code=${apkVersionCode}&min_required_version=${encodeURIComponent(apkMinVersion)}&force_update=${apkForceUpdate}&release_notes=${encodeURIComponent(apkNotes)}`;
      const res = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data?.message || 'New APK build published successfully!');
      setApkFile(null);
      fetchLatestRelease();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload APK release');
    } finally {
      setApkUploading(false);
    }
  };

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
    return <AdminSettingsSkeleton />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="admin-settings-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">
            Platform Settings
          </h1>
          <p className="text-muted-foreground">Configure pricing and commission rates</p>
        </div>

        {/* Permission Warning */}
        {!isSuperAdmin && (
          <GlassCard className="p-4 border-yellow-500/30" hover={false}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <p className="text-muted-foreground text-sm">
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
              <h2 className="font-heading font-semibold text-foreground text-lg">Commission Rate</h2>
              <p className="text-muted-foreground text-sm">Percentage taken from each ride</p>
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
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl">%</span>
          </div>

          <p className="text-muted-foreground text-sm mt-3">
            Example: On a K50 ride, platform earns K{(50 * settings.commission_rate / 100).toFixed(2)}
          </p>
        </GlassCard>

        {/* Private Fare Settings */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-foreground text-lg">Private Fare Calculation</h2>
              <p className="text-muted-foreground text-sm">Configure base fare and rates for private rides</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Base Fare (K)</label>
              <GlassInput
                type="number"
                value={settings.base_fare || 0}
                onChange={(e) => handleChange('base_fare', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
                data-testid="base-fare-input"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Per KM (K)</label>
              <GlassInput
                type="number"
                value={settings.per_km_rate || 0}
                onChange={(e) => handleChange('per_km_rate', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
                data-testid="per-km-input"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Per Minute (K)</label>
              <GlassInput
                type="number"
                value={settings.per_minute_rate || 0}
                onChange={(e) => handleChange('per_minute_rate', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
                data-testid="per-minute-input"
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-xl">
            <h3 className="text-foreground font-medium mb-2">Fare Formula</h3>
            <p className="text-muted-foreground text-sm font-mono">
              Total = K{settings.base_fare || 0} + (distance × K{settings.per_km_rate || 0}) + (time × K{settings.per_minute_rate || 0})
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Example: 5km, 15 min ride = K{((settings.base_fare || 0) + 5 * (settings.per_km_rate || 0) + 15 * (settings.per_minute_rate || 0)).toFixed(2)}
            </p>
          </div>
        </GlassCard>

        {/* Shared Fare Settings */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-foreground text-lg">Shared Fare Calculation</h2>
              <p className="text-muted-foreground text-sm">Configure base fare and rates for shared rides</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Base Fare (K)</label>
              <GlassInput
                type="number"
                value={settings.shared_base_fare || 0}
                onChange={(e) => handleChange('shared_base_fare', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Per KM (K)</label>
              <GlassInput
                type="number"
                value={settings.shared_per_km_rate || 0}
                onChange={(e) => handleChange('shared_per_km_rate', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Per Minute (K)</label>
              <GlassInput
                type="number"
                value={settings.shared_per_minute_rate || 0}
                onChange={(e) => handleChange('shared_per_minute_rate', e.target.value)}
                disabled={!isSuperAdmin}
                min="0"
                step="0.5"
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-xl border border-blue-500/20">
            <h3 className="text-foreground font-medium mb-2">Fare Formula</h3>
            <p className="text-muted-foreground text-sm font-mono">
              Total = K{settings.shared_base_fare || 0} + (distance × K{settings.shared_per_km_rate || 0}) + (time × K{settings.shared_per_minute_rate || 0})
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Example: 5km, 15 min ride = K{((settings.shared_base_fare || 0) + 5 * (settings.shared_per_km_rate || 0) + 15 * (settings.shared_per_minute_rate || 0)).toFixed(2)}
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

        {/* APK Release & Over-The-Air Update Manager */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <AndroidRobotIcon className="w-8 h-7" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground text-lg">App Releases & APK Manager</h2>
                <p className="text-muted-foreground text-sm">Publish new Android APK builds and trigger instant in-app updates</p>
              </div>
            </div>
            {latestRelease && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-foreground">Current: v{latestRelease.latest_version} (build {latestRelease.version_code})</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Version Name (e.g. 2.1.0)</label>
                <GlassInput
                  type="text"
                  value={apkVersionName}
                  onChange={(e) => setApkVersionName(e.target.value)}
                  placeholder="2.1.0"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Build Code (Integer)</label>
                <GlassInput
                  type="number"
                  value={apkVersionCode}
                  onChange={(e) => setApkVersionCode(parseInt(e.target.value) || 0)}
                  placeholder="11"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Min Required Version</label>
                <GlassInput
                  type="text"
                  value={apkMinVersion}
                  onChange={(e) => setApkMinVersion(e.target.value)}
                  placeholder="2.0.0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Release Notes / Changelog</label>
              <textarea
                value={apkNotes}
                onChange={(e) => setApkNotes(e.target.value)}
                rows={3}
                className="w-full bg-card text-foreground border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                placeholder="Describe what is new in this APK build..."
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/60 rounded-xl border border-border/70">
              <input
                type="checkbox"
                id="force_update_toggle"
                checked={apkForceUpdate}
                onChange={(e) => setApkForceUpdate(e.target.checked)}
                className="w-4 h-4 rounded text-gold focus:ring-gold"
              />
              <label htmlFor="force_update_toggle" className="text-sm font-medium text-foreground cursor-pointer">
                Force Update (Require all users to download before using the app)
              </label>
            </div>

            {/* Drag and drop / Select APK file */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Select .apk File</label>
              <div className="relative border-2 border-dashed border-border hover:border-gold/50 rounded-2xl p-6 text-center transition-colors bg-muted/30">
                <input
                  type="file"
                  accept=".apk"
                  onChange={(e) => setApkFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <UploadCloud className="w-8 h-8 text-gold" />
                  {apkFile ? (
                    <div className="text-sm font-semibold text-foreground">
                      Selected: <span className="text-gold">{apkFile.name}</span> ({(apkFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Click or drag & drop new .apk build here</p>
                      <p className="text-xs text-muted-foreground">Up to 100MB direct upload to database storage</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUploadApk}
              disabled={apkUploading || !apkFile}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gold hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {apkUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading & Publishing Release...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Publish & Release APK (OTA)</span>
                </>
              )}
            </button>
          </div>
        </GlassCard>

        {/* Admin Logs Info */}
        <GlassCard className="p-4" hover={false}>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              All setting changes are logged in the admin activity log
            </p>
          </div>
        </GlassCard>
      </div>
    </Layout>
  );
};

export default AdminSettingsPage;
