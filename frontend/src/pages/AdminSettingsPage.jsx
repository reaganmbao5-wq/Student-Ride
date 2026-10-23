import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Percent, Clock, Save, Loader2, AlertCircle, UploadCloud, Smartphone, CheckCircle2, ShieldCheck, UserCheck, Trash2, Plus, Download, Check } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminSettingsSkeleton } from '../components/common/PageSkeletons';
import { AndroidRobotIcon } from '../components/common/AppUpdateModal';
import { GooglePlayIcon } from '../components/common/PlayStoreAccessModal';
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

  // Beta Testing Whitelist State
  const [betaTesters, setBetaTesters] = useState([]);
  const [betaGateActive, setBetaGateActive] = useState(true);
  const [newTesterEmail, setNewTesterEmail] = useState('');
  const [newTesterName, setNewTesterName] = useState('');
  const [addingTester, setAddingTester] = useState(false);
  const [togglingGate, setTogglingGate] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState(null);

  // Google Play Store Closed Testing Queue State
  const [playStoreTesters, setPlayStoreTesters] = useState([]);
  const [psFilterTab, setPsFilterTab] = useState('pending'); // 'pending' | 'synced' | 'all'
  const [psNewEmail, setPsNewEmail] = useState('');
  const [psNewName, setPsNewName] = useState('');
  const [psAdding, setPsAdding] = useState(false);
  const [psMarkingSynced, setPsMarkingSynced] = useState(false);
  const [psActionEmail, setPsActionEmail] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchLatestRelease();
    fetchBetaTesters();
    fetchPlayStoreTesters();
  }, []);

  const fetchPlayStoreTesters = async () => {
    try {
      const res = await api.get('/admin/play-store-testers');
      setPlayStoreTesters(res.data?.testers || []);
    } catch (err) {
      console.warn('Failed to fetch Play Store testers:', err);
    }
  };

  const handleExportPlayStoreCsv = (mode = 'pending') => {
    const list = mode === 'pending'
      ? playStoreTesters.filter(t => t.status !== 'synced')
      : playStoreTesters;

    if (list.length === 0) {
      toast.error(mode === 'pending' ? 'No pending emails to export!' : 'No emails found to export!');
      return;
    }

    const csvContent = list.map(t => (t.email || '').trim().toLowerCase()).filter(Boolean).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `jaeyride-playstore-${mode}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${list.length} email(s) to CSV! Upload in Google Play Console → Testers, then click "Mark Pending as Uploaded".`);
  };

  const handleMarkPlayStoreSynced = async () => {
    const pendingList = playStoreTesters.filter(t => t.status !== 'synced');
    if (pendingList.length === 0) {
      toast.info('All queued emails are already marked as active on Play Store.');
      return;
    }
    setPsMarkingSynced(true);
    try {
      const res = await api.post('/admin/play-store-testers/mark-synced', {});
      const count = res.data?.synced_count || pendingList.length;
      toast.success(`Marked ${count} email(s) as Active on Play Store & whitelisted!`);
      fetchPlayStoreTesters();
      fetchBetaTesters();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark emails as synced');
    } finally {
      setPsMarkingSynced(false);
    }
  };

  const handleAddPlayStoreTester = async (e) => {
    if (e) e.preventDefault();
    const emailClean = psNewEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      toast.error('Please enter a valid Google Play email address.');
      return;
    }
    setPsAdding(true);
    try {
      await api.post('/admin/play-store-testers/add', {
        email: emailClean,
        name: psNewName.trim(),
        status: 'pending'
      });
      toast.success(`Added ${emailClean} to Play Store pending queue`);
      setPsNewEmail('');
      setPsNewName('');
      fetchPlayStoreTesters();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add Play Store tester');
    } finally {
      setPsAdding(false);
    }
  };

  const handleTogglePlayStoreTesterStatus = async (email, currentStatus) => {
    const nextStatus = currentStatus === 'synced' ? 'pending' : 'synced';
    setPsActionEmail(email);
    try {
      await api.patch(`/admin/play-store-testers/${encodeURIComponent(email)}/status`, { status: nextStatus });
      toast.success(`${email} marked as ${nextStatus === 'synced' ? 'Active on Play Store' : 'Pending Upload'}`);
      fetchPlayStoreTesters();
      if (nextStatus === 'synced') fetchBetaTesters();
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setPsActionEmail(null);
    }
  };

  const handleDeletePlayStoreTester = async (email) => {
    setPsActionEmail(email);
    try {
      await api.delete(`/admin/play-store-testers/${encodeURIComponent(email)}`);
      toast.success(`Removed ${email} from Play Store list`);
      setPlayStoreTesters(prev => prev.filter(t => t.email !== email));
    } catch (err) {
      toast.error('Failed to remove email');
    } finally {
      setPsActionEmail(null);
    }
  };

  const fetchBetaTesters = async () => {
    try {
      const res = await api.get('/admin/beta-testers');
      setBetaTesters(res.data?.testers || []);
      setBetaGateActive(res.data?.beta_gate_active !== false);
    } catch (err) {
      console.warn('Failed to fetch beta testers:', err);
    }
  };

  const handleAddBetaTester = async (e) => {
    if (e) e.preventDefault();
    const emailClean = newTesterEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      toast.error('Please enter a valid student or tester email address.');
      return;
    }
    setAddingTester(true);
    try {
      await api.post('/admin/beta-testers', { email: emailClean, name: newTesterName.trim() });
      toast.success(`Tester ${emailClean} whitelisted successfully!`);
      setNewTesterEmail('');
      setNewTesterName('');
      fetchBetaTesters();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add beta tester');
    } finally {
      setAddingTester(false);
    }
  };

  const handleRemoveBetaTester = async (email) => {
    setDeletingEmail(email);
    try {
      await api.delete(`/admin/beta-testers/${encodeURIComponent(email)}`);
      toast.success(`Removed ${email} from beta testing whitelist`);
      setBetaTesters(prev => prev.filter(t => t.email !== email));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove beta tester');
    } finally {
      setDeletingEmail(null);
    }
  };

  const handleToggleBetaGate = async () => {
    const nextState = !betaGateActive;
    setTogglingGate(true);
    try {
      await api.post('/admin/beta-gate/toggle', { active: nextState });
      setBetaGateActive(nextState);
      toast.success(nextState 
        ? 'Beta Gate Activated: Only whitelisted users can request rides.' 
        : 'Beta Gate Disabled: Ride requests are now open to everyone on campus!'
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to toggle beta gate');
    } finally {
      setTogglingGate(false);
    }
  };

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

        {/* Beta Rollout & Whitelist Management */}
        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground text-lg">Beta Testing & Whitelist Control</h2>
                <p className="text-muted-foreground text-sm">Restrict ride booking to authorized testers or open to campus</p>
              </div>
            </div>

            {/* Master Gate Toggle Button */}
            <button
              onClick={handleToggleBetaGate}
              disabled={togglingGate}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                betaGateActive
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {togglingGate ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : betaGateActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Beta Gate: ACTIVE (Restricted)
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-white" />
                  Beta Gate: OFF (Public Rollout)
                </>
              )}
            </button>
          </div>

          {/* Description banner */}
          <div className="mb-6 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">How Beta Access Works:</p>
              <p className="mt-0.5">
                When active, students not on this list will see the <strong className="text-foreground">"You're Early to Jaey Ride"</strong> screen when clicking Request Ride. Testers listed below (or tagged in User Management) bypass the gate and book rides immediately.
              </p>
            </div>
          </div>

          {/* Add Tester Form */}
          <form onSubmit={handleAddBetaTester} className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6">
            <div className="sm:col-span-6">
              <GlassInput
                type="email"
                placeholder="Tester Email (e.g. student@unza.zm)"
                value={newTesterEmail}
                onChange={(e) => setNewTesterEmail(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-4">
              <GlassInput
                type="text"
                placeholder="Tester Name / Note (Optional)"
                value={newTesterName}
                onChange={(e) => setNewTesterName(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={addingTester}
                className="w-full h-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                {addingTester ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add Tester</>}
              </button>
            </div>
          </form>

          {/* Whitelisted Testers List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-purple-400" />
                Whitelisted Beta Testers ({betaTesters.length})
              </h3>
            </div>

            {betaTesters.length === 0 ? (
              <div className="p-6 rounded-2xl bg-muted/40 border border-dashed border-border text-center text-xs text-muted-foreground">
                No external tester emails added yet. You can also grant Beta Access directly from the <strong className="text-foreground">User Management</strong> tab!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {betaTesters.map((tester) => (
                  <div
                    key={tester.email}
                    className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-2 shadow-xs hover:border-purple-500/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{tester.name || 'Beta Tester'}</p>
                      <p className="text-[11px] text-muted-foreground truncate font-mono">{tester.email}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveBetaTester(tester.email)}
                      disabled={deletingEmail === tester.email}
                      className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      title="Remove tester"
                    >
                      {deletingEmail === tester.email ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Google Play Store Closed Testing Queue & CSV Sync */}
        <GlassCard className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <GooglePlayIcon className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground text-lg">Google Play Store Testers & CSV Sync</h2>
                <p className="text-muted-foreground text-sm">
                  Export new emails to CSV for Google Play Console, then mark them active so they redirect straight to Play Store
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportPlayStoreCsv('pending')}
                className="px-3.5 py-2.5 rounded-xl font-bold text-xs bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export Pending CSV ({playStoreTesters.filter(t => t.status !== 'synced').length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportPlayStoreCsv('all')}
                className="px-3.5 py-2.5 rounded-xl font-bold text-xs bg-muted hover:bg-muted/80 text-foreground border border-border transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                <span>Export All ({playStoreTesters.length})</span>
              </button>

              <button
                type="button"
                onClick={handleMarkPlayStoreSynced}
                disabled={psMarkingSynced || playStoreTesters.filter(t => t.status !== 'synced').length === 0}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                {psMarkingSynced ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Mark Pending as Uploaded to Play Store</span>
              </button>
            </div>
          </div>

          {/* Workflow explanation banner */}
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">How Play Store Smart Redirect Works:</p>
              <p className="mt-0.5">
                1. Users who tap <strong className="text-foreground">Download from Play Store</strong> (or register on the web) are added to <strong className="text-amber-400">Pending Upload</strong> if they aren't on Play Console yet.<br />
                2. Click <strong className="text-foreground">Export Pending CSV</strong> and upload that CSV in <strong className="text-foreground">Google Play Console → Closed testing → Testers</strong>.<br />
                3. Click <strong className="text-emerald-400">Mark Pending as Uploaded to Play Store</strong> — those users are immediately marked <strong className="text-emerald-400">Active</strong> and whitelisted so their next click opens Google Play directly!
              </p>
            </div>
          </div>

          {/* Manual Add to Play Store Queue */}
          <form onSubmit={handleAddPlayStoreTester} className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6">
            <div className="sm:col-span-6">
              <GlassInput
                type="email"
                placeholder="Google Play Gmail (e.g. user@gmail.com)"
                value={psNewEmail}
                onChange={(e) => setPsNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-4">
              <GlassInput
                type="text"
                placeholder="User Name (Optional)"
                value={psNewName}
                onChange={(e) => setPsNewName(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={psAdding}
                className="w-full h-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                {psAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add Email</>}
              </button>
            </div>
          </form>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
            <button
              type="button"
              onClick={() => setPsFilterTab('pending')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                psFilterTab === 'pending'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending Upload ({playStoreTesters.filter(t => t.status !== 'synced').length})
            </button>
            <button
              type="button"
              onClick={() => setPsFilterTab('synced')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                psFilterTab === 'synced'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active on Play Store ({playStoreTesters.filter(t => t.status === 'synced').length})
            </button>
            <button
              type="button"
              onClick={() => setPsFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                psFilterTab === 'all'
                  ? 'bg-muted text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({playStoreTesters.length})
            </button>
          </div>

          {/* Filtered Testers Grid */}
          {(() => {
            const filteredPs = playStoreTesters.filter(t => {
              if (psFilterTab === 'pending') return t.status !== 'synced';
              if (psFilterTab === 'synced') return t.status === 'synced';
              return true;
            });

            if (filteredPs.length === 0) {
              return (
                <div className="p-6 rounded-2xl bg-muted/40 border border-dashed border-border text-center text-xs text-muted-foreground">
                  {psFilterTab === 'pending'
                    ? 'Zero pending emails! Everyone in the queue has been exported and marked as active on Google Play.'
                    : 'No emails found in this view.'}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredPs.map((item) => {
                  const isSynced = item.status === 'synced';
                  return (
                    <div
                      key={item.email}
                      className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-2 shadow-xs hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate">{item.name || 'Play Store User'}</p>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isSynced
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-amber-500/15 text-amber-400'
                            }`}
                          >
                            {isSynced ? 'Active' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">{item.email}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayStoreTesterStatus(item.email, item.status)}
                          disabled={psActionEmail === item.email}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                            isSynced
                              ? 'bg-muted hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                          }`}
                          title={isSynced ? 'Move back to Pending' : 'Mark as Active on Play Store'}
                        >
                          {psActionEmail === item.email ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isSynced ? (
                            'Set Pending'
                          ) : (
                            'Mark Active'
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePlayStoreTester(item.email)}
                          disabled={psActionEmail === item.email}
                          className="w-7 h-7 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors flex items-center justify-center cursor-pointer"
                          title="Remove email"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </GlassCard>

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
