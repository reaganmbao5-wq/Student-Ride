import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Check, X, Star, AlertCircle, Wallet, Plus, Loader2, 
  FileText, Eye, Calendar, RefreshCw, Car as CarIcon, Ban, CheckCircle, Shield 
} from 'lucide-react';
import { Car } from '@phosphor-icons/react';
import { GlassCard, GlassInput, GoldButton, EmptyState } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminDriversSkeleton } from '../components/common/PageSkeletons';
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

const AdminDriversPage = () => {
  const { api, token } = useAuth();
  const [drivers, setDrivers] = useState(() => AppCache.get('admin_drivers') || []);
  const [loading, setLoading] = useState(() => !AppCache.get('admin_drivers'));
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, approved, suspended
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'rating' | 'trips'

  // Selected Driver Drawer / Detail Modal
  const [inspectedDriver, setInspectedDriver] = useState(null);

  // Settlement & Top-Up Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('Commission Remittance Settlement');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  useEffect(() => {
    fetchDrivers(Boolean(AppCache.get('admin_drivers')));
  }, []);

  const fetchDrivers = async (isBackground = false) => {
    try {
      if (!isBackground && drivers.length === 0) setLoading(true);
      const response = await api.get('/admin/drivers');
      setDrivers(response.data);
      AppCache.set('admin_drivers', response.data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast.error('Failed to load drivers');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleApproveDriver = async (driverId) => {
    // Optimistic UI update
    const updated = drivers.map(d => d.id === driverId ? { ...d, is_approved: true } : d);
    setDrivers(updated);
    AppCache.set('admin_drivers', updated);
    if (inspectedDriver?.id === driverId) setInspectedDriver(prev => ({ ...prev, is_approved: true }));

    try {
      await api.post(`/admin/drivers/${driverId}/approve`);
      toast.success('Driver approved successfully');
    } catch (error) {
      fetchDrivers(true);
      toast.error('Failed to approve driver');
    }
  };

  const handleSuspendDriver = async (driverId) => {
    // Optimistic UI update
    const updated = drivers.map(d => d.id === driverId ? { ...d, is_approved: false, is_online: false } : d);
    setDrivers(updated);
    AppCache.set('admin_drivers', updated);
    if (inspectedDriver?.id === driverId) setInspectedDriver(prev => ({ ...prev, is_approved: false, is_online: false }));

    try {
      await api.post(`/admin/drivers/${driverId}/suspend`);
      toast.info('Driver suspended');
    } catch (error) {
      fetchDrivers(true);
      toast.error('Failed to suspend driver');
    }
  };

  const handleSettleCommission = async (e) => {
    e.preventDefault();
    if (!inspectedDriver) return;

    setIsSubmittingSettle(true);
    try {
      const response = await api.post(`/admin/drivers/${inspectedDriver.id}/settle-commission`, {
        amount: parseFloat(settleAmount),
        notes: settleNotes
      });

      toast.success(`Successfully settled K${parseFloat(settleAmount).toFixed(2)} commission debt`);
      const updated = drivers.map(d => {
        if (d.id === inspectedDriver.id) {
          return {
            ...d,
            total_commission_due: response.data.remaining_due,
            wallet_status: response.data.wallet_status
          };
        }
        return d;
      });
      setDrivers(updated);
      AppCache.set('admin_drivers', updated);

      setSettleModalOpen(false);
      setSettleAmount('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to settle commission');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    drivers.forEach(d => {
      if (d.created_at) {
        const y = new Date(d.created_at).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [drivers]);

  // Filtered & Sorted Drivers
  const processedDrivers = useMemo(() => {
    let result = drivers.filter(driver => {
      const matchesSearch =
        (driver.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (driver.plate_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (driver.vehicle_model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (driver.user?.phone || '').includes(searchQuery);

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'pending' && driver.is_approved) return false;
      if (statusFilter === 'approved' && !driver.is_approved) return false;
      if (statusFilter === 'online' && !driver.is_online) return false;

      // Date Filters
      if (driver.created_at) {
        const dateObj = new Date(driver.created_at);
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
      if (sortOrder === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortOrder === 'trips') return (b.total_trips || 0) - (a.total_trips || 0);
      return 0;
    });

    return result;
  }, [drivers, searchQuery, statusFilter, selectedMonth, selectedYear, sortOrder]);

  if (loading && drivers.length === 0) {
    return <AdminDriversSkeleton />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-drivers-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Driver Management
            </h1>
            <p className="text-muted-foreground text-sm">
              Review verification requests, inspect vehicle specs, approve and manage fleet drivers
            </p>
          </div>

          <button
            onClick={() => fetchDrivers(false)}
            className="p-2.5 rounded-2xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer self-start sm:self-auto"
            title="Refresh Drivers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-card/60 p-4 rounded-3xl border border-border">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search driver, plate, or car model..."
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
              <option value="all">All Drivers</option>
              <option value="approved">Approved Active</option>
              <option value="pending">Pending Review</option>
              <option value="online">Currently Online</option>
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
              <option value="newest">Joined: Newest</option>
              <option value="oldest">Joined: Oldest</option>
              <option value="rating">Top Rated</option>
              <option value="trips">Most Trips</option>
            </select>
          </div>
        </div>

        {/* Counter Bar */}
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground font-medium">
          <span>Showing <strong className="text-foreground">{processedDrivers.length}</strong> of {drivers.length} drivers</span>
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

        {/* Desktop-Optimized Drivers List */}
        {processedDrivers.length > 0 ? (
          <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border shadow-sm">
            {/* Desktop Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4">Driver Profile</div>
              <div className="col-span-3">Vehicle Details</div>
              <div className="col-span-2">Stats & Earnings</div>
              <div className="col-span-3 text-right">Approval & Actions</div>
            </div>

            {/* Driver Rows */}
            {processedDrivers.map((driver) => {
              const joinedDate = driver.created_at ? new Date(driver.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

              return (
                <div 
                  key={driver.id} 
                  className="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 lg:items-center hover:bg-muted/30 transition-colors"
                >
                  {/* Col 1: Driver Profile */}
                  <div className="lg:col-span-4 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-muted border border-gold/30 overflow-hidden flex items-center justify-center shrink-0">
                      {driver.user?.avatar_url || driver.avatar_url ? (
                        <img src={driver.user?.avatar_url || driver.avatar_url} alt="Driver" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-heading font-bold text-base text-gold">
                          {(driver.user?.name || 'D').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground text-sm truncate">{driver.user?.name || 'Driver'}</p>
                        {driver.is_online && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Online now" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{driver.user?.email || 'No email'}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{driver.user?.phone || 'No phone'}</p>
                    </div>
                  </div>

                  {/* Col 2: Vehicle Specs */}
                  <div className="lg:col-span-3 text-xs">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                      <CarIcon className="w-3.5 h-3.5 text-gold" />
                      {driver.vehicle_color} {driver.vehicle_model}
                    </p>
                    <p className="text-[11px] text-gold font-mono font-bold mt-0.5">Plate: {driver.plate_number}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{driver.vehicle_type || 'Car'}</p>
                  </div>

                  {/* Col 3: Stats */}
                  <div className="lg:col-span-2 text-xs space-y-0.5">
                    <p className="font-bold text-foreground">⭐ {driver.rating?.toFixed(1) || '5.0'} ({driver.total_trips || 0} trips)</p>
                    <p className="text-[11px] text-emerald-500 font-semibold">ZMW {driver.total_earnings?.toFixed(2) || '0.00'}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {joinedDate}
                    </p>
                  </div>

                  {/* Col 4: Approval & Action Controls */}
                  <div className="lg:col-span-3 flex items-center justify-end gap-2">
                    {driver.is_approved ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Approved
                        </span>
                        <button
                          onClick={() => handleSuspendDriver(driver.id)}
                          className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
                          title="Suspend Driver"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          Pending
                        </span>
                        <button
                          onClick={() => handleApproveDriver(driver.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold shadow-md hover:bg-emerald-400 transition-colors cursor-pointer flex items-center gap-1"
                          title="Approve Driver"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => setInspectedDriver(driver)}
                      className="px-3 py-1.5 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Car}
            title="No matching drivers found"
            description="Try adjusting your search criteria or filter status"
          />
        )}

        {/* Detailed Driver Inspection Modal */}
        <Dialog open={!!inspectedDriver} onOpenChange={(open) => !open && setInspectedDriver(null)}>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl font-bold flex items-center justify-between">
                <span>Driver Details</span>
                {inspectedDriver && (
                  <span className={`text-xs px-2.5 py-1 rounded-full border capitalize font-semibold ${
                    inspectedDriver.is_approved ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                  }`}>
                    {inspectedDriver.is_approved ? 'Approved Active' : 'Pending Review'}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            {inspectedDriver && (
              <div className="space-y-5 pt-3 text-sm">
                {/* Identity */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-muted border border-gold/30 overflow-hidden flex items-center justify-center shrink-0">
                    {inspectedDriver.user?.avatar_url || inspectedDriver.avatar_url ? (
                      <img src={inspectedDriver.user?.avatar_url || inspectedDriver.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-heading font-bold text-xl text-gold">
                        {(inspectedDriver.user?.name || 'D').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{inspectedDriver.user?.name}</h3>
                    <p className="text-xs text-muted-foreground">{inspectedDriver.user?.email}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{inspectedDriver.user?.phone || 'No phone'}</p>
                  </div>
                </div>

                {/* Vehicle Specs Grid */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Vehicle Specifications</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <p className="text-muted-foreground text-[10px]">Model & Color</p>
                      <p className="font-bold text-foreground mt-0.5">{inspectedDriver.vehicle_color} {inspectedDriver.vehicle_model}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <p className="text-muted-foreground text-[10px]">Plate Number</p>
                      <p className="font-bold text-gold font-mono mt-0.5">{inspectedDriver.plate_number}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <p className="text-muted-foreground text-[10px]">Vehicle Type</p>
                      <p className="font-bold text-foreground capitalize mt-0.5">{inspectedDriver.vehicle_type || 'Car'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <p className="text-muted-foreground text-[10px]">License Number</p>
                      <p className="font-bold text-foreground font-mono mt-0.5">{inspectedDriver.license_number || 'N/A'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <p className="text-muted-foreground text-[10px]">Total Trips</p>
                      <p className="font-bold text-foreground mt-0.5">{inspectedDriver.total_trips || 0} completed</p>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <p className="text-muted-foreground text-[10px]">Total Earnings</p>
                      <p className="font-bold text-emerald-400 mt-0.5">ZMW {inspectedDriver.total_earnings?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                </div>

                {/* Approval & Action Buttons */}
                <div className="pt-2 flex items-center justify-between border-t border-border">
                  {inspectedDriver.is_approved ? (
                    <button
                      onClick={() => handleSuspendDriver(inspectedDriver.id)}
                      className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Suspend Driver
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApproveDriver(inspectedDriver.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold hover:bg-emerald-400 transition-colors shadow-md cursor-pointer"
                    >
                      Approve Driver
                    </button>
                  )}

                  <button
                    onClick={() => setInspectedDriver(null)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80 transition-colors ml-auto cursor-pointer"
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

export default AdminDriversPage;
