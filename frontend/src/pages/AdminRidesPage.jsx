import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, Search, Calendar, RefreshCw, User, Clock, 
  ArrowUpDown, Filter, Eye, CheckCircle2, XCircle, AlertCircle, X,
  Star, MessageSquare
} from 'lucide-react';
import { SteeringWheel, Car } from '@phosphor-icons/react';
import { GlassCard, StatusBadge, EmptyState, RatingStars } from '../components/common/GlassComponents';
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
      const data = Array.isArray(response.data) ? response.data : [];
      setRides(data);
      AppCache.set('admin_rides', data);
    } catch (error) {
      console.error('Error fetching rides:', error);
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  // Available Years
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
      const studentName = ride.student?.name || '';
      const driverName = ride.driver?.user?.name || '';
      const pickup = ride.pickup_location?.name || ride.pickup_location?.address || '';
      const dropoff = ride.dropoff_location?.name || ride.dropoff_location?.address || '';

      const matchesSearch =
        studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pickup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dropoff.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ride.id && ride.id.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'completed' || statusFilter === 'ride_completed') {
          if (!['completed', 'ride_completed', 'settlement', 'ride_archived', 'completed_ride'].includes(ride.status)) {
            return false;
          }
        } else if (statusFilter === 'in_progress' || statusFilter === 'ongoing') {
          if (!['ongoing', 'ride_started', 'ride_in_progress', 'passenger_boarding', 'driver_arrived', 'driver_en_route_to_pickup', 'driver_accepted', 'accepted'].includes(ride.status)) {
            return false;
          }
        } else if (ride.status !== statusFilter) {
          return false;
        }
      }

      // Date Filters
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

    // Sorting
    result.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortOrder === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortOrder === 'fare_high') return (b.fare || 0) - (a.fare || 0);
      if (sortOrder === 'distance') return (b.distance_km || 0) - (a.distance_km || 0);
      return 0;
    });

    return result;
  }, [rides, searchQuery, statusFilter, selectedMonth, selectedYear, sortOrder]);

  if (loading && rides.length === 0) {
    return (
      <Layout>
        <AdminRidesSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-rides-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Ride Management
            </h1>
            <p className="text-muted-foreground text-sm">
              Comprehensive audit log of all requested, active, and completed campus rides
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

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 bg-card/60 p-4 rounded-3xl border border-border">
          {/* Search Input */}
          <div className="sm:col-span-2 md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search rider, driver, pickup, or ride ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl pl-10 pr-4 py-2.5 border border-border focus:outline-none focus:border-gold placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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
              <option value="in_progress">In Progress</option>
              <option value="requested">Requested</option>
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
                  <div className="lg:col-span-4 space-y-1 min-w-0">
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

                  {/* Col 2: Passenger & Driver (Updated Phosphor SteeringWheel) */}
                  <div className="lg:col-span-3 text-xs space-y-0.5 min-w-0">
                    <p className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{ride.student?.name || 'Student Passenger'}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                      <SteeringWheel weight="duotone" className="w-3.5 h-3.5 text-gold shrink-0" />
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
                    <p className="font-bold text-gold text-sm">ZMW {ride.fare?.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Earns: K{ride.driver_earning?.toFixed(2) || (ride.fare * 0.85).toFixed(2)} • Comm: K{ride.commission?.toFixed(2) || (ride.fare * 0.15).toFixed(2)}
                    </p>
                  </div>

                  {/* Col 5: Inspection Button */}
                  <div className="lg:col-span-1 flex items-center justify-end">
                    <button
                      onClick={() => setSelectedRide(ride)}
                      className="p-2 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 text-xs font-bold transition-colors cursor-pointer"
                      title="View Complete Ride Details"
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
            title="No matching rides found"
            description="Try changing your search terms or adjusting the date/status filter"
          />
        )}

        {/* FULL SCREEN / MAXIMUM VIEWPORT MODAL FOR RIDE INSPECTION */}
        {selectedRide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200">
            <div className="bg-card text-foreground border border-border w-full h-full max-w-6xl max-h-[96vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
              {/* Sticky Top Navigation Header */}
              <div className="px-6 py-4 md:px-8 md:py-5 border-b border-border flex items-center justify-between bg-card/95 backdrop-blur shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold font-heading text-lg">
                    <MapPin className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-extrabold text-foreground flex items-center gap-2">
                      <span>Trip Inspection & Audit</span>
                      <StatusBadge status={selectedRide.status} />
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono">ID: {selectedRide.id}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRide(null)}
                  className="p-2 rounded-2xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                  title="Close Window"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8 space-y-6 min-w-0">
                <div className="space-y-6 w-full max-w-full">
                  {/* Route Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-2 overflow-hidden">
                      <p className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 shrink-0" />
                        Pickup Point
                      </p>
                      <p className="font-bold text-foreground text-base break-words whitespace-normal">{selectedRide.pickup_location?.name || 'Pickup Point'}</p>
                      <p className="text-xs text-muted-foreground break-words whitespace-normal">{selectedRide.pickup_location?.address}</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-2 overflow-hidden">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 shrink-0" />
                        Dropoff Destination
                      </p>
                      <p className="font-bold text-foreground text-base break-words whitespace-normal">{selectedRide.dropoff_location?.name || 'Dropoff Point'}</p>
                      <p className="text-xs text-muted-foreground break-words whitespace-normal">{selectedRide.dropoff_location?.address}</p>
                    </div>
                  </div>

                  {/* People Involved */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passenger Details</p>
                      <p className="font-bold text-foreground text-base">{selectedRide.student?.name || 'Student'}</p>
                      <p className="text-xs text-muted-foreground">{selectedRide.student?.email || 'No email'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedRide.student?.phone || 'No phone'}</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned Driver</p>
                      <p className="font-bold text-foreground text-base">{selectedRide.driver?.user?.name || (selectedRide.driver_id ? 'Assigned Driver' : 'Unassigned')}</p>
                      <p className="text-xs text-muted-foreground">{selectedRide.driver?.user?.email || 'No email'}</p>
                      <p className="text-xs text-gold font-mono">{selectedRide.driver?.plate_number ? `Plate: ${selectedRide.driver.plate_number}` : ''}</p>
                    </div>
                  </div>

                  {/* Passenger Rating & Review Feedback */}
                  <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                        <Star className="w-4 h-4 shrink-0 fill-gold text-gold" />
                        Passenger Rating & Feedback
                      </p>
                      {selectedRide.rating ? (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20">
                          <RatingStars rating={selectedRide.rating} size="sm" />
                          <span className="text-gold font-extrabold text-sm">{selectedRide.rating}.0 / 5.0</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No rating submitted</span>
                      )}
                    </div>

                    {selectedRide.review ? (
                      <div className="p-3.5 rounded-xl bg-background/50 border border-border/60">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-gold" />
                          Student Note:
                        </p>
                        <p className="text-foreground text-sm leading-relaxed italic">
                          "{selectedRide.review}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {selectedRide.rating ? 'Student gave a star rating with no written note.' : 'No passenger review left for this trip.'}
                      </p>
                    )}
                  </div>

                  {/* Financials Breakdown */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <p className="text-muted-foreground text-xs uppercase font-bold">Total Fare</p>
                      <p className="font-extrabold text-gold text-xl mt-1">ZMW {selectedRide.fare?.toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <p className="text-muted-foreground text-xs uppercase font-bold">Driver Earnings</p>
                      <p className="font-extrabold text-emerald-400 text-xl mt-1">ZMW {selectedRide.driver_earning?.toFixed(2) || (selectedRide.fare * 0.85).toFixed(2)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <p className="text-muted-foreground text-xs uppercase font-bold">Platform Commission</p>
                      <p className="font-extrabold text-foreground text-xl mt-1">ZMW {selectedRide.commission?.toFixed(2) || (selectedRide.fare * 0.15).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Metadata & Timestamp Audit */}
                  <div className="p-5 rounded-2xl bg-muted/20 border border-border text-xs space-y-2 font-mono text-muted-foreground">
                    <p>Ride ID: <span className="text-foreground">{selectedRide.id}</span></p>
                    <p>Ride Mode: <span className="text-foreground capitalize">{selectedRide.ride_mode || 'private'} ({selectedRide.passenger_count || 1} passenger)</span></p>
                    <p>Distance: <span className="text-foreground">{selectedRide.distance_km?.toFixed(2) || 'N/A'} km</span> • Duration: <span className="text-foreground">{selectedRide.duration_min ? `${selectedRide.duration_min} mins` : 'N/A'}</span></p>
                    <p>Requested: <span className="text-foreground">{selectedRide.created_at || 'N/A'}</span></p>
                    {selectedRide.completed_at && <p>Completed: <span className="text-foreground">{selectedRide.completed_at}</span></p>}
                  </div>
                </div>
              </div>

              {/* Bottom Sticky Action Footer */}
              <div className="px-6 py-4 md:px-8 md:py-4 border-t border-border bg-card/95 backdrop-blur flex items-center justify-end shrink-0">
                <button
                  onClick={() => setSelectedRide(null)}
                  className="px-6 py-2.5 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminRidesPage;
