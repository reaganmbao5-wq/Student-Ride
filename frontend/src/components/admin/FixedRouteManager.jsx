import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard, GlassInput, GoldButton } from '../common/GlassComponents';
import { 
    MapPin, 
    Navigation, 
    Trash2, 
    Flag, 
    X, 
    Search, 
    Edit2, 
    Check, 
    ChevronLeft, 
    ChevronRight, 
    Plus, 
    SlidersHorizontal,
    Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { PlatformMap } from '../../map/components/PlatformMap';

const FixedRouteManager = () => {
    const { api } = useAuth();
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Search and Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZone, setSelectedZone] = useState('all'); // 'all' | 'up_down' | 'across' | 'town'
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Edit Modal State
    const [editingRoute, setEditingRoute] = useState(null);
    const [editForm, setEditForm] = useState({
        fixed_price: '',
        flat_commission: '',
        private_fixed_price: '',
        private_flat_commission: '',
        tolerance_radius_meters: 250,
        is_active: true
    });
    const [editSaving, setEditSaving] = useState(false);

    // Create Route Form State
    const [form, setForm] = useState({
        pickup_name: '',
        dropoff_name: '',
        fixed_price: '20',
        flat_commission: '1',
        private_fixed_price: '50',
        private_flat_commission: '2',
        tolerance_radius_meters: 250,
        zone: 'up_down'
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
        setLoading(true);
        try {
            const res = await api.get('/admin/fixed-routes?limit=5000');
            setRoutes(res.data || []);
        } catch (error) {
            toast.error("Failed to load routes from backend");
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        fetchRoutes();
    }, [fetchRoutes]);

    // Summary Counts
    const counts = useMemo(() => {
        const total = routes.length;
        const upDown = routes.filter(r => r.zone === 'up_down').length;
        const across = routes.filter(r => r.zone === 'across').length;
        const town = routes.filter(r => r.zone === 'town').length;
        const active = routes.filter(r => r.is_active).length;
        return { total, upDown, across, town, active };
    }, [routes]);

    // Filtered Routes
    const filteredRoutes = useMemo(() => {
        return routes.filter(route => {
            // Zone Filter
            if (selectedZone !== 'all' && route.zone !== selectedZone) {
                return false;
            }
            // Status Filter
            if (statusFilter === 'active' && !route.is_active) return false;
            if (statusFilter === 'inactive' && route.is_active) return false;

            // Search Term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const pName = (route.pickup_name || '').toLowerCase();
                const dName = (route.dropoff_name || '').toLowerCase();
                const zone = (route.zone || '').toLowerCase();
                const tags = Array.isArray(route.tags) ? route.tags.join(' ').toLowerCase() : '';
                return pName.includes(term) || dName.includes(term) || zone.includes(term) || tags.includes(term);
            }

            return true;
        });
    }, [routes, selectedZone, statusFilter, searchTerm]);

    // Paginated Routes
    const paginatedRoutes = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRoutes.slice(start, start + pageSize);
    }, [filteredRoutes, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredRoutes.length / pageSize) || 1;

    // Reset pagination on search/filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedZone, statusFilter, pageSize]);

    // Handle Edit Open
    const handleOpenEdit = (route) => {
        setEditingRoute(route);
        setEditForm({
            fixed_price: Math.round(route.fixed_price || 20),
            flat_commission: Math.round(route.flat_commission != null ? route.flat_commission : 1),
            private_fixed_price: Math.round(route.private_fixed_price || 50),
            private_flat_commission: Math.round(route.private_flat_commission != null ? route.private_flat_commission : 2),
            tolerance_radius_meters: route.tolerance_radius_meters || 250,
            is_active: route.is_active !== false
        });
    };

    // Handle Save Edit
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingRoute) return;

        setEditSaving(true);
        try {
            const payload = {
                ...editingRoute,
                fixed_price: parseFloat(editForm.fixed_price),
                flat_commission: parseFloat(editForm.flat_commission),
                private_fixed_price: parseFloat(editForm.private_fixed_price),
                private_flat_commission: parseFloat(editForm.private_flat_commission),
                tolerance_radius_meters: parseInt(editForm.tolerance_radius_meters),
                is_active: editForm.is_active
            };

            await api.put(`/admin/fixed-routes/${editingRoute.id}`, payload);
            
            // Update local state
            setRoutes(prev => prev.map(r => r.id === editingRoute.id ? { ...r, ...payload } : r));
            toast.success(`Updated pricing for ${editingRoute.pickup_name} ↔ ${editingRoute.dropoff_name}`);
            setEditingRoute(null);
        } catch (error) {
            toast.error("Failed to update route pricing");
        } finally {
            setEditSaving(false);
        }
    };

    // Handle Quick Toggle Active
    const handleToggleActive = async (routeId) => {
        try {
            const res = await api.patch(`/admin/fixed-routes/${routeId}/toggle`);
            const newStatus = res.data?.is_active;
            setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, is_active: newStatus } : r));
            toast.success(`Route is now ${newStatus ? 'Active' : 'Inactive'}`);
        } catch (error) {
            toast.error("Failed to toggle route status");
        }
    };

    // Handle Delete
    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete route: ${name}?`)) return;
        try {
            await api.delete(`/admin/fixed-routes/${id}`);
            setRoutes(prev => prev.filter(r => r.id !== id));
            toast.success("Route deleted successfully");
        } catch (error) {
            toast.error("Failed to delete route");
        }
    };

    // Markers for Map Creator
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

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!pickupCoords || !dropoffCoords) {
            toast.error("Please pin both Pickup and Dropoff locations on map");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...form,
                fixed_price: parseFloat(form.fixed_price),
                flat_commission: parseFloat(form.flat_commission || 1.0),
                private_fixed_price: parseFloat(form.private_fixed_price || 50.0),
                private_flat_commission: parseFloat(form.private_flat_commission || 2.0),
                tolerance_radius_meters: parseInt(form.tolerance_radius_meters),
                is_active: true,
                tags: [form.pickup_name, form.dropoff_name, form.zone],
                pickup_coordinates: { type: "Point", coordinates: [pickupCoords.lng, pickupCoords.lat] },
                dropoff_coordinates: { type: "Point", coordinates: [dropoffCoords.lng, dropoffCoords.lat] }
            };

            const res = await api.post('/admin/fixed-routes', payload);
            toast.success("New fixed route created successfully");
            setRoutes(prev => [res.data, ...prev]);
            setForm({
                pickup_name: '',
                dropoff_name: '',
                fixed_price: '20',
                flat_commission: '1',
                private_fixed_price: '50',
                private_flat_commission: '2',
                tolerance_radius_meters: 250,
                zone: 'up_down'
            });
            setPickupCoords(null);
            setDropoffCoords(null);
            setShowCreateForm(false);
        } catch (error) {
            toast.error("Failed to create route");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GlassCard className="p-4 border-l-4 border-l-gold">
                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Seeded Routes</div>
                    <div className="text-2xl font-bold font-mono text-foreground mt-1">{counts.total}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{counts.active} active & live</div>
                </GlassCard>

                <GlassCard className="p-4 border-l-4 border-l-emerald-500">
                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Up ↔ Down School</div>
                    <div className="text-2xl font-bold font-mono text-foreground mt-1">{counts.upDown}</div>
                    <div className="text-[11px] text-emerald-400 mt-0.5">Shared K21 · Private K52</div>
                </GlassCard>

                <GlassCard className="p-4 border-l-4 border-l-blue-500">
                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Campus ↔ Across</div>
                    <div className="text-2xl font-bold font-mono text-foreground mt-1">{counts.across}</div>
                    <div className="text-[11px] text-blue-400 mt-0.5">Shared K31–37 · Private K73–83</div>
                </GlassCard>

                <GlassCard className="p-4 border-l-4 border-l-purple-500">
                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Campus ↔ Town (Kobil)</div>
                    <div className="text-2xl font-bold font-mono text-foreground mt-1">{counts.town}</div>
                    <div className="text-[11px] text-purple-400 mt-0.5">Shared K63–78 · Private K215–267</div>
                </GlassCard>
            </div>

            {/* Filter and Search Bar */}
            <GlassCard className="p-5">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <GlassInput
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by landmark (e.g. Computer Lab, Graduation Square, Chavuma, Town)..."
                            className="pl-10 pr-9 h-11 text-sm rounded-xl"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Zone Tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-2xl border border-white/5">
                        <button
                            type="button"
                            onClick={() => setSelectedZone('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                selectedZone === 'all'
                                    ? 'bg-gold text-black shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            All ({counts.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedZone('up_down')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                selectedZone === 'up_down'
                                    ? 'bg-gold text-black shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Up ↔ Down ({counts.upDown})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedZone('across')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                selectedZone === 'across'
                                    ? 'bg-gold text-black shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Across ({counts.across})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedZone('town')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                selectedZone === 'town'
                                    ? 'bg-gold text-black shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Town ({counts.town})
                        </button>
                    </div>

                    {/* Action button to open creator */}
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(prev => !prev)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 border border-border text-foreground flex items-center justify-center gap-2 transition-transform active:scale-95 shrink-0"
                    >
                        <Plus className="w-4 h-4 text-gold" />
                        {showCreateForm ? "Hide Route Creator" : "New Custom Route"}
                    </button>
                </div>
            </GlassCard>

            {/* Collapsible Create Route Card */}
            {showCreateForm && (
                <GlassCard className="p-6 border border-gold/30">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
                            <Navigation className="w-5 h-5 text-gold" />
                            Create New Custom Fixed Route
                        </h2>
                        <button onClick={() => setShowCreateForm(false)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Pickup Location Name</label>
                                    <GlassInput
                                        value={form.pickup_name}
                                        onChange={e => {
                                            setForm({ ...form, pickup_name: e.target.value });
                                            setPickupSearch(e.target.value);
                                            searchPlaces(e.target.value, setPickupResults);
                                        }}
                                        placeholder="Search e.g. Computer Lab..."
                                        required
                                    />
                                    {pickupResults.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-black/95 border border-gold/30 rounded-xl max-h-40 overflow-y-auto z-[2000] shadow-xl">
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
                                        {pickupCoords ? `Pickup Pinned (${pickupCoords.lat.toFixed(4)})` : selectionMode === 'pickup' ? 'Aim Crosshairs on Map...' : 'Pin on Map'}
                                    </button>
                                </div>

                                <div className="relative">
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Dropoff Location Name</label>
                                    <GlassInput
                                        value={form.dropoff_name}
                                        onChange={e => {
                                            setForm({ ...form, dropoff_name: e.target.value });
                                            setDropoffSearch(e.target.value);
                                            searchPlaces(e.target.value, setDropoffResults);
                                        }}
                                        placeholder="Search e.g. Graduation Square..."
                                        required
                                    />
                                    {dropoffResults.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-black/95 border border-gold/30 rounded-xl max-h-40 overflow-y-auto z-[2000] shadow-xl">
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
                                        {dropoffCoords ? `Dropoff Pinned (${dropoffCoords.lat.toFixed(4)})` : selectionMode === 'dropoff' ? 'Aim Crosshairs on Map...' : 'Pin on Map'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Shared Driver (K)</label>
                                    <GlassInput type="number" step="1" value={form.fixed_price} onChange={e => setForm({ ...form, fixed_price: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Shared Fee (K)</label>
                                    <GlassInput type="number" step="1" value={form.flat_commission} onChange={e => setForm({ ...form, flat_commission: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Private Driver (K)</label>
                                    <GlassInput type="number" step="1" value={form.private_fixed_price} onChange={e => setForm({ ...form, private_fixed_price: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Private Fee (K)</label>
                                    <GlassInput type="number" step="1" value={form.private_flat_commission} onChange={e => setForm({ ...form, private_flat_commission: e.target.value })} required />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Tolerance Radius (m)</label>
                                    <GlassInput type="number" step="25" value={form.tolerance_radius_meters} onChange={e => setForm({ ...form, tolerance_radius_meters: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Zone Category</label>
                                    <select
                                        value={form.zone}
                                        onChange={e => setForm({ ...form, zone: e.target.value })}
                                        className="w-full bg-muted/50 dark:bg-black/30 border border-border rounded-xl h-12 px-4 text-foreground text-sm focus:border-gold focus:outline-none"
                                    >
                                        <option value="up_down">Up ↔ Down School</option>
                                        <option value="across">Campus ↔ Across Road</option>
                                        <option value="town">Campus ↔ Town (Kobil)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <GoldButton type="submit" disabled={loading} className="w-full">
                                    {loading ? "Creating..." : "Save New Fixed Route"}
                                </GoldButton>
                            </div>
                        </form>

                        <div className="h-[350px] rounded-2xl overflow-hidden border border-border relative shadow-lg">
                            <PlatformMap
                                center={mapCenter}
                                zoom={14}
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
                                        Aim center at <strong>{selectionMode.toUpperCase()}</strong>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleConfirmCenterAsLocation}
                                        className="px-3 py-1 bg-gold text-black rounded-lg text-xs font-bold active:scale-95 shadow cursor-pointer hover:bg-gold/90 transition-transform"
                                    >
                                        Confirm Pin
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
            )}

            {/* Routes Table */}
            <GlassCard className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-lg font-bold font-heading text-foreground flex items-center gap-2">
                            <Layers className="w-5 h-5 text-gold" />
                            Live Pairwise Fixed Routes
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Showing {filteredRoutes.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRoutes.length)} of {filteredRoutes.length} matching routes
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                        <span className="text-xs text-muted-foreground">Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none"
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-muted-foreground text-xs uppercase tracking-wider bg-muted/30 border-b border-border">
                                <th className="py-3 px-4">Route Name & Zone</th>
                                <th className="py-3 px-3">Shared Ride</th>
                                <th className="py-3 px-3">Private Ride</th>
                                <th className="py-3 px-3">Tolerance</th>
                                <th className="py-3 px-3 text-center">Status</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-foreground text-sm divide-y divide-border/50">
                            {paginatedRoutes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                                        No fixed routes found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                paginatedRoutes.map((route) => {
                                    const sharedDriver = Math.round(route.fixed_price || 20);
                                    const sharedFee = Math.round(route.flat_commission != null ? route.flat_commission : 1);
                                    const sharedTotal = sharedDriver + sharedFee;

                                    const privDriver = Math.round(route.private_fixed_price || (sharedDriver * 3.5));
                                    const privFee = Math.round(route.private_flat_commission != null ? route.private_flat_commission : 2);
                                    const privTotal = privDriver + privFee;

                                    const zoneLabels = {
                                        up_down: { label: "Up ↔ Down", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                                        across: { label: "Across Road", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
                                        town: { label: "Town (Kobil)", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" }
                                    };
                                    const zoneBadge = zoneLabels[route.zone] || { label: route.zone || "Route", color: "bg-muted text-muted-foreground border-white/5" };

                                    return (
                                        <tr key={route.id} className="hover:bg-muted/40 transition-colors">
                                            {/* Route & Zone */}
                                            <td className="py-3.5 px-4 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${zoneBadge.color}`}>
                                                        {zoneBadge.label}
                                                    </span>
                                                </div>
                                                <div className="text-foreground font-semibold mt-1">
                                                    {route.pickup_name} <span className="text-gold">↔</span> {route.dropoff_name}
                                                </div>
                                            </td>

                                            {/* Shared Fare */}
                                            <td className="py-3.5 px-3">
                                                <div className="font-mono font-bold text-foreground">K{sharedTotal}</div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    Driver K{sharedDriver} + Fee K{sharedFee}
                                                </div>
                                            </td>

                                            {/* Private Fare */}
                                            <td className="py-3.5 px-3">
                                                <div className="font-mono font-bold text-gold">K{privTotal}</div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    Driver K{privDriver} + Fee K{privFee}
                                                </div>
                                            </td>

                                            {/* Tolerance Radius */}
                                            <td className="py-3.5 px-3 text-xs text-muted-foreground">
                                                {route.tolerance_radius_meters}m
                                            </td>

                                            {/* Active Toggle Switch */}
                                            <td className="py-3.5 px-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(route.id)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                                                        route.is_active
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}
                                                >
                                                    {route.is_active ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>

                                            {/* Action Buttons: 1-Click Edit Modal & Delete */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(route)}
                                                        title="Edit Route Pricing"
                                                        className="p-2 rounded-xl bg-muted/60 hover:bg-gold/20 text-muted-foreground hover:text-gold transition-colors active:scale-95"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(route.id, `${route.pickup_name} to ${route.dropoff_name}`)}
                                                        title="Delete Route"
                                                        className="p-2 rounded-xl bg-muted/60 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors active:scale-95"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
                        <div className="text-xs text-muted-foreground">
                            Page <span className="font-bold text-foreground">{currentPage}</span> of <span className="font-bold text-foreground">{totalPages}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed text-foreground flex items-center gap-1 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </button>

                            <button
                                type="button"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed text-foreground flex items-center gap-1 transition-all"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </GlassCard>

            {/* Edit Route Modal */}
            {editingRoute && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card text-card-foreground border border-gold/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <div className="text-xs uppercase font-bold text-gold tracking-wider">
                                    Edit Route Pricing (Bidirectional)
                                </div>
                                <h3 className="text-base font-bold font-heading text-foreground mt-1">
                                    {editingRoute.pickup_name} <span className="text-gold">↔</span> {editingRoute.dropoff_name}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingRoute(null)}
                                className="p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            {/* Shared Ride Inputs */}
                            <div className="bg-muted/30 p-4 rounded-2xl border border-white/5 space-y-3">
                                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Shared Ride (Per Seat)</span>
                                    <span className="text-emerald-400 font-mono">
                                        Student Total: K{Number(editForm.fixed_price || 0) + Number(editForm.flat_commission || 0)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-muted-foreground mb-1">Driver Base Fare (K)</label>
                                        <GlassInput
                                            type="number"
                                            step="1"
                                            value={editForm.fixed_price}
                                            onChange={e => setEditForm({ ...editForm, fixed_price: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-muted-foreground mb-1">Platform Fee (K)</label>
                                        <GlassInput
                                            type="number"
                                            step="1"
                                            value={editForm.flat_commission}
                                            onChange={e => setEditForm({ ...editForm, flat_commission: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Private Ride Inputs */}
                            <div className="bg-muted/30 p-4 rounded-2xl border border-white/5 space-y-3">
                                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Private Ride ("In Taka" Whole Car)</span>
                                    <span className="text-gold font-mono">
                                        Student Total: K{Number(editForm.private_fixed_price || 0) + Number(editForm.private_flat_commission || 0)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-muted-foreground mb-1">Private Driver Fare (K)</label>
                                        <GlassInput
                                            type="number"
                                            step="1"
                                            value={editForm.private_fixed_price}
                                            onChange={e => setEditForm({ ...editForm, private_fixed_price: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-muted-foreground mb-1">Private Platform Fee (K)</label>
                                        <GlassInput
                                            type="number"
                                            step="1"
                                            value={editForm.private_flat_commission}
                                            onChange={e => setEditForm({ ...editForm, private_flat_commission: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tolerance & Status */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Tolerance Radius (m)</label>
                                    <GlassInput
                                        type="number"
                                        step="25"
                                        value={editForm.tolerance_radius_meters}
                                        onChange={e => setEditForm({ ...editForm, tolerance_radius_meters: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1 font-semibold">Active Status</label>
                                    <div className="h-12 flex items-center gap-3 bg-muted/40 px-4 rounded-xl border border-border">
                                        <input
                                            type="checkbox"
                                            id="route_active_toggle"
                                            checked={editForm.is_active}
                                            onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                                            className="w-4 h-4 rounded text-gold focus:ring-gold accent-gold cursor-pointer"
                                        />
                                        <label htmlFor="route_active_toggle" className="text-xs font-semibold cursor-pointer">
                                            {editForm.is_active ? 'Route Active' : 'Route Inactive'}
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingRoute(null)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <GoldButton
                                    type="submit"
                                    disabled={editSaving}
                                    className="px-6 py-2.5 text-xs font-bold"
                                >
                                    {editSaving ? "Saving..." : "Save Route Changes"}
                                </GoldButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FixedRouteManager;
