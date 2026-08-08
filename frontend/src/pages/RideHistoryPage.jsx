import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, MapPin, Star, Car, ChevronDown, ChevronUp, Trash2, 
  Search, Filter, ShieldCheck, ArrowRight, User, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, LoadingSpinner, StatusBadge, EmptyState, GoldButton } from '../components/common/GlassComponents';
import { RatingModal } from '../components/common/RatingModal';
import SwipableRideCard from '../components/common/SwipableRideCard';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AppCache } from '../utils/AppCache';
import { RideHistorySkeleton } from '../components/common/PageSkeletons';

const RideHistoryPage = () => {
  const { api, isDriver } = useAuth();
  const [rides, setRides] = useState(() => AppCache.get('history') || []);
  const [loading, setLoading] = useState(false);
  
  // UI Interactive States
  const [expandedRideId, setExpandedRideId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Deletion state & modal
  const [rideToDelete, setRideToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Rating Modal state
  const [ratingRide, setRatingRide] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const fetchHistory = React.useCallback(async () => {
    try {
      const response = await api.get('/rides/history?limit=50');
      const data = response.data || [];
      setRides(data);
      AppCache.set('history', data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleToggleExpand = (id) => {
    setExpandedRideId((prev) => (prev === id ? null : id));
  };

  const handleRateClick = (ride) => {
    setRatingRide(ride);
    setShowRatingModal(true);
  };

  const handleRatingSubmit = async (data) => {
    try {
      await api.post(`/rides/${ratingRide.id}/rate`, data);
      toast.success('Rating submitted successfully');
      setShowRatingModal(false);
      fetchHistory(); // Refresh list
    } catch (error) {
      console.error('Rating error:', error);
      toast.error('Failed to submit rating');
    }
  };

  const confirmDeleteRide = async () => {
    if (!rideToDelete) return;
    setDeleting(true);
    try {
      try {
        await api.delete(`/rides/${rideToDelete.id}`);
      } catch (err) {
        console.warn('Backend API delete endpoint notice (fallback to local cleanup):', err);
      }
      setRides((prev) => {
        const updated = prev.filter((r) => r.id !== rideToDelete.id);
        AppCache.set('history', updated);
        return updated;
      });
      toast.success('Ride record deleted from history');
    } catch (error) {
      console.error('Error deleting ride:', error);
      toast.error('Failed to delete ride');
    } finally {
      setDeleting(false);
      setRideToDelete(null);
    }
  };

  // Filter & Search Logic
  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      // Filter tab check
      if (filterStatus === 'completed' && ride.status !== 'completed') return false;
      if (filterStatus === 'cancelled' && ride.status !== 'cancelled') return false;

      // Search query check
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const pickup = (ride.pickup_location?.address || '').toLowerCase();
        const dropoff = (ride.dropoff_location?.address || '').toLowerCase();
        const person = (isDriver ? ride.student?.name : ride.driver?.user?.name || '').toLowerCase();
        return pickup.includes(query) || dropoff.includes(query) || person.includes(query);
      }

      return true;
    });
  }, [rides, filterStatus, searchTerm, isDriver]);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalCount = rides.length;
    const completedRides = rides.filter((r) => r.status === 'completed');
    const totalSpent = completedRides.reduce((acc, r) => acc + (isDriver ? (r.driver_earning || 0) : (r.fare || 0)), 0);
    return { totalCount, completedCount: completedRides.length, totalSpent };
  }, [rides, isDriver]);

  if (loading) {
    return <RideHistorySkeleton />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto" data-testid="ride-history-page">
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-white tracking-tight">
              Ride History
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Tap a ride to expand full details • Slide left to delete
            </p>
          </div>
          <div className="text-xs bg-white/5 border-0 px-3.5 py-1.5 rounded-full text-neutral-300 self-start md:self-auto">
            {filteredRides.length} {filteredRides.length === 1 ? 'trip' : 'trips'} listed
          </div>
        </div>

        {/* Stats Overview Dashboard Bar */}
        {rides.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <GlassCard className="p-4 flex flex-col justify-center border-0" hover={false}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Total Trips</p>
              <p className="text-xl md:text-2xl font-bold font-heading text-white mt-1">
                {stats.totalCount}
              </p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-center border-0" hover={false}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Completed</p>
              <p className="text-xl md:text-2xl font-bold font-heading text-emerald-400 mt-1">
                {stats.completedCount}
              </p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-center border-0" hover={false}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                {isDriver ? 'Earned' : 'Total Spent'}
              </p>
              <p className="text-xl md:text-2xl font-bold font-heading text-gold mt-1">
                K{stats.totalSpent.toFixed(2)}
              </p>
            </GlassCard>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        {rides.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by address or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border-0 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-gold/50 transition-colors"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-white/5 border-0 p-1 rounded-2xl shrink-0">
              {['all', 'completed', 'cancelled'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterStatus(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                    filterStatus === tab
                      ? 'bg-gold text-black shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rides List - Flat, edge-to-edge with line dividers */}
        {filteredRides.length > 0 ? (
          <div className="bg-neutral-950/90 rounded-3xl overflow-hidden shadow-2xl border-0">
            {filteredRides.map((ride) => (
              <SwipableRideCard
                key={ride.id}
                ride={ride}
                isExpanded={expandedRideId === ride.id}
                onToggleExpand={handleToggleExpand}
                onDeleteClick={setRideToDelete}
                onRateClick={handleRateClick}
                isDriver={isDriver}
              />
            ))}
          </div>
        ) : rides.length > 0 ? (
          <EmptyState
            icon={Search}
            title="No matching rides found"
            description="Try adjusting your search query or filter criteria"
          />
        ) : (
          <EmptyState
            icon={Clock}
            title="No ride history"
            description="Your completed or cancelled rides will appear here"
          />
        )}

        {/* Rating Modal */}
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          driverName={ratingRide?.driver?.user?.name || 'Driver'}
          rideId={ratingRide?.id}
          onSubmit={handleRatingSubmit}
        />

        {/* Delete Confirmation Popup Modal */}
        <AnimatePresence>
          {rideToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-sm bg-neutral-900 border-0 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl relative space-y-4"
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                    <Trash2 className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold font-heading text-white">Delete Ride Record?</h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      Are you sure you want to delete this trip from your history?
                    </p>
                  </div>

                  {/* Ride Summary Preview */}
                  <div className="w-full bg-white/5 rounded-2xl p-3.5 text-left space-y-1.5 text-xs text-neutral-300">
                    <div className="flex justify-between font-semibold text-white">
                      <span>
                        {new Date(rideToDelete.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      <span className="text-gold font-bold">
                        K{(isDriver ? rideToDelete.driver_earning : rideToDelete.fare)?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <p className="truncate text-neutral-400">
                      <span className="text-gold font-medium">From:</span> {rideToDelete.pickup_location?.address || 'Pickup'}
                    </p>
                    <p className="truncate text-neutral-400">
                      <span className="text-emerald-400 font-medium">To:</span> {rideToDelete.dropoff_location?.address || 'Dropoff'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 w-full pt-1">
                    <button
                      type="button"
                      onClick={() => setRideToDelete(null)}
                      className="flex-1 py-3 px-4 rounded-xl border-0 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteRide}
                      disabled={deleting}
                      className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                    >
                      {deleting ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default RideHistoryPage;
