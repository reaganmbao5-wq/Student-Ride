
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard, GlassInput, GoldButton } from '../common/GlassComponents';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { MapPin, Navigation, Trash2, Plus, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for Pickup/Dropoff
const pickupIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const dropoffIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const LocationSelector = ({ mode, onSelect }) => {
    useMapEvents({
        click(e) {
            if (mode) {
                onSelect(e.latlng);
            }
        },
    });
    return null;
};

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
        tolerance_radius_meters: 500
    });

    // Map Selection State
    const [pickupCoords, setPickupCoords] = useState(null);
    const [dropoffCoords, setDropoffCoords] = useState(null);
    const [selectionMode, setSelectionMode] = useState(null); // 'pickup' or 'dropoff' or null

    // Place Search States
    const [pickupSearch, setPickupSearch] = useState('');
    const [pickupResults, setPickupResults] = useState([]);
    const [dropoffSearch, setDropoffSearch] = useState('');
    const [dropoffResults, setDropoffResults] = useState([]);

    useEffect(() => {
        fetchRoutes();
    }, []);

    const fetchRoutes = async () => {
        try {
            const res = await api.get('/admin/fixed-routes');
            setRoutes(res.data);
        } catch (error) {
            toast.error("Failed to load routes");
        }
    };

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
            setForm({ pickup_name: '', dropoff_name: '', fixed_price: '', flat_commission: '5.00', tolerance_radius_meters: 500 });
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

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Driver Base Price (K)</label>
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
                            <p>ℹ️ <strong>How it works:</strong> If a student requests a ride starting near the Pickup point and ending near the Dropoff point (within tolerance), this Fixed Price will be used instead of the distance calculation.</p>
                        </div>
                    </form>

                    {/* Map Side */}
                    <div className="h-[400px] rounded-xl overflow-hidden border border-white/10 relative">
                        <MapContainer
                            center={[-14.43, 28.45]}
                            zoom={13}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; OpenStreetMap contributors'
                            />
                            <LocationSelector mode={selectionMode} onSelect={handleMapSelect} />

                            {pickupCoords && (
                                <Marker position={pickupCoords} icon={pickupIcon}>
                                    <Popup>Pickup: {form.pickup_name || 'Selected'}</Popup>
                                </Marker>
                            )}

                            {dropoffCoords && (
                                <Marker position={dropoffCoords} icon={dropoffIcon}>
                                    <Popup>Dropoff: {form.dropoff_name || 'Selected'}</Popup>
                                </Marker>
                            )}
                        </MapContainer>

                        {selectionMode && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full z-[1000] shadow-lg border border-gold/50 animate-pulse">
                                Click map to set <strong>{selectionMode.toUpperCase()}</strong> location
                            </div>
                        )}
                    </div>
                </div>
            </GlassCard>

            {/* List */}
            <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Existing Routes</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-muted-foreground text-sm border-b border-border">
                                <th className="pb-3">Route</th>
                                <th className="pb-3">Fixed Price</th>
                                <th className="pb-3">Tolerance</th>
                                <th className="pb-3">Status</th>
                                <th className="pb-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-foreground">
                            {routes.map(route => (
                                <tr key={route.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                    <td className="py-3 pr-4">
                                        <div className="font-medium">{route.pickup_name} → {route.dropoff_name}</div>
                                    </td>
                                    <td className="py-3">K{route.fixed_price.toFixed(2)}</td>
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
                            ))}
                            {routes.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-muted-foreground">No fixed routes defined.</td>
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
