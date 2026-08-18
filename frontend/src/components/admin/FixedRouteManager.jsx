import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard, GlassInput, GoldButton } from '../common/GlassComponents';
import { MapPin, Navigation, Trash2, Flag, X } from 'lucide-react';
import { toast } from 'sonner';
import { PlatformMap } from '../../map/components/PlatformMap';

const FixedRouteManager = () => {
    const { api } = useAuth();
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [form, setForm] = useState({
        pickup_name: '',
        dropoff_name: '',
        fixed_price: '',
        flat_commission: '5.00',
        private_fixed_price: '',
        tolerance_radius_meters: 500
    });

    // Map Center & Selection State
    const [mapCenter, setMapCenter] = useState({ lat: -14.294896, lng: 28.559798 });
    const [pickupCoords, setPickupCoords] = useState(null);
    const [dropoffCoords, setDropoffCoords] = useState(null);
    const [selectionMode, setSelectionMode] = useState(null); // 'pickup' | 'dropoff' | null

    // Place Search States
    const [pickupSearch, setPickupSearch] = useState('');
    const [pickupResults, setPickupResults] = useState([]);
    const [dropoffSearch, setDropoffSearch] = useState('');
    const [dropoffResults, setDropoffResults] = useState([]);

    const fetchRoutes = useCallback(async () => {
        try {
            const res = await api.get('/admin/fixed-routes');
            setRoutes(res.data || []);
        } catch (error) {
            toast.error("Failed to load routes");
        }
    }, [api]);

    useEffect(() => {
        fetchRoutes();
    }, [fetchRoutes]);

    const markers = useMemo(() => {
        const list = [];
        if (pickupCoords) {
            list.push({
                id: 'fixed-route-pickup',
                lat: pickupCoords.lat,
                lng: pickupCoords.lng,
                iconType: 'pickup'
            });
        }
        if (dropoffCoords) {
            list.push({
                id: 'fixed-route-dropoff',
                lat: dropoffCoords.lat,
                lng: dropoffCoords.lng,
                iconType: 'dropoff'
            });
        }
        return list;
    }, [pickupCoords, dropoffCoords]);

    const searchPlaces = async (query, setResults) => {
        if (!query || query.trim().length < 2) {
            setResults([]);
            return;
        }
        try {
            const res = await api.get(`/places/search?q=${encodeURIComponent(query)}`);
            setResults(res.data || []);
        } catch (e) {
            setResults([]);
        }
    };

    const handleSelectPlace = (place, type) => {
        const coords = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
        setMapCenter(coords);
        if (type === 'pickup') {
            setPickupCoords(coords);
            setForm(prev => ({ ...prev, pickup_name: place.display_name }));
            setPickupSearch(place.display_name);
            setPickupResults([]);
            toast.success(`Pickup set: ${place.display_name}`);
        } else {
            setDropoffCoords(coords);
            setForm(prev => ({ ...prev, dropoff_name: place.display_name }));
            setDropoffSearch(place.display_name);
            setDropoffResults([]);
            toast.success(`Dropoff set: ${place.display_name}`);
        }
    };

    const handleConfirmCenterAsLocation = () => {
        if (selectionMode === 'pickup') {
            setPickupCoords(mapCenter);
            if (!form.pickup_name) {
                setForm(prev => ({ ...prev, pickup_name: `Point (${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)})` }));
            }
            toast.success("Pickup pinned to map center");
            setSelectionMode(null);
        } else if (selectionMode === 'dropoff') {
            setDropoffCoords(mapCenter);
            if (!form.dropoff_name) {
                setForm(prev => ({ ...prev, dropoff_name: `Point (${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)})` }));
            }
            toast.success("Dropoff pinned to map center");
            setSelectionMode(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!pickupCoords || !dropoffCoords) {
            toast.error("Please select both Pickup and Dropoff locations");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...form,
                fixed_price: parseFloat(form.fixed_price),
                flat_commission: parseFloat(form.flat_commission || 5.0),
                private_fixed_price: form.private_fixed_price ? parseFloat(form.private_fixed_price) : null,
                tolerance_radius_meters: parseInt(form.tolerance_radius_meters),
                pickup_coordinates: { type: "Point", coordinates: [pickupCoords.lng, pickupCoords.lat] },
                dropoff_coordinates: { type: "Point", coordinates: [dropoffCoords.lng, dropoffCoords.lat] }
            };

            await api.post('/admin/fixed-routes', payload);
            toast.success("Fixed route created successfully");
            setForm({ pickup_name: '', dropoff_name: '', fixed_price: '', flat_commission: '5.00', private_fixed_price: '', tolerance_radius_meters: 500 });
            setPickupCoords(null);
            setDropoffCoords(null);
            fetchRoutes();
        } catch (error) {
            toast.error("Failed to create route");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this route?")) return;
        try {
            await api.delete(`/admin/fixed-routes/${id}`);
            setRoutes(prev => prev.filter(r => r.id !== id));
            toast.success("Route deleted");
        } catch (error) {
            toast.error("Failed to delete route");
        }
    };

    return (
        <div className="space-y-6">
            <GlassCard className="p-6">
                <h2 className="text-xl font-heading font-semibold text-foreground mb-6 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-gold" />
                    Create New Fixed Route
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-xs text-muted-foreground mb-1">Pickup Name / Search Place</label>
                                <GlassInput
                                    value={form.pickup_name}
                                    onChange={e => {
                                        setForm({ ...form, pickup_name: e.target.value });
                                        setPickupSearch(e.target.value);
                                        searchPlaces(e.target.value, setPickupResults);
                                    }}
                                    placeholder="Search e.g. Main Gate..."
                                    required
                                />
                                {pickupResults.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-black/90 border border-gold/30 rounded-xl max-h-40 overflow-y-auto z-[2000] shadow-xl">
                                        {pickupResults.map(p => (
                                            <div key={p.id} onClick={() => handleSelectPlace(p, 'pickup')} className="p-2 hover:bg-gold/20 text-xs text-foreground cursor-pointer transition-colors border-b border-white/5">
                                                <div className="font-semibold">{p.display_name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode(selectionMode === 'pickup' ? null : 'pickup')}
                                    className={`mt-2 w-full py-1.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2
                                        ${pickupCoords ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : selectionMode === 'pickup' ? 'bg-gold text-black animate-pulse font-bold' : 'bg-muted text-foreground'}`}
                                >
                                    <MapPin className="w-3.5 h-3.5" />
                                    {pickupCoords ? `Pickup Set (${pickupCoords.lat.toFixed(4)})` : selectionMode === 'pickup' ? 'Aim on Map Center...' : 'Pin on Map'}
                                </button>
                            </div>

                            <div className="relative">
                                <label className="block text-xs text-muted-foreground mb-1">Dropoff Name / Search Place</label>
                                <GlassInput
                                    value={form.dropoff_name}
                                    onChange={e => {
                                        setForm({ ...form, dropoff_name: e.target.value });
                                        setDropoffSearch(e.target.value);
                                        searchPlaces(e.target.value, setDropoffResults);
                                    }}
                                    placeholder="Search e.g. Kobil..."
                                    required
                                />
                                {dropoffResults.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-black/90 border border-gold/30 rounded-xl max-h-40 overflow-y-auto z-[2000] shadow-xl">
                                        {dropoffResults.map(p => (
                                            <div key={p.id} onClick={() => handleSelectPlace(p, 'dropoff')} className="p-2 hover:bg-gold/20 text-xs text-foreground cursor-pointer transition-colors border-b border-white/5">
                                                <div className="font-semibold">{p.display_name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode(selectionMode === 'dropoff' ? null : 'dropoff')}
                                    className={`mt-2 w-full py-1.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2
                                        ${dropoffCoords ? 'bg-red-500/20 text-red-400 font-semibold' : selectionMode === 'dropoff' ? 'bg-gold text-black animate-pulse font-bold' : 'bg-muted text-foreground'}`}
                                >
                                    <Flag className="w-3.5 h-3.5" />
                                    {dropoffCoords ? `Dropoff Set (${dropoffCoords.lat.toFixed(4)})` : selectionMode === 'dropoff' ? 'Aim on Map Center...' : 'Pin on Map'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Shared Driver (K)</label>
                                <GlassInput type="number" step="1" value={form.fixed_price} onChange={e => setForm({ ...form, fixed_price: e.target.value })} placeholder="e.g. 50" required />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Platform Fee (K)</label>
                                <GlassInput type="number" step="0.5" value={form.flat_commission} onChange={e => setForm({ ...form, flat_commission: e.target.value })} placeholder="e.g. 5" required />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Private Base (K)</label>
                                <GlassInput type="number" step="1" value={form.private_fixed_price} onChange={e => setForm({ ...form, private_fixed_price: e.target.value })} placeholder="Auto 3.5x" />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Tolerance (m)</label>
                                <GlassInput type="number" step="50" value={form.tolerance_radius_meters} onChange={e => setForm({ ...form, tolerance_radius_meters: e.target.value })} required />
                            </div>
                        </div>

                        <GoldButton type="submit" disabled={loading} className="w-full mt-4">
                            {loading ? "Creating..." : "Create Route"}
                        </GoldButton>

                        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                            <p>ℹ️ <strong>Pricing Hierarchy:</strong> Shared ride uses the Per-Seat Fixed Price + Platform Fee. Private ride automatically multiplies the base by 3.5x (or uses your custom Private Base).</p>
                        </div>
                    </form>

                    <div className="h-[400px] rounded-2xl overflow-hidden border border-border relative shadow-lg">
                        <PlatformMap
                            center={mapCenter}
                            zoom={13}
                            markers={markers}
                            onCenterChanged={(c) => setMapCenter(c)}
                            interactive={true}
                            className="w-full h-full"
                        />

                        {selectionMode && (
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-2xl border-2 border-white ${selectionMode === 'pickup' ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'} animate-bounce`}>
                                    {selectionMode === 'pickup' ? <MapPin className="w-5 h-5" /> : <Flag className="w-5 h-5" />}
                                </div>
                                <div className="w-2.5 h-1 bg-black/40 rounded-full blur-[1px] mt-1" />
                            </div>
                        )}

                        {selectionMode && (
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/90 text-white px-4 py-2 rounded-full z-30 shadow-2xl border border-gold/50 flex items-center gap-3">
                                <span className="text-xs font-semibold">
                                    Aim at <strong>{selectionMode.toUpperCase()}</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={handleConfirmCenterAsLocation}
                                    className="px-3 py-1 bg-gold text-black rounded-lg text-xs font-bold active:scale-95 shadow cursor-pointer hover:bg-gold/90 transition-transform"
                                >
                                    Confirm Here
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode(null)}
                                    className="text-white/60 hover:text-white text-xs p-1"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </GlassCard>

            <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Existing Fixed Routes</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-muted-foreground text-sm border-b border-border">
                                <th className="pb-3">Route</th>
                                <th className="pb-3">Shared Fare</th>
                                <th className="pb-3">Private Fare</th>
                                <th className="pb-3">Tolerance</th>
                                <th className="pb-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-foreground">
                            {routes.map(route => {
                                const sharedTotal = (route.fixed_price || 0) + (route.flat_commission || 5);
                                const privBase = route.private_fixed_price || (route.fixed_price * 3.5);
                                const privTotal = privBase + Math.round(privBase * 0.1);
                                return (
                                    <tr key={route.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                        <td className="py-3 pr-4 font-medium">{route.pickup_name} → {route.dropoff_name}</td>
                                        <td className="py-3 font-mono font-bold">K{sharedTotal.toFixed(2)}</td>
                                        <td className="py-3 font-mono font-bold text-gold">K{privTotal.toFixed(2)}</td>
                                        <td className="py-3">{route.tolerance_radius_meters}m</td>
                                        <td className="py-3 text-right">
                                            <button onClick={() => handleDelete(route.id)} className="p-2 hover:bg-muted/50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
};

export default FixedRouteManager;
