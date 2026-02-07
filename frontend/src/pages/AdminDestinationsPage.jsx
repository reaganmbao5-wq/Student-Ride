import React, { useState, useEffect } from 'react';
import { Plus, Trash2, MapPin, Search, Loader2 } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton } from '../components/common/GlassComponents';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AdminDestinationsPage = () => {
    const { api } = useAuth();
    const [destinations, setDestinations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [newDest, setNewDest] = useState({
        name: '',
        address: '',
        latitude: -14.43, // Default Kabwe approx
        longitude: 28.45,
        longitude: 28.45,
        estimated_fare: 25,
        base_price: 25,
        estimated_distance_km: 5,
        is_active: true
    });

    const fetchDestinations = async () => {
        try {
            const response = await api.get('/destinations');
            setDestinations(response.data);
        } catch (error) {
            console.error('Error fetching destinations:', error);
            toast.error('Failed to load destinations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDestinations();
    }, []);

    const handleAddDestination = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/destinations', newDest);
            toast.success('Destination added successfully');
            setShowAddModal(false);
            setNewDest({
                name: '',
                address: '',
                latitude: -14.43,
                longitude: 28.45,
                longitude: 28.45,
                estimated_fare: 25,
                base_price: 25,
                estimated_distance_km: 5,
                is_active: true
            });
            fetchDestinations();
        } catch (error) {
            console.error('Error creating destination:', error);
            toast.error('Failed to add destination');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this destination?')) return;

        try {
            await api.delete(`/admin/destinations/${id}`);
            toast.success('Destination deleted');
            setDestinations(destinations.filter(d => d.id !== id));
        } catch (error) {
            console.error('Error deleting destination:', error);
            toast.error('Failed to delete destination');
        }
    };

    const filteredDestinations = destinations.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white font-heading">Destinations & Pricing</h1>
                        <p className="text-white/60">Manage trip destinations and base fares</p>
                    </div>
                    <GoldButton onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Destination
                    </GoldButton>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                        type="text"
                        placeholder="Search destinations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-gold/50 transition-all"
                    />
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-gold" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredDestinations.map((dest) => (
                            <GlassCard key={dest.id} className="p-4 group hover:border-gold/30 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-gold" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{dest.name}</h3>
                                            <p className="text-sm text-white/60">{dest.address}</p>
                                            <p className="text-sm text-gold mt-1">K{dest.estimated_fare.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(dest.id)}
                                        className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </GlassCard>
                        ))}

                        {filteredDestinations.length === 0 && (
                            <div className="col-span-full py-12 text-center text-white/40">
                                No destinations found
                            </div>
                        )}
                    </div>
                )}

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="w-full max-w-md">
                            <GlassCard className="p-6">
                                <h2 className="text-xl font-bold text-white mb-6">Add New Destination</h2>
                                <form onSubmit={handleAddDestination} className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-white/60 mb-1">Name</label>
                                        <GlassInput
                                            required
                                            value={newDest.name}
                                            onChange={e => setNewDest({ ...newDest, name: e.target.value })}
                                            placeholder="e.g. Great North Mall"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-white/60 mb-1">Address/Description</label>
                                        <GlassInput
                                            required
                                            value={newDest.address}
                                            onChange={e => setNewDest({ ...newDest, address: e.target.value })}
                                            placeholder="e.g. Town Center"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-white/60 mb-1">Latitude</label>
                                            <GlassInput
                                                type="number"
                                                step="any"
                                                value={newDest.latitude}
                                                onChange={e => setNewDest({ ...newDest, latitude: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-white/60 mb-1">Longitude</label>
                                            <GlassInput
                                                type="number"
                                                step="any"
                                                value={newDest.longitude}
                                                onChange={e => setNewDest({ ...newDest, longitude: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-white/60 mb-1">Base Price (K)</label>
                                            <GlassInput
                                                required
                                                type="number"
                                                step="0.01"
                                                value={newDest.base_price}
                                                onChange={e => setNewDest({
                                                    ...newDest,
                                                    base_price: parseFloat(e.target.value),
                                                    estimated_fare: parseFloat(e.target.value) // Sync for legacy
                                                })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-white/60 mb-1">Est. Distance (km)</label>
                                            <GlassInput
                                                required
                                                type="number"
                                                step="0.1"
                                                value={newDest.estimated_distance_km}
                                                onChange={e => setNewDest({ ...newDest, estimated_distance_km: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddModal(false)}
                                            className="flex-1 py-3 rounded-xl bg-white/5 text-white/60 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <GoldButton type="submit" className="flex-1">
                                            Save Destination
                                        </GoldButton>
                                    </div>
                                </form>
                            </GlassCard>
                        </div>
                    </div>
                )}
            </div>
        </Layout >
    );
};

export default AdminDestinationsPage;
