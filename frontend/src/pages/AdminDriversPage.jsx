import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Check, X, Star, AlertCircle, Wallet, Plus, Loader2, 
  FileText, Eye, Calendar, RefreshCw, Ban, CheckCircle, Shield, Edit3, DollarSign,
  Mail, Phone, ExternalLink, ZoomIn
} from 'lucide-react';
import { SteeringWheel, Car } from '@phosphor-icons/react';
import { GlassCard, GlassInput, GoldButton, EmptyState } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminDriversSkeleton } from '../components/common/PageSkeletons';
import { AppCache } from '../utils/AppCache';
import { resolveMediaUrl } from '../utils/urlHelpers';
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

const DriverAvatar = ({ src, name, size = "w-11 h-11", textSize = "text-base" }) => {
  const [imgError, setImgError] = useState(!src);

  useEffect(() => {
    setImgError(!src);
  }, [src]);

  return (
    <div className={`${size} rounded-2xl bg-muted border border-gold/30 overflow-hidden flex items-center justify-center shrink-0`}>
      {!imgError && src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={`font-heading font-bold ${textSize} text-gold`}>
          {(name || 'D').charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
};

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

  // Selected Driver Details / Modal
  const [inspectedDriver, setInspectedDriver] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // { title: string, url: string }

  // Settlement / Clear Wallet Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleTargetDriver, setSettleTargetDriver] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('Commission Remittance Settlement');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Edit Driver Specs Modal State
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  const [editDriverForm, setEditDriverForm] = useState({
    name: '',
    email: '',
    phone: '',
    vehicle_model: '',
    vehicle_color: '',
    plate_number: '',
    vehicle_type: 'Car',
    license_number: ''
  });
  const [savingDriverEdit, setSavingDriverEdit] = useState(false);

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

  // Open Settle Commission / Clear Wallet Modal
  const handleOpenSettleModal = (driver) => {
    setSettleTargetDriver(driver);
    setSettleAmount(driver.total_commission_due ? driver.total_commission_due.toFixed(2) : '0.00');
    setSettleNotes('Commission Remittance Clearance');
    setSettleModalOpen(true);
  };

  // Settle Commission Submission
  const handleSettleCommission = async (e) => {
    e.preventDefault();
    if (!settleTargetDriver) return;

    setIsSubmittingSettle(true);
    try {
      const response = await api.post(`/admin/drivers/${settleTargetDriver.id}/settle-commission`, {
        amount: parseFloat(settleAmount),
        notes: settleNotes
      });

      toast.success(`Successfully cleared K${parseFloat(settleAmount).toFixed(2)} commission debt`);
      const updated = drivers.map(d => {
        if (d.id === settleTargetDriver.id) {
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

      if (inspectedDriver?.id === settleTargetDriver.id) {
        setInspectedDriver(prev => ({
          ...prev,
          total_commission_due: response.data.remaining_due,
          wallet_status: response.data.wallet_status
        }));
      }

      setSettleModalOpen(false);
      setSettleAmount('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to settle commission');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // Open Edit Driver Specs Modal
  const handleStartEditDriver = (driver) => {
    setEditDriverForm({
      name: driver.user?.name || '',
      email: driver.user?.email || '',
      phone: driver.user?.phone || '',
      vehicle_model: driver.vehicle_model || '',
      vehicle_color: driver.vehicle_color || '',
      plate_number: driver.plate_number || '',
      vehicle_type: driver.vehicle_type || 'Car',
      license_number: driver.license_number || ''
    });
    setIsEditingDriver(true);
  };

  // Save Driver Edits
  const handleSaveDriverEdits = async (e) => {
    e.preventDefault();
    if (!inspectedDriver) return;

    setSavingDriverEdit(true);
    try {
      // 1. Update user profile if user_id present
      if (inspectedDriver.user_id) {
        await api.patch(`/admin/users/${inspectedDriver.user_id}`, {
          name: editDriverForm.name,
          email: editDriverForm.email,
          phone: editDriverForm.phone
        });
      }

      // 2. Update driver specs
      const driverPayload = {
        vehicle_model: editDriverForm.vehicle_model,
        vehicle_color: editDriverForm.vehicle_color,
        plate_number: editDriverForm.plate_number,
        vehicle_type: editDriverForm.vehicle_type,
        license_number: editDriverForm.license_number
      };
      const res = await api.patch(`/admin/drivers/${inspectedDriver.id}`, driverPayload);

      const updated = drivers.map(d => d.id === inspectedDriver.id ? { ...d, ...res.data, user: { ...d.user, name: editDriverForm.name, email: editDriverForm.email, phone: editDriverForm.phone } } : d);
      setDrivers(updated);
      AppCache.set('admin_drivers', updated);
      setInspectedDriver(prev => ({ ...prev, ...res.data, user: { ...prev.user, name: editDriverForm.name, email: editDriverForm.email, phone: editDriverForm.phone } }));

      setIsEditingDriver(false);
      toast.success('Driver information updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update driver details');
    } finally {
      setSavingDriverEdit(false);
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
              Review verification requests, inspect vehicle specs, approve, settle wallets & manage fleet drivers
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
              <div className="col-span-3 text-right">Approval, Wallet & Actions</div>
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
                    <DriverAvatar 
                      src={resolveMediaUrl(driver.user?.avatar_url || driver.avatar_url)} 
                      name={driver.user?.name} 
                      size="w-11 h-11" 
                      textSize="text-base" 
                    />
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

                  {/* Col 2: Vehicle Specs (Updated duotone Phosphor SteeringWheel) */}
                  <div className="lg:col-span-3 text-xs">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                      <SteeringWheel weight="duotone" className="w-4 h-4 text-gold shrink-0" />
                      {driver.vehicle_color} {driver.vehicle_model}
                    </p>
                    <p className="text-[11px] text-gold font-mono font-bold mt-0.5">Plate: {driver.plate_number}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{driver.vehicle_type || 'Car'}</p>
                  </div>

                  {/* Col 3: Stats */}
                  <div className="lg:col-span-2 text-xs space-y-0.5">
                    <p className="font-bold text-foreground">⭐ {driver.rating?.toFixed(1) || '5.0'} ({driver.total_trips || 0} rides)</p>
                    <p className="text-[11px] text-emerald-400 font-semibold">ZMW {driver.total_earnings?.toFixed(2) || '0.00'}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {joinedDate}
                    </p>
                  </div>

                  {/* Col 4: Approval & Action Controls */}
                  <div className="lg:col-span-3 flex items-center justify-end gap-2">
                    {/* Clear Wallet / Settle Button */}
                    <button
                      onClick={() => handleOpenSettleModal(driver)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Clear / Settle Driver Wallet Commission"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Clear Wallet</span>
                    </button>

                    {driver.is_approved ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-emerald-400">Approved</span>
                        <button
                          onClick={() => handleSuspendDriver(driver.id)}
                          className="p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
                          title="Suspend Driver"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-yellow-400">Pending</span>
                        <button
                          onClick={() => handleApproveDriver(driver.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold shadow-md hover:bg-emerald-400 transition-colors cursor-pointer flex items-center gap-1"
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
            icon={SteeringWheel}
            title="No matching drivers found"
            description="Try adjusting your search criteria or filter status"
          />
        )}

        {/* FULL SCREEN / MAXIMUM VIEWPORT MODAL FOR DRIVER INSPECTION */}
        {inspectedDriver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200">
            <div className="bg-card text-foreground border border-border w-full h-full max-w-6xl max-h-[96vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
              {/* Sticky Top Navigation Header */}
              <div className="px-6 py-4 md:px-8 md:py-5 border-b border-border flex items-center justify-between bg-card/95 backdrop-blur shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold font-heading text-lg">
                    {(inspectedDriver.user?.name || 'D').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-extrabold text-foreground flex items-center gap-2">
                      <span>{inspectedDriver.user?.name || 'Driver'}</span>
                      <span className="text-xs font-bold text-muted-foreground capitalize">
                        • {inspectedDriver.is_approved ? 'Approved Active' : 'Pending Review'}
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">{inspectedDriver.user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleStartEditDriver(inspectedDriver)}
                    className="px-4 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Specs</span>
                  </button>

                  <button
                    onClick={() => setInspectedDriver(null)}
                    className="p-2 rounded-2xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                    title="Close Window"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Body Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8 space-y-6 min-w-0">
                <div className="space-y-6 w-full max-w-full">
                  {/* Identity Banner */}
                  <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <DriverAvatar 
                        src={resolveMediaUrl(inspectedDriver.user?.avatar_url || inspectedDriver.avatar_url)} 
                        name={inspectedDriver.user?.name} 
                        size="w-16 h-16" 
                        textSize="text-2xl" 
                      />
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-foreground truncate">{inspectedDriver.user?.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                          <Mail className="w-3.5 h-3.5 shrink-0" /> {inspectedDriver.user?.email}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 font-mono">
                          <Phone className="w-3.5 h-3.5 shrink-0" /> {inspectedDriver.user?.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 border-border pt-3 sm:pt-0 shrink-0">
                      <p className="text-xs text-muted-foreground">Total Lifetime Trips</p>
                      <p className="text-2xl md:text-3xl font-extrabold text-foreground">{inspectedDriver.total_trips || 0}</p>
                    </div>
                  </div>

                  {/* Vehicle Specs Grid */}
                  <div className="p-6 rounded-2xl bg-muted/40 border border-border space-y-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <SteeringWheel weight="duotone" className="w-4 h-4 text-gold" />
                      Vehicle Specifications
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-card border border-border">
                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Model & Color</p>
                        <p className="font-bold text-foreground text-sm truncate mt-1">{inspectedDriver.vehicle_color} {inspectedDriver.vehicle_model}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-card border border-border">
                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Plate Number</p>
                        <p className="font-bold text-gold font-mono text-sm truncate mt-1">{inspectedDriver.plate_number}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-card border border-border">
                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Vehicle Type</p>
                        <p className="font-bold text-foreground capitalize text-sm mt-1">{inspectedDriver.vehicle_type || 'Car'}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-card border border-border">
                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Total Earnings</p>
                        <p className="font-bold text-emerald-400 text-sm mt-1">ZMW {inspectedDriver.total_earnings?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Driver Verification Documents & KYC Section */}
                  <div className="p-6 rounded-2xl bg-muted/40 border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-gold" />
                        Verification Documents & KYC Records
                      </p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        inspectedDriver.verification_docs?.license || inspectedDriver.verification_docs?.registration
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {inspectedDriver.verification_docs?.license || inspectedDriver.verification_docs?.registration
                          ? 'Documents Submitted'
                          : 'No Documents Uploaded'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Driver's License Document Card */}
                      <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-xs">Driver's License</p>
                              <p className="text-[10px] text-muted-foreground">Official Government Permit</p>
                            </div>
                          </div>
                          {inspectedDriver.verification_docs?.license ? (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                              Uploaded
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                              Missing
                            </span>
                          )}
                        </div>

                        {inspectedDriver.verification_docs?.license ? (
                          <div className="space-y-2">
                            <div
                              onClick={() => setPreviewDoc({
                                title: `${inspectedDriver.user?.name || 'Driver'} — Driver's License`,
                                url: resolveMediaUrl(inspectedDriver.verification_docs.license)
                              })}
                              className="relative group rounded-xl overflow-hidden border border-white/10 max-w-full bg-black cursor-pointer shadow-lg aspect-video flex items-center justify-center"
                            >
                              <img
                                src={resolveMediaUrl(inspectedDriver.verification_docs.license)}
                                alt="Driver's License"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-semibold text-xs">
                                <ZoomIn className="w-5 h-5 text-gold" />
                                <span>Click to Expand</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({
                                  title: `${inspectedDriver.user?.name || 'Driver'} — Driver's License`,
                                  url: resolveMediaUrl(inspectedDriver.verification_docs.license)
                                })}
                                className="flex-1 py-2 px-3 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                                Inspect License
                              </button>
                              <a
                                href={resolveMediaUrl(inspectedDriver.verification_docs.license)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors flex items-center justify-center"
                                title="Open Original File"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-500 italic py-3 text-center">No driver license uploaded yet.</p>
                        )}
                      </div>

                      {/* Vehicle Registration Document Card */}
                      <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold shrink-0">
                              <Car weight="duotone" className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-xs">Vehicle Registration</p>
                              <p className="text-[10px] text-muted-foreground">White Book & Ownership</p>
                            </div>
                          </div>
                          {inspectedDriver.verification_docs?.registration ? (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                              Uploaded
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                              Missing
                            </span>
                          )}
                        </div>

                        {inspectedDriver.verification_docs?.registration ? (
                          <div className="space-y-2">
                            <div
                              onClick={() => setPreviewDoc({
                                title: `${inspectedDriver.user?.name || 'Driver'} — Vehicle Registration`,
                                url: resolveMediaUrl(inspectedDriver.verification_docs.registration)
                              })}
                              className="relative group rounded-xl overflow-hidden border border-white/10 max-w-full bg-black cursor-pointer shadow-lg aspect-video flex items-center justify-center"
                            >
                              <img
                                src={resolveMediaUrl(inspectedDriver.verification_docs.registration)}
                                alt="Vehicle Registration"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-semibold text-xs">
                                <ZoomIn className="w-5 h-5 text-gold" />
                                <span>Click to Expand</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({
                                  title: `${inspectedDriver.user?.name || 'Driver'} — Vehicle Registration`,
                                  url: resolveMediaUrl(inspectedDriver.verification_docs.registration)
                                })}
                                className="flex-1 py-2 px-3 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                                Inspect Registration
                              </button>
                              <a
                                href={resolveMediaUrl(inspectedDriver.verification_docs.registration)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors flex items-center justify-center"
                                title="Open Original File"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-500 italic py-3 text-center">No vehicle registration uploaded yet.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Settle Commission Action Card */}
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Driver Wallet Clearance</p>
                      <p className="text-xs text-foreground mt-0.5">
                        Commission Remittance Due: <strong className="text-gold font-mono">ZMW {inspectedDriver.total_commission_due?.toFixed(2) || '0.00'}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenSettleModal(inspectedDriver)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs shadow-md hover:bg-emerald-400 transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      Clear Driver Wallet
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Sticky Action Footer */}
              <div className="px-6 py-4 md:px-8 md:py-4 border-t border-border bg-card/95 backdrop-blur flex items-center justify-between shrink-0">
                {inspectedDriver.is_approved ? (
                  <button
                    onClick={() => handleSuspendDriver(inspectedDriver.id)}
                    className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Suspend Driver
                  </button>
                ) : (
                  <button
                    onClick={() => handleApproveDriver(inspectedDriver.id)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold hover:bg-emerald-400 transition-colors shadow-md cursor-pointer"
                  >
                    Approve Driver
                  </button>
                )}

                <button
                  onClick={() => setInspectedDriver(null)}
                  className="px-6 py-2.5 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80 transition-colors ml-auto cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Document Lightbox Modal (Bug Report style) */}
        {previewDoc && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setPreviewDoc(null)} />
            
            <div className="relative z-10 max-w-5xl w-full flex flex-col items-center gap-3">
              {/* Top Bar */}
              <div className="w-full flex items-center justify-between text-white bg-zinc-900/90 p-4 rounded-2xl border border-white/10 shadow-xl">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <ZoomIn className="w-4 h-4 text-gold" />
                  {previewDoc.title || 'Verification Document Preview'}
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gold hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Original
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* High Res Image Container */}
              <div className="w-full max-h-[80vh] flex items-center justify-center overflow-auto rounded-2xl border border-white/10 bg-black p-2 shadow-2xl">
                <img
                  src={previewDoc.url}
                  alt={previewDoc.title || 'Expanded Document'}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl"
                  onError={(e) => {
                    e.currentTarget.alt = "Unable to load document image";
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Clear Wallet / Settle Commission Dialog */}
        <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-md p-6 rounded-3xl">
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <span>Clear Driver Commission Wallet</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSettleCommission} className="space-y-4 pt-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-2">
                  Clearing commission remittance debt for driver <strong className="text-foreground">{settleTargetDriver?.user?.name}</strong>.
                </p>
                <label className="block text-muted-foreground font-bold mb-1">Settlement Amount (ZMW)</label>
                <GlassInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-bold mb-1">Settlement Notes / Reference</label>
                <GlassInput
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <GoldButton type="submit" disabled={isSubmittingSettle}>
                  {isSubmittingSettle ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Clearance'}
                </GoldButton>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Driver Specifications Modal */}
        <Dialog open={isEditingDriver} onOpenChange={setIsEditingDriver}>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl">
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="text-xl font-bold flex items-center justify-between">
                <span>Edit Driver Specifications</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveDriverEdits} className="space-y-4 pt-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-bold mb-1">Driver Full Name</label>
                <GlassInput
                  type="text"
                  value={editDriverForm.name}
                  onChange={(e) => setEditDriverForm({ ...editDriverForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-bold mb-1">Email</label>
                  <GlassInput
                    type="email"
                    value={editDriverForm.email}
                    onChange={(e) => setEditDriverForm({ ...editDriverForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-bold mb-1">Phone</label>
                  <GlassInput
                    type="tel"
                    value={editDriverForm.phone}
                    onChange={(e) => setEditDriverForm({ ...editDriverForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Vehicle Model</label>
                  <GlassInput
                    type="text"
                    placeholder="e.g. Toyota Vitz"
                    value={editDriverForm.vehicle_model}
                    onChange={(e) => setEditDriverForm({ ...editDriverForm, vehicle_model: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Vehicle Color</label>
                  <GlassInput
                    type="text"
                    placeholder="e.g. Silver"
                    value={editDriverForm.vehicle_color}
                    onChange={(e) => setEditDriverForm({ ...editDriverForm, vehicle_color: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Plate Number</label>
                  <GlassInput
                    type="text"
                    placeholder="e.g. ABC 1234"
                    value={editDriverForm.plate_number}
                    onChange={(e) => setEditDriverForm({ ...editDriverForm, plate_number: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">License Number</label>
                  <GlassInput
                    type="text"
                    placeholder="e.g. LIC-9988"
                    value={editDriverForm.license_number}
                    onChange={(e) => setEditDriverForm({ ...editDriverForm, license_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditingDriver(false)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <GoldButton type="submit" disabled={savingDriverEdit}>
                  {savingDriverEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Driver Specs'}
                </GoldButton>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminDriversPage;
