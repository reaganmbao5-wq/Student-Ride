
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
        tolerance_radius_meters: 500
    });

    // Map Selection State
    const [pickupCoords, setPickupCoords] = useState(null);
    const [dropoffCoords, setDropoffCoords] = useState(null);
    const [selectionMode, setSelectionMode] = useState(null); // 'pickup' or 'dropoff' or null

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

    const handleMapSelect = (latlng) => {
        if (selectionMode === 'pickup') {
            setPickupCoords(latlng);
            toast.success("Pickup location set");
        } else if (selectionMode === 'dropoff') {
            setDropoffCoords(latlng);
            toast.success("Dropoff location set");
        }
        setSelectionMode(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!pickupCoords || !dropoffCoords) {
            toast.error("Please select both Pickup and Dropoff locations on the map");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...form,
                fixed_price: parseFloat(form.fixed_price),
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
            setForm({ pickup_name: '', dropoff_name: '', fixed_price: '', tolerance_radius_meters: 500 });
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
                <h2 className="text-xl font-heading font-semibold text-white mb-6 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-gold" />
                    Create New Fixed Route
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Form Side */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">Pickup Name</label>
                                <GlassInput
                                    value={form.pickup_name}
                                    onChange={e => setForm({ ...form, pickup_name: e.target.value })}
                                    placeholder="e.g. Main Gate"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('pickup')}
                                    className={`mt-2 w-full py-2 px-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2
                                        ${pickupCoords ? 'bg-emerald-500/20 text-emerald-400' : selectionMode === 'pickup' ? 'bg-gold text-black animate-pulse' : 'bg-white/10 text-white'}`}
                                >
                                    <MapPin className="w-4 h-4" />
                                    {pickupCoords ? 'Pickup Set' : selectionMode === 'pickup' ? 'Click on Map...' : 'Set on Map'}
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm text-white/60 mb-2">Dropoff Name</label>
                                <GlassInput
                                    value={form.dropoff_name}
                                    onChange={e => setForm({ ...form, dropoff_name: e.target.value })}
                                    placeholder="e.g. Admin Block"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setSelectionMode('dropoff')}
                                    className={`mt-2 w-full py-2 px-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2
                                        ${dropoffCoords ? 'bg-red-500/20 text-red-400' : selectionMode === 'dropoff' ? 'bg-gold text-black animate-pulse' : 'bg-white/10 text-white'}`}
                                >
                                    <MapPin className="w-4 h-4" />
                                    {dropoffCoords ? 'Dropoff Set' : selectionMode === 'dropoff' ? 'Click on Map...' : 'Set on Map'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">Fixed Price (K)</label>
                                <GlassInput
                                    type="number"
                                    step="0.5"
                                    value={form.fixed_price}
                                    onChange={e => setForm({ ...form, fixed_price: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">Tolerance (m)</label>
                                <GlassInput
                                    type="number"
                                    step="10"
                                    value={form.tolerance_radius_meters}
                                    onChange={e => setForm({ ...form, tolerance_radius_meters: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <GoldButton type="submit" disabled={loading} className="w-full mt-4">
                            {loading ? "Creating..." : "Create Route"}
                        </GoldButton>

                        <div className="text-xs text-white/40 bg-white/5 p-3 rounded-lg">
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
                <h3 className="text-lg font-semibold text-white mb-4">Existing Routes</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-white/40 text-sm border-b border-white/10">
                                <th className="pb-3">Route</th>
                                <th className="pb-3">Fixed Price</th>
                                <th className="pb-3">Tolerance</th>
                                <th className="pb-3">Status</th>
                                <th className="pb-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-white/80">
                            {routes.map(route => (
                                <tr key={route.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
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
                                            className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {routes.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-white/40">No fixed routes defined.</td>
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
