import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { GlassCard, GlassInput, GoldButton } from '../common/GlassComponents';
import { MapPin, Navigation, Trash2, Plus, Edit2, Check, X, Flag } from 'lucide-react';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiamFleSIsImEiOiJjbXNocmV5ZXAwM3JlMnhzZ29raTB3eGc5In0.riXZQNEurCaETWjZt02R6A';

const FixedRouteManager = () => {
    const { api } = useAuth();
    const { theme } = useTheme();
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

    // Map Selection State
    const [pickupCoords, setPickupCoords] = useState(null);
    const [dropoffCoords, setDropoffCoords] = useState(null);
    const [selectionMode, setSelectionMode] = useState(null); // 'pickup' | 'dropoff' | null

    // Place Search States
    const [pickupSearch, setPickupSearch] = useState('');
    const [pickupResults, setPickupResults] = useState([]);
    const [dropoffSearch, setDropoffSearch] = useState('');
    const [dropoffResults, setDropoffResults] = useState([]);

    // Mapbox References
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const pickupMarkerRef = useRef(null);
    const dropoffMarkerRef = useRef(null);
    const selectionModeRef = useRef(selectionMode);

    useEffect(() => {
        selectionModeRef.current = selectionMode;
        if (mapInstanceRef.current) {
            const canvas = mapInstanceRef.current.getCanvas();
            if (canvas) {
                canvas.style.cursor = selectionMode ? 'crosshair' : '';
            }
        }
    }, [selectionMode]);

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

    // Initialize Mapbox Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: theme === 'light' ? 'mapbox://styles/mapbox/streets-v12' : 'mapbox://styles/mapbox/dark-v11',
            center: [28.45, -14.43], // Kabwe / Mulungushi Region
            zoom: 12.5,
            attributionControl: false
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

        map.on('click', (e) => {
            const mode = selectionModeRef.current;
            const latlng = { lat: e.lngLat.lat, lng: e.lngLat.lng };
            if (mode === 'pickup') {
                setPickupCoords(latlng);
                toast.success("Pickup location set on map");
                setSelectionMode(null);
            } else if (mode === 'dropoff') {
                setDropoffCoords(latlng);
                toast.success("Dropoff location set on map");
                setSelectionMode(null);
            }
        });

        mapInstanceRef.current = map;

        return () => {
            if (pickupMarkerRef.current) pickupMarkerRef.current.remove();
            if (dropoffMarkerRef.current) dropoffMarkerRef.current.remove();
            map.remove();
        };
    }, [theme]);

    // Update Pickup Marker on Map
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        const map = mapInstanceRef.current;

        if (pickupCoords) {
            if (!pickupMarkerRef.current) {
                const el = document.createElement('div');
                el.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl border-2 border-white cursor-pointer';
                el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
                
                pickupMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([pickupCoords.lng, pickupCoords.lat])
                    .addTo(map);
            } else {
                pickupMarkerRef.current.setLngLat([pickupCoords.lng, pickupCoords.lat]);
            }
        } else if (pickupMarkerRef.current) {
            pickupMarkerRef.current.remove();
            pickupMarkerRef.current = null;
        }

        // Adjust bounds if both markers exist
        if (pickupCoords && dropoffCoords) {
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([pickupCoords.lng, pickupCoords.lat]);
            bounds.extend([dropoffCoords.lng, dropoffCoords.lat]);
            map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
        } else if (pickupCoords) {
            map.flyTo({ center: [pickupCoords.lng, pickupCoords.lat], zoom: 14 });
        }
    }, [pickupCoords, dropoffCoords]);

    // Update Dropoff Marker on Map
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        const map = mapInstanceRef.current;

        if (dropoffCoords) {
            if (!dropoffMarkerRef.current) {
                const el = document.createElement('div');
                el.className = 'w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl border-2 border-white cursor-pointer';
                el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>';
                
                dropoffMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([dropoffCoords.lng, dropoffCoords.lat])
                    .addTo(map);
            } else {
                dropoffMarkerRef.current.setLngLat([dropoffCoords.lng, dropoffCoords.lat]);
            }
        } else if (dropoffMarkerRef.current) {
            dropoffMarkerRef.current.remove();
            dropoffMarkerRef.current = null;
        }

        if (dropoffCoords && !pickupCoords) {
            map.flyTo({ center: [dropoffCoords.lng, dropoffCoords.lat], zoom: 14 });
        }
    }, [dropoffCoords, pickupCoords]);

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
        const coords = { lat: place.lat, lng: place.lon };
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

    const handleMapSelect = (latlng) => {
        if (selectionMode === 'pickup') {
            setPickupCoords(latlng);
            toast.success("Pickup location set on map");
        } else if (selectionMode === 'dropoff') {
            setDropoffCoords(latlng);
            toast.success("Dropoff location set on map");
        }
        setSelectionMode(null);
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
                pickup_coordinates: {
                    type: "Point",
                    coordinates: [pickupCoords.lng, pickupCoords.lat]
                },
                dropoff_coordinates: {
                    type: "Point",
                    coordinates: [dropoffCoords.lng, dropoffCoords.lat]
                }
            };

            await api.post('/admin/fixed-routes', payload);
            toast.success("Fixed route created successfully");
            setForm({ pickup_name: '', dropoff_name: '', fixed_price: '', flat_commission: '5.00', private_fixed_price: '', tolerance_radius_meters: 500 });
            setPickupCoords(null);
            setDropoffCoords(null);
            setPickupSearch('');
            setDropoffSearch('');
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
                    {/* Form Side */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Pickup Selection */}
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
                                            <div
                                                key={p.id}
                                                onClick={() => handleSelectPlace(p, 'pickup')}
                                                className="p-2 hover:bg-gold/20 text-xs text-foreground cursor-pointer transition-colors border-b border-white/5"
                                            >
                                                <div className="font-semibold">{p.display_name}</div>
                                                <div className="text-[10px] text-muted-foreground">{p.category}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('pickup')}
                                    className={`mt-2 w-full py-1.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2
                                        ${pickupCoords ? 'bg-emerald-500/20 text-emerald-400' : selectionMode === 'pickup' ? 'bg-gold text-black animate-pulse' : 'bg-muted text-foreground'}`}
                                >
                                    <MapPin className="w-3.5 h-3.5" />
                                    {pickupCoords ? `Pickup Set (${pickupCoords.lat.toFixed(4)})` : selectionMode === 'pickup' ? 'Click on Map...' : 'Pin on Map'}
                                </button>
                            </div>

                            {/* Dropoff Selection */}
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
                                            <div
                                                key={p.id}
                                                onClick={() => handleSelectPlace(p, 'dropoff')}
                                                className="p-2 hover:bg-gold/20 text-xs text-foreground cursor-pointer transition-colors border-b border-white/5"
                                            >
                                                <div className="font-semibold">{p.display_name}</div>
                                                <div className="text-[10px] text-muted-foreground">{p.category}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('dropoff')}
                                    className={`mt-2 w-full py-1.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2
                                        ${dropoffCoords ? 'bg-red-500/20 text-red-400' : selectionMode === 'dropoff' ? 'bg-gold text-black animate-pulse' : 'bg-muted text-foreground'}`}
                                >
                                    <MapPin className="w-3.5 h-3.5" />
                                    {dropoffCoords ? `Dropoff Set (${dropoffCoords.lat.toFixed(4)})` : selectionMode === 'dropoff' ? 'Click on Map...' : 'Pin on Map'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Shared Driver (K)</label>
                                <GlassInput
                                    type="number"
                                    step="1"
                                    value={form.fixed_price}
                                    onChange={e => setForm({ ...form, fixed_price: e.target.value })}
                                    placeholder="e.g. 50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Platform Fee (K)</label>
                                <GlassInput
                                    type="number"
                                    step="0.5"
                                    value={form.flat_commission}
                                    onChange={e => setForm({ ...form, flat_commission: e.target.value })}
                                    placeholder="e.g. 5"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Private Base (K) <span className="text-[10px] text-muted-foreground/60">(Opt)</span></label>
                                <GlassInput
                                    type="number"
                                    step="1"
                                    value={form.private_fixed_price}
                                    onChange={e => setForm({ ...form, private_fixed_price: e.target.value })}
                                    placeholder="Auto 3.5x"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Tolerance (m)</label>
                                <GlassInput
                                    type="number"
                                    step="50"
                                    value={form.tolerance_radius_meters}
                                    onChange={e => setForm({ ...form, tolerance_radius_meters: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <GoldButton type="submit" disabled={loading} className="w-full mt-4">
                            {loading ? "Creating..." : "Create Route"}
                        </GoldButton>

                        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                            <p>ℹ️ <strong>Pricing Hierarchy:</strong> Shared ride uses the Per-Seat Fixed Price + Platform Fee. Private ride automatically multiplies the base by 3.5x (or uses your custom Private Base).</p>
                        </div>
                    </form>

                    {/* Mapbox Map Side */}
                    <div className="h-[400px] rounded-xl overflow-hidden border border-white/10 relative shadow-inner">
                        <div ref={mapContainerRef} className="w-full h-full" />

                        {selectionMode && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/90 text-white px-4 py-2 rounded-full z-[1000] shadow-lg border border-gold/50 animate-pulse text-xs font-semibold">
                                Click Mapbox map to set <strong>{selectionMode.toUpperCase()}</strong> location
                            </div>
                        )}
                    </div>
                </div>
            </GlassCard>

            {/* List */}
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
                                <th className="pb-3">Status</th>
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
                                        <td className="py-3 pr-4">
                                            <div className="font-medium">{route.pickup_name} → {route.dropoff_name}</div>
                                        </td>
                                        <td className="py-3">
                                            <span className="font-bold text-foreground font-mono">K{sharedTotal.toFixed(2)}</span>
                                            <span className="text-[10px] text-muted-foreground block font-mono">K{route.fixed_price.toFixed(2)} + K{(route.flat_commission || 5).toFixed(2)} fee</span>
                                        </td>
                                        <td className="py-3">
                                            <span className="font-bold text-gold font-mono">K{privTotal.toFixed(2)}</span>
                                            <span className="text-[10px] text-muted-foreground block font-mono">
                                                {route.private_fixed_price ? 'Custom Private' : '3.5x Multiplier'}
                                            </span>
                                        </td>
                                        <td className="py-3">{route.tolerance_radius_meters}m</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-1 rounded text-xs ${route.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {route.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(route.id)}
                                                className="p-2 hover:bg-muted/50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {routes.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="py-8 text-center text-muted-foreground">No fixed routes defined.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
};

export default FixedRouteManager;
