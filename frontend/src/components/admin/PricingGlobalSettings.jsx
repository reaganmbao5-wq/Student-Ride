
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard, GlassInput, GoldButton } from '../common/GlassComponents';
import { Settings, Save, RefreshCw, ShieldAlert, Percent, Car } from 'lucide-react';
import { toast } from 'sonner';

const PricingGlobalSettings = () => {
    const { api } = useAuth();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [settings, setSettings] = useState({
        base_fare: 15.0,
        per_km_rate: 1.40,
        per_minute_rate: 0.10,
        surge_multiplier: 1.0,
        minimum_fare: 15.0,
        commission_rate: 0.10,
        private_multiplier: 3.5,
        max_commission_owed_limit: 500.0
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setFetching(true);
        try {
            const res = await api.get('/admin/pricing-settings');
            setSettings({
                base_fare: res.data.base_fare ?? 15.0,
                per_km_rate: res.data.per_km_rate ?? 1.40,
                per_minute_rate: res.data.per_minute_rate ?? 0.10,
                surge_multiplier: res.data.surge_multiplier ?? 1.0,
                minimum_fare: res.data.minimum_fare ?? 15.0,
                commission_rate: res.data.commission_rate ?? 0.10,
                private_multiplier: res.data.private_multiplier ?? 3.5,
                max_commission_owed_limit: res.data.max_commission_owed_limit ?? 500.0
            });
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
            fetchSettings();
        } catch (error) {
            toast.error("Failed to update settings");
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="text-muted-foreground p-8 text-center">Loading settings...</div>;

    return (
        <GlassCard className="p-6">
            <h2 className="text-xl font-heading font-semibold text-foreground mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gold" />
                Global Pricing & Commission Configuration
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Base Rates */}
                    <div className="space-y-4">
                        <h3 className="text-foreground font-medium border-b border-border pb-2 flex items-center gap-2">
                            <Car className="w-4 h-4 text-gold" />
                            Base Distance & Time Rates
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Base Starting Price</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">K</span>
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
                                <label className="block text-xs text-muted-foreground mb-1">Cost Per Kilometer</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">K</span>
                                    <GlassInput
                                        name="per_km_rate"
                                        type="number"
                                        step="0.10"
                                        value={settings.per_km_rate}
                                        onChange={handleChange}
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Cost Per Minute</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">K</span>
                                    <GlassInput
                                        name="per_minute_rate"
                                        type="number"
                                        step="0.05"
                                        value={settings.per_minute_rate}
                                        onChange={handleChange}
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Minimum Fare Floor</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">K</span>
                                    <GlassInput
                                        name="minimum_fare"
                                        type="number"
                                        step="1.0"
                                        value={settings.minimum_fare}
                                        onChange={handleChange}
                                        className="pl-8"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Commission & Multipliers */}
                    <div className="space-y-4">
                        <h3 className="text-foreground font-medium border-b border-border pb-2 flex items-center gap-2">
                            <Percent className="w-4 h-4 text-emerald-400" />
                            Commission & Mode Multipliers
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Platform Commission Rate (%)</label>
                                <GlassInput
                                    name="commission_rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="0.5"
                                    value={settings.commission_rate}
                                    onChange={handleChange}
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">e.g. 0.10 = 10% added on top of base fare for student.</p>
                            </div>

                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Private Ride Multiplier ("In Taka")</label>
                                <GlassInput
                                    name="private_multiplier"
                                    type="number"
                                    step="0.1"
                                    min="1.0"
                                    max="5.0"
                                    value={settings.private_multiplier}
                                    onChange={handleChange}
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">Default 3.5× (Student pays 3.5 seats for whole car).</p>
                            </div>

                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Surge Multiplier (1.0 = Normal)</label>
                                <GlassInput
                                    name="surge_multiplier"
                                    type="number"
                                    step="0.1"
                                    min="1.0"
                                    max="5.0"
                                    value={settings.surge_multiplier}
                                    onChange={handleChange}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Max Owed Debt Lockout Limit</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">K</span>
                                    <GlassInput
                                        name="max_commission_owed_limit"
                                        type="number"
                                        step="50"
                                        value={settings.max_commission_owed_limit}
                                        onChange={handleChange}
                                        className="pl-8"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">Driver restricted when debt reaches this limit.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={fetchSettings}
                        className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors flex items-center gap-2"
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
