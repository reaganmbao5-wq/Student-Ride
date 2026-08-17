import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, Search, Calendar, RefreshCw, Car, User, Clock, 
  ArrowUpDown, Filter, Eye, CheckCircle2, XCircle, AlertCircle 
} from 'lucide-react';
import { GlassCard, StatusBadge, EmptyState } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminRidesSkeleton } from '../components/common/PageSkeletons';
import { AppCache } from '../utils/AppCache';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AdminRidesPage = () => {
  const { api } = useAuth();
  const [rides, setRides] = useState(() => AppCache.get('admin_rides') || []);
  const [loading, setLoading] = useState(() => !AppCache.get('admin_rides'));
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'fare_high' | 'distance'

  // Selected Ride Modal
  const [selectedRide, setSelectedRide] = useState(null);

  useEffect(() => {
    fetchRides(Boolean(AppCache.get('admin_rides')));
  }, []);

  const fetchRides = async (isBackground = false) => {
    try {
      if (!isBackground && rides.length === 0) setLoading(true);
      const response = await api.get('/admin/rides?limit=250');
      setRides(response.data);
      AppCache.set('admin_rides', response.data);
    } catch (error) {
      console.error('Error fetching rides:', error);
      toast.error('Failed to load rides');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Extract Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    rides.forEach(r => {
      if (r.created_at) {
        const y = new Date(r.created_at).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [rides]);

  // Filtered & Sorted Rides
  const processedRides = useMemo(() => {
    let result = rides.filter(ride => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        (ride.student?.name || '').toLowerCase().includes(searchLower) ||
        (ride.driver?.user?.name || '').toLowerCase().includes(searchLower) ||
        (ride.pickup_location?.name || ride.pickup_location?.address || '').toLowerCase().includes(searchLower) ||
        (ride.dropoff_location?.name || ride.dropoff_location?.address || '').toLowerCase().includes(searchLower) ||
        (ride.id || '').toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active') {
          const activeList = ['requested', 'accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'ongoing'];
          if (!activeList.includes(ride.status)) return false;
        } else if (ride.status !== statusFilter) {
          return false;
        }
      }

      // Date / Month / Year Filters
      if (ride.created_at) {
        const dateObj = new Date(ride.created_at);
        if (selectedYear !== 'all' && dateObj.getFullYear() !== parseInt(selectedYear, 10)) {
          return false;
        }
        if (selectedMonth !== 'all' && dateObj.getMonth() !== parseInt(selectedMonth, 10)) {
          return false;
        }
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortOrder === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortOrder === 'fare_high') return (b.fare || 0) - (a.fare || 0);
      if (sortOrder === 'distance') return (b.distance || 0) - (a.distance || 0);
      return 0;
    });

    return result;
  }, [rides, searchQuery, statusFilter, selectedMonth, selectedYear, sortOrder]);

  if (loading && rides.length === 0) {
    return <AdminRidesSkeleton />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-rides-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Ride Logs & Operations
            </h1>
            <p className="text-muted-foreground text-sm">
              Inspect trip routes, pricing, timestamps, passenger and driver assignments
            </p>
          </div>

          <button
            onClick={() => fetchRides(false)}
            className="p-2.5 rounded-2xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer self-start sm:self-auto"
            title="Refresh Rides"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-card/60 p-4 rounded-3xl border border-border">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by passenger, driver, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl pl-10 pr-4 py-2.5 border border-border focus:outline-none focus:border-gold"
            />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-3 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="active">Active / In Progress</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Month Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-3 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="all">All Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-3 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="all">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="md:col-span-2">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-3 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="newest">Time: Newest</option>
              <option value="oldest">Time: Oldest</option>
              <option value="fare_high">Highest Fare</option>
              <option value="distance">Longest Distance</option>
            </select>
          </div>
        </div>

        {/* Counter Bar */}
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground font-medium">
          <span>Showing <strong className="text-foreground">{processedRides.length}</strong> of {rides.length} recorded trips</span>
          {(searchQuery || statusFilter !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSelectedMonth('all');
                setSelectedYear('all');
                setSortOrder('newest');
              }}
              className="text-gold font-semibold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Desktop-Optimized Rides Table / List */}
        {processedRides.length > 0 ? (
          <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border shadow-sm">
            {/* Desktop Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4">Trip Route & Date</div>
              <div className="col-span-3">Passenger & Driver</div>
              <div className="col-span-2">Mode & Status</div>
              <div className="col-span-2">Pricing Breakdown</div>
              <div className="col-span-1 text-right">Details</div>
            </div>

            {/* Ride Rows */}
            {processedRides.map((ride) => {
              const formattedDate = ride.created_at
                ? new Date(ride.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'N/A';

              return (
                <div 
                  key={ride.id} 
                  className="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 lg:items-center hover:bg-muted/30 transition-colors"
                >
                  {/* Col 1: Route & Timestamp */}
                  <div className="lg:col-span-4 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                      <span className="truncate">{ride.pickup_location?.name || ride.pickup_location?.address || 'Pickup Point'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-4">
                      <span>→</span>
                      <span className="truncate">{ride.dropoff_location?.name || ride.dropoff_location?.address || 'Destination Point'}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                      <Calendar className="w-3 h-3" /> {formattedDate}
                    </p>
                  </div>

                  {/* Col 2: Passenger & Driver */}
                  <div className="lg:col-span-3 text-xs space-y-0.5">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      <span className="truncate">{ride.student?.name || 'Student Passenger'}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-gold" />
                      <span className="truncate">{ride.driver?.user?.name || (ride.driver_id ? 'Assigned Driver' : 'No driver assigned')}</span>
                    </p>
                  </div>

                  {/* Col 3: Mode & Status */}
                  <div className="lg:col-span-2 flex flex-col gap-1 items-start">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      ride.ride_mode === 'shared' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {ride.ride_mode || 'private'} ({ride.passenger_count || 1} pax)
                    </span>
                    <StatusBadge status={ride.status} />
                  </div>

                  {/* Col 4: Pricing */}
                  <div className="lg:col-span-2 text-xs">
                    <p className="font-bold text-foreground">ZMW {ride.fare?.toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ride.distance ? `${ride.distance.toFixed(1)} km` : '0 km'} • {ride.duration ? `${Math.round(ride.duration / 60)} min` : ''}
                    </p>
                    <p className="text-[10px] text-emerald-400">Comm: ZMW {ride.commission?.toFixed(2) || '0.00'}</p>
                  </div>

                  {/* Col 5: Inspect Details */}
                  <div className="lg:col-span-1 flex items-center justify-end">
                    <button
                      onClick={() => setSelectedRide(ride)}
                      className="p-2 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 transition-colors cursor-pointer"
                      title="View Full Trip Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={MapPin}
            title="No matching ride logs found"
            description="Try changing your search parameters or selecting a different status filter"
          />
        )}

        {/* Deep Ride Inspection Modal */}
        <Dialog open={!!selectedRide} onOpenChange={(open) => !open && setSelectedRide(null)}>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl">
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="text-lg font-bold flex items-center justify-between">
                <span>Trip Inspection Details</span>
                {selectedRide && <StatusBadge status={selectedRide.status} />}
              </DialogTitle>
            </DialogHeader>

            {selectedRide && (
              <div className="space-y-4 pt-3 text-xs">
                {/* Route Box */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-foreground">Pickup Location</p>
                      <p className="text-muted-foreground text-[11px]">{selectedRide.pickup_location?.name || selectedRide.pickup_location?.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 border-t border-border pt-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-foreground">Dropoff Location</p>
                      <p className="text-muted-foreground text-[11px]">{selectedRide.dropoff_location?.name || selectedRide.dropoff_location?.address}</p>
                    </div>
                  </div>
                </div>

                {/* Passenger & Driver Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Passenger</p>
                    <p className="font-bold text-foreground">{selectedRide.student?.name || 'Student'}</p>
                    <p className="text-muted-foreground text-[11px]">{selectedRide.student?.phone || 'No phone'}</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Driver</p>
                    <p className="font-bold text-foreground">{selectedRide.driver?.user?.name || 'Unassigned'}</p>
                    <p className="text-gold font-mono text-[11px]">{selectedRide.driver?.plate_number || 'No plate'}</p>
                  </div>
                </div>

                {/* Fare & Metrics */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground">Total Fare</p>
                    <p className="font-bold text-gold text-sm mt-0.5">ZMW {selectedRide.fare?.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground">Driver Earns</p>
                    <p className="font-bold text-emerald-400 text-sm mt-0.5">ZMW {selectedRide.driver_earning?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground">Commission</p>
                    <p className="font-bold text-foreground text-sm mt-0.5">ZMW {selectedRide.commission?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="p-3 rounded-2xl bg-muted/30 border border-border space-y-1 text-[11px] text-muted-foreground font-mono">
                  <p>Requested: {selectedRide.created_at ? new Date(selectedRide.created_at).toLocaleString() : 'N/A'}</p>
                  {selectedRide.accepted_at && <p>Accepted: {new Date(selectedRide.accepted_at).toLocaleString()}</p>}
                  {selectedRide.completed_at && <p>Completed: {new Date(selectedRide.completed_at).toLocaleString()}</p>}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedRide(null)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminRidesPage;
