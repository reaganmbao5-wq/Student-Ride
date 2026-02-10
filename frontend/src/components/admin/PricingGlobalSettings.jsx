
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard, GlassInput, GoldButton } from '../common/GlassComponents';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const PricingGlobalSettings = () => {
    const { api } = useAuth();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [settings, setSettings] = useState({
        base_fare: 15.0,
        per_km_rate: 5.0,
        per_minute_rate: 2.0,
        surge_multiplier: 1.0,
        minimum_fare: 20.0
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setFetching(true);
        try {
            const res = await api.get('/admin/pricing-settings');
            setSettings(res.data);
        } catch (error) {
            toast.error("Failed to load pricing settings");
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.put('/admin/pricing-settings', settings);
            toast.success("Pricing settings updated successfully");
            fetchSettings(); // Refresh to ensure sync
        } catch (error) {
            toast.error("Failed to update settings");
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="text-white/60 p-8 text-center">Loading settings...</div>;

    return (
        <GlassCard className="p-6">
            <h2 className="text-xl font-heading font-semibold text-white mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gold" />
                Global Pricing Configuration
            </h2>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-white/80 font-medium border-b border-white/10 pb-2">Base Rates</h3>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">Base Fare (Starting Price)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">K</span>
                            <GlassInput
                                name="base_fare"
                                type="number"
                                step="0.5"
                                value={settings.base_fare}
                                onChange={handleChange}
                                className="pl-8"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">Cost Per Kilometer</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">K</span>
                            <GlassInput
                                name="per_km_rate"
                                type="number"
                                step="0.5"
                                value={settings.per_km_rate}
                                onChange={handleChange}
                                className="pl-8"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">Cost Per Minute</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">K</span>
                            <GlassInput
                                name="per_minute_rate"
                                type="number"
                                step="0.5"
                                value={settings.per_minute_rate}
                                onChange={handleChange}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-white/80 font-medium border-b border-white/10 pb-2">Multipliers & Limits</h3>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">Surge Multiplier (1.0 = Normal)</label>
                        <GlassInput
                            name="surge_multiplier"
                            type="number"
                            step="0.1"
                            min="1.0"
                            max="5.0"
                            value={settings.surge_multiplier}
                            onChange={handleChange}
                        />
                        <p className="text-xs text-white/40 mt-1">Multiplies the total dynamic fare.</p>
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">Minimum Fare Floor</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">K</span>
                            <GlassInput
                                name="minimum_fare"
                                type="number"
                                step="1.0"
                                value={settings.minimum_fare}
                                onChange={handleChange}
                                className="pl-8"
                            />
                        </div>
                        <p className="text-xs text-white/40 mt-1">The absolute minimum price for a ride.</p>
                    </div>
                </div>

                <div className="md:col-span-2 pt-4 border-t border-white/10 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={fetchSettings}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Reset
                    </button>
                    <GoldButton type="submit" disabled={loading} className="w-auto px-8">
                        {loading ? <span className="flex items-center gap-2">Saving...</span> : <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Changes</span>}
                    </GoldButton>
                </div>
            </form>
        </GlassCard>
    );
};

export default PricingGlobalSettings;
