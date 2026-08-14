import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useAuth } from '../../context/AuthContext';
import { GlassCard, GlassInput, GoldButton } from '../common/GlassComponents';
import { Trash2, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';

// Fix Leaflet marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const DestLocationMarker = ({ position, setPosition }) => {
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
        },
    });

    return position === null ? null : (
        <Marker position={position} />
    );
};

export const AdminDestinations = () => {
    const { api } = useAuth();
    const [destinations, setDestinations] = useState([]);
    const [newDestName, setNewDestName] = useState('');
    const [selectedPos, setSelectedPos] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        fetchDestinations();
    }, []);

    const fetchDestinations = async () => {
        try {
            const response = await api.get('/popular-destinations');
            setDestinations(response.data);
        } catch (error) {
            toast.error("Failed to fetch destinations");
        }
    };

    const handleSearchPlaces = async (q) => {
        setNewDestName(q);
        if (!q || q.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await api.get(`/places/search?q=${encodeURIComponent(q)}`);
            setSearchResults(res.data || []);
        } catch (e) {
            setSearchResults([]);
        }
    };

    const handleSelectPlace = (place) => {
        setNewDestName(place.display_name);
        setSelectedPos({ lat: place.lat, lng: place.lon });
        setSearchResults([]);
        toast.success(`Location set: ${place.display_name}`);
    };

    const handleCreate = async () => {
        if (!newDestName || !selectedPos) {
            toast.error("Please enter a name and select a location on the map");
            return;
        }

        setLoading(true);
        try {
            await api.post('/admin/popular-destinations', {
                name: newDestName,
                latitude: selectedPos.lat,
                longitude: selectedPos.lng
            });
            toast.success("Destination created");
            setNewDestName('');
            setSelectedPos(null);
            fetchDestinations();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Failed to create destination");
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async (id) => {
        try {
            await api.patch(`/admin/popular-destinations/${id}?active=false`);
            toast.success("Destination deactivated");
            fetchDestinations();
        } catch (error) {
            toast.error("Failed to deactivate");
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create Section */}
                <GlassCard className="p-6">
                    <h2 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-gold" />
                        Add New Destination
                    </h2>

                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-sm text-muted-foreground mb-2">Destination Name / Search Place</label>
                            <GlassInput
                                placeholder="Search e.g. South Gate, Kobil..."
                                value={newDestName}
                                onChange={(e) => handleSearchPlaces(e.target.value)}
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-black/90 border border-gold/30 rounded-xl max-h-40 overflow-y-auto z-[2000] shadow-xl">
                                    {searchResults.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => handleSelectPlace(p)}
                                            className="p-2 hover:bg-gold/20 text-xs text-foreground cursor-pointer transition-colors border-b border-white/5"
                                        >
                                            <div className="font-semibold">{p.display_name}</div>
                                            <div className="text-[10px] text-muted-foreground">{p.category}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="h-64 rounded-xl overflow-hidden border border-white/10 relative">
                            <MapContainer
                                center={[-14.42, 28.45]} // Default center (Kabwe/Mulungushi)
                                zoom={14}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap contributors'
                                />
                                <DestLocationMarker position={selectedPos} setPosition={setSelectedPos} />
                            </MapContainer>

                            {!selectedPos && (
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none z-[1000]">
                                    Click map to place marker
                                </div>
                            )}
                        </div>

                        {selectedPos && (
                            <p className="text-xs text-emerald-400">
                                Selected: {selectedPos.lat.toFixed(5)}, {selectedPos.lng.toFixed(5)}
                            </p>
                        )}

                        <GoldButton
                            onClick={handleCreate}
                            disabled={loading || !selectedPos || !newDestName}
                            className="w-full"
                        >
                            {loading ? "Saving..." : "Save Destination"}
                        </GoldButton>
                    </div>
                </GlassCard>

                {/* List Section */}
                <GlassCard className="p-6">
                    <h2 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gold" />
                        Active Destinations
                    </h2>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {destinations.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No active destinations found.</p>
                        ) : (
                            destinations.map(dest => (
                                <div key={dest.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                                            <MapPin className="w-4 h-4 text-gold" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground">{dest.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {dest.latitude.toFixed(4)}, {dest.longitude.toFixed(4)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeactivate(dest.id)}
                                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Deactivate"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};
