import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, Shield, Ban, Check, UserPlus, Trash2, Loader2, 
  Calendar, Filter, ArrowUpDown, ArrowUp, ArrowDown, Eye, 
  MapPin, Clock, Phone, Mail, CheckCircle, AlertCircle, RefreshCw, X, 
  ShieldAlert, Edit3, ChevronDown, ChevronUp, Key, DollarSign, GraduationCap, Archive
} from 'lucide-react';
import { SteeringWheel, Car, User, Sparkle } from '@phosphor-icons/react';
import { GlassCard, GlassInput, GoldButton, EmptyState, StatusBadge } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminUsersSkeleton } from '../components/common/PageSkeletons';
import { AppCache } from '../utils/AppCache';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const UserAvatar = ({ src, name, role, size = "w-11 h-11", textSize = "text-base" }) => {
  const [imgError, setImgError] = useState(!src);

  useEffect(() => {
    setImgError(!src);
  }, [src]);

  return (
    <div className={`${size} rounded-2xl bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0`}>
      {!imgError && src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : role === 'super_admin' ? (
        <Shield className="w-5 h-5 text-gold" />
      ) : (
        <span className={`text-foreground font-heading font-bold ${textSize}`}>
          {(name || 'U').charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
};

const AdminUsersPage = () => {
  const { api, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState(() => AppCache.get('admin_users') || []);
  const [loading, setLoading] = useState(() => !AppCache.get('admin_users'));
  
  // Search & Filter Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [yearOfStudyFilter, setYearOfStudyFilter] = useState('all');
  const [archivedFilter, setArchivedFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'name'
  const [archivingGraduated, setArchivingGraduated] = useState(false);

  // Admin Management Modals
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'admin'
  });
  
  // User Inspection & Management Drawer State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  // Edit User / Driver Modal State
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    vehicle_model: '',
    vehicle_color: '',
    plate_number: '',
    vehicle_type: 'Car',
    license_number: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Expandable Ride Cards in User Details Drawer
  const [expandedRideIds, setExpandedRideIds] = useState({});

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  useEffect(() => {
    fetchUsers(Boolean(AppCache.get('admin_users')));
  }, []);

  const fetchUsers = async (isBackground = false) => {
    try {
      if (!isBackground && users.length === 0) setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
      AppCache.set('admin_users', response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Open User Details Drawer & Fetch Deep History
  const handleOpenUserDetails = async (user) => {
    setSelectedUser(user);
    setUserDetails(null);
    setLoadingDetails(true);
    setExpandedRideIds({});
    try {
      const res = await api.get(`/admin/users/${user.id}/details`);
      setUserDetails(res.data);
    } catch (err) {
      console.warn('Failed to load deep user details, using baseline user object:', err);
      setUserDetails({ user, driver_profile: null, active_ride: null, recent_rides: [], total_rides: 0 });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Edit Form pre-filled
  const handleStartEdit = () => {
    if (!userDetails?.user) return;
    const u = userDetails.user;
    const d = userDetails.driver_profile;
    setEditFormData({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      password: '',
      vehicle_model: d?.vehicle_model || '',
      vehicle_color: d?.vehicle_color || '',
      plate_number: d?.plate_number || '',
      vehicle_type: d?.vehicle_type || 'Car',
      license_number: d?.license_number || ''
    });
    setIsEditingUser(true);
  };

  // Save User / Driver Edits
  const handleSaveUserEdits = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSavingEdit(true);
    try {
      // 1. Update user profile
      const userPayload = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
      };
      if (editFormData.password && editFormData.password.trim()) {
        userPayload.password = editFormData.password.trim();
      }
      const userRes = await api.patch(`/admin/users/${selectedUser.id}`, userPayload);

      // 2. If driver, update vehicle specs
      let updatedDriverProfile = userDetails?.driver_profile;
      if (selectedUser.role === 'driver') {
        const driverPayload = {
          vehicle_model: editFormData.vehicle_model,
          vehicle_color: editFormData.vehicle_color,
          plate_number: editFormData.plate_number,
          vehicle_type: editFormData.vehicle_type,
          license_number: editFormData.license_number
        };
        const driverRes = await api.patch(`/admin/drivers/${selectedUser.id}`, driverPayload);
        updatedDriverProfile = driverRes.data;
      }

      // Update local state
      const nextUsers = users.map(u => u.id === selectedUser.id ? { ...u, ...userRes.data } : u);
      setUsers(nextUsers);
      AppCache.set('admin_users', nextUsers);
      setSelectedUser(userRes.data);
      setUserDetails(prev => ({
        ...prev,
        user: userRes.data,
        driver_profile: updatedDriverProfile
      }));

      setIsEditingUser(false);
      toast.success('User details updated successfully');
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error(err.response?.data?.detail || 'Failed to update user details');
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Single Ride Card Expansion
  const toggleRideExpand = (rideId) => {
    setExpandedRideIds(prev => ({
      ...prev,
      [rideId]: !prev[rideId]
    }));
  };

  // Delete Single Ride from History
  const handleDeleteRide = async (rideId) => {
    try {
      await api.delete(`/admin/rides/${rideId}`);
      toast.success('Ride record deleted');
      setUserDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recent_rides: prev.recent_rides.filter(r => r.id !== rideId),
          total_rides: Math.max(0, (prev.total_rides || 1) - 1)
        };
      });
    } catch (err) {
      toast.error('Failed to delete ride record');
    }
  };

  // Switch Role between Student, Lecturer, and Driver
  const handleSwitchRole = async (targetUserId, nextRole) => {
    setSwitchingRole(true);
    try {
      const res = await api.patch(`/admin/users/${targetUserId}/role`, { role: nextRole });
      const updatedUser = res.data;
      
      const nextUsers = users.map(u => u.id === targetUserId ? { ...u, role: nextRole } : u);
      setUsers(nextUsers);
      AppCache.set('admin_users', nextUsers);

      if (selectedUser?.id === targetUserId) {
        setSelectedUser(prev => ({ ...prev, role: nextRole }));
        if (userDetails) {
          setUserDetails(prev => ({ ...prev, user: updatedUser }));
        }
      }

      toast.success(`Role switched to ${nextRole.toUpperCase()} successfully`);
    } catch (error) {
      console.error('Error switching role:', error);
      toast.error(error.response?.data?.detail || 'Failed to switch user role');
    } finally {
      setSwitchingRole(false);
    }
  };

  // Archive Graduated Students Batch Action
  const handleArchiveGraduated = async () => {
    if (!window.confirm("Archive all students who have exceeded their degree completion years (Year 4 for standard, Year 5 for engineering)?")) return;
    setArchivingGraduated(true);
    try {
      const res = await api.post('/admin/students/archive-graduated');
      toast.success(res.data.message || `Archived ${res.data.archived_count} graduated students`);
      fetchUsers(false);
    } catch (err) {
      console.error('Error archiving graduated students:', err);
      toast.error(err.response?.data?.detail || 'Failed to archive graduated students');
    } finally {
      setArchivingGraduated(false);
    }
  };

  // Fast Optimistic Suspend / Activate
  const handleToggleActiveStatus = async (userObj) => {
    const isCurrentlyActive = userObj.is_active !== false;
    const nextStatus = !isCurrentlyActive;

    const updatedUsers = users.map(u => u.id === userObj.id ? { ...u, is_active: nextStatus } : u);
    setUsers(updatedUsers);
    AppCache.set('admin_users', updatedUsers);

    if (selectedUser?.id === userObj.id) {
      setSelectedUser(prev => ({ ...prev, is_active: nextStatus }));
    }

    try {
      if (nextStatus) {
        await api.post(`/admin/users/${userObj.id}/activate`);
        toast.success(`User ${userObj.name} activated`);
      } else {
        await api.post(`/admin/users/${userObj.id}/suspend`);
        toast.info(`User ${userObj.name} suspended`);
      }
    } catch (error) {
      fetchUsers(true);
      toast.error(error.response?.data?.detail || 'Failed to update user status');
    }
  };

  // Fast Delete User
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    const targetId = deleteConfirmation.id;
    const targetName = deleteConfirmation.name;

    const nextUsers = users.filter(u => u.id !== targetId);
    setUsers(nextUsers);
    AppCache.set('admin_users', nextUsers);
    if (selectedUser?.id === targetId) setSelectedUser(null);
    setDeleteConfirmation(null);

    try {
      if (deleteConfirmation.type === 'admin') {
        await api.delete(`/admin/delete-admin/${targetId}`);
        toast.success(`Admin ${targetName} deleted`);
      } else {
        await api.delete(`/admin/users/${targetId}`);
        toast.success(`User ${targetName} deleted`);
      }
    } catch (error) {
      fetchUsers(true);
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setAddingAdmin(true);
    try {
      await api.post('/admin/create-admin', adminForm);
      toast.success(adminForm.role === 'accountant' ? 'Accountant created successfully' : 'Admin created successfully');
      setShowAddAdmin(false);
      setAdminForm({ name: '', email: '', phone: '', password: '', role: 'admin' });
      fetchUsers(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create staff account');
    } finally {
      setAddingAdmin(false);
    }
  };

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    users.forEach(u => {
      if (u.created_at) {
        const y = new Date(u.created_at).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [users]);

  // Filtered & Sorted Users
  const processedUsers = useMemo(() => {
    let result = users.filter(user => {
      const matchesSearch = 
        (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.phone || '').includes(searchQuery);

      if (!matchesSearch) return false;

      // Role Filter
      if (roleFilter !== 'all') {
        if (roleFilter === 'admin') {
          if (user.role !== 'admin' && user.role !== 'super_admin') return false;
        } else if (user.role !== roleFilter) {
          return false;
        }
      }

      // Year of Study Filter (for Students)
      if (yearOfStudyFilter !== 'all') {
        if (user.role !== 'student') return false;
        if (String(user.year_of_study) !== String(yearOfStudyFilter)) return false;
      }

      // Archived Filter
      if (archivedFilter === 'active' && user.is_archived === true) {
        return false;
      }
      if (archivedFilter === 'archived' && user.is_archived !== true) {
        return false;
      }

      // Month Filter
      if (selectedMonth !== 'all') {
        if (!user.created_at) return false;
        const userMonth = new Date(user.created_at).getMonth();
        if (userMonth !== parseInt(selectedMonth)) return false;
      }

      // Year Filter
      if (selectedYear !== 'all') {
        if (!user.created_at) return false;
        const userYear = new Date(user.created_at).getFullYear();
        if (userYear !== parseInt(selectedYear)) return false;
      }

      return true;
    });

    // Sorting
    if (sortOrder === 'newest') {
      result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortOrder === 'oldest') {
      result.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sortOrder === 'name') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return result;
  }, [users, searchQuery, roleFilter, yearOfStudyFilter, archivedFilter, selectedMonth, selectedYear, sortOrder]);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-heading">
              User Management
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage accounts, driver approvals, verification status & platform roles
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <button
                onClick={handleArchiveGraduated}
                disabled={archivingGraduated}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="Archive students whose expected graduation year has passed"
              >
                <Archive className="w-4 h-4 text-amber-500" />
                <span>{archivingGraduated ? 'Archiving...' : 'Archive Graduated'}</span>
              </button>
            )}

            {isSuperAdmin && (
              <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
                <DialogTrigger asChild>
                  <GoldButton data-testid="add-admin-btn">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Staff
                  </GoldButton>
                </DialogTrigger>
                <DialogContent className="bg-card border-border sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-foreground font-heading">Create Staff Account</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddAdmin} className="space-y-4 mt-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Staff Role</label>
                      <select
                        value={adminForm.role}
                        onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                        className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-3 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
                      >
                        <option value="admin">Administrator</option>
                        <option value="accountant">Accountant (Financial Suite)</option>
                      </select>
                    </div>
                    <GlassInput
                      type="text"
                      placeholder="Full Name"
                      value={adminForm.name}
                      onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                      required
                    />
                    <GlassInput
                      type="email"
                      placeholder="Email"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                      required
                    />
                    <GlassInput
                      type="tel"
                      placeholder="Phone"
                      value={adminForm.phone}
                      onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                      required
                    />
                    <GlassInput
                      type="password"
                      placeholder="Password"
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      required
                    />
                    <GoldButton type="submit" className="w-full" disabled={addingAdmin}>
                      {addingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : (adminForm.role === 'accountant' ? 'Create Accountant' : 'Create Admin')}
                    </GoldButton>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 bg-card/60 p-4 rounded-3xl border border-border">
          {/* Search Box */}
          <div className="md:col-span-3 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl pl-10 pr-4 py-2.5 border border-border focus:outline-none focus:border-gold"
            />
          </div>

          {/* Role Filter */}
          <div className="md:col-span-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-3 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="lecturer">Lecturers</option>
              <option value="driver">Drivers</option>
              <option value="accountant">Accountants</option>
              <option value="admin">Admins</option>
            </select>
          </div>

          {/* Year of Study Filter */}
          <div className="md:col-span-2">
            <select
              value={yearOfStudyFilter}
              onChange={(e) => setYearOfStudyFilter(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-3 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="all">All Study Years</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
              <option value="5">5th Year</option>
            </select>
          </div>

          {/* Archived Filter */}
          <div className="md:col-span-2">
            <select
              value={archivedFilter}
              onChange={(e) => setArchivedFilter(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-3 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="active">Active Accounts</option>
              <option value="archived">Archived Only</option>
              <option value="all">All Statuses</option>
            </select>
          </div>

          {/* Month Filter */}
          <div className="md:col-span-1">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-2 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="all">Month</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m.slice(0, 3)}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="md:col-span-1">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-2 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="all">Year</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="md:col-span-1">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl px-2 py-2.5 border border-border focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">A-Z</option>
            </select>
          </div>
        </div>

        {/* Results Counter Bar */}
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground font-medium">
          <span>Showing <strong className="text-foreground">{processedUsers.length}</strong> of {users.length} users</span>
          {(searchQuery || roleFilter !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
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

        {/* Desktop-Optimized Table / List */}
        {processedUsers.length > 0 ? (
          <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border shadow-sm">
            {/* Desktop Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4">User Information</div>
              <div className="col-span-2">Role & Status</div>
              <div className="col-span-2">Joined Date</div>
              <div className="col-span-2">Quick Role Switch</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* User Rows */}
            {processedUsers.map((user) => {
              const joinedDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
              const isStudentOrDriver = user.role === 'student' || user.role === 'driver';

              return (
                <div 
                  key={user.id} 
                  className="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 lg:items-center hover:bg-muted/30 transition-colors"
                >
                  {/* Col 1: User Profile Info */}
                  <div className="lg:col-span-4 flex items-center gap-3.5">
                    <UserAvatar 
                      src={user.avatar_url} 
                      name={user.name} 
                      role={user.role} 
                      size="w-11 h-11" 
                      textSize="text-base" 
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground text-sm truncate">{user.name}</p>
                        {user.is_active === false && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                            Suspended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{user.phone || 'No phone'}</p>
                    </div>
                  </div>

                  {/* Col 2: Role & Active Status */}
                  <div className="lg:col-span-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground capitalize tracking-wide">
                      {user.role.replace('_', ' ')}
                    </span>
                    {user.role === 'student' && user.year_of_study && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                        Yr {user.year_of_study}
                      </span>
                    )}
                    {user.role === 'lecturer' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 flex items-center gap-0.5">
                        <GraduationCap className="w-3 h-3" />
                        Lecturer
                      </span>
                    )}
                    {user.is_archived && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-400 font-bold border border-zinc-500/20">
                        Archived
                      </span>
                    )}
                  </div>

                  {/* Col 3: Joined Date */}
                  <div className="lg:col-span-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                    <span>{joinedDate}</span>
                  </div>

                  {/* Col 4: Quick Role Switch */}
                  <div className="lg:col-span-2">
                    {user.role !== 'admin' && user.role !== 'super_admin' ? (
                      <select
                        value={user.role}
                        disabled={switchingRole}
                        onChange={(e) => handleSwitchRole(user.id, e.target.value)}
                        className="text-xs px-2.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold cursor-pointer focus:outline-none focus:border-gold"
                      >
                        <option value="student">Student</option>
                        <option value="lecturer">Lecturer</option>
                        <option value="driver">Driver</option>
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">Protected</span>
                    )}
                  </div>

                  {/* Col 5: Actions & Inspection */}
                  <div className="lg:col-span-2 flex items-center justify-end gap-2">
                    {/* View Details Drawer Button */}
                    <button
                      onClick={() => handleOpenUserDetails(user)}
                      className="px-3 py-1.5 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Manage User & View Ride History"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Manage</span>
                    </button>

                    {/* Suspend / Activate Button */}
                    {user.role !== 'super_admin' && (
                      <button
                        onClick={() => handleToggleActiveStatus(user)}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          user.is_active !== false
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                        }`}
                        title={user.is_active !== false ? 'Suspend User' : 'Activate User'}
                      >
                        {user.is_active !== false ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                    )}

                    {/* Delete Button */}
                    {user.role !== 'super_admin' && (
                      <button
                        onClick={() => setDeleteConfirmation({ type: user.role === 'admin' ? 'admin' : 'user', id: user.id, name: user.name })}
                        className="p-2 rounded-xl bg-muted hover:bg-red-500/10 text-muted-foreground hover:text-red-400 border border-border hover:border-red-500/20 transition-colors cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No matching users found"
            description="Try changing your search keywords or adjusting the month/role filter"
          />
        )}

        {/* FULL SCREEN / MAXIMUM VIEWPORT MODAL FOR USER MANAGEMENT & TRIP HISTORY */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200">
            <div className="bg-card text-foreground border border-border w-full h-full max-w-7xl max-h-[96vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
              {/* Sticky Top Navigation Header */}
              <div className="px-6 py-4 md:px-8 md:py-5 border-b border-border flex items-center justify-between bg-card/95 backdrop-blur shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold font-heading text-lg">
                    {(selectedUser?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-extrabold text-foreground flex items-center gap-2">
                      <span>{selectedUser?.name}</span>
                      <span className="text-xs font-bold text-muted-foreground capitalize">
                        • {selectedUser?.role.replace('_', ' ')}
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">{selectedUser?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleStartEdit}
                    className="px-4 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>

                  {/* Clean Prominent Top Right Close Button */}
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 rounded-2xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                    title="Close Window"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Body Content (Full Width & Multi-column Grid) */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8 space-y-6 min-w-0">
                {loadingDetails ? (
                  <div className="py-24 flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="w-10 h-10 text-gold animate-spin" />
                    <p className="text-xs text-muted-foreground">Loading complete user profile & ride records...</p>
                  </div>
                ) : userDetails ? (
                  <div className="space-y-6 w-full max-w-full">
                    {/* Top Identity & Summary Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Left: User Identity Card (8 cols) */}
                      <div className="lg:col-span-8 p-5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <UserAvatar 
                            src={userDetails.user?.avatar_url} 
                            name={userDetails.user?.name} 
                            role={userDetails.user?.role} 
                            size="w-16 h-16" 
                            textSize="text-2xl" 
                          />
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold text-foreground truncate">{userDetails.user?.name}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                              <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{userDetails.user?.email}</span>
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 font-mono">
                              <Phone className="w-3.5 h-3.5 shrink-0" /> {userDetails.user?.phone || 'No phone registered'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 border-border pt-3 sm:pt-0 shrink-0">
                          <p className="text-xs text-muted-foreground">Total Lifetime Trips</p>
                          <p className="text-2xl md:text-3xl font-extrabold text-foreground">{userDetails.total_rides || 0}</p>
                        </div>
                      </div>

                      {/* Right: Quick Role Switcher (4 cols) */}
                      {userDetails.user?.role !== 'admin' && userDetails.user?.role !== 'super_admin' && (
                        <div className="lg:col-span-4 p-5 rounded-2xl bg-gold/10 border border-gold/20 flex flex-col justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-gold uppercase tracking-wider">Account Role</p>
                            <p className="text-xs text-foreground mt-0.5">
                              Currently registered as <strong className="capitalize">{userDetails.user.role}</strong>.
                              {userDetails.user.role === 'student' && userDetails.user.year_of_study && (
                                <span> (Year {userDetails.user.year_of_study})</span>
                              )}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              onClick={() => handleSwitchRole(userDetails.user.id, 'student')}
                              disabled={switchingRole || userDetails.user.role === 'student'}
                              className={`px-2 py-2 rounded-xl text-xs font-bold transition-all text-center ${
                                userDetails.user.role === 'student'
                                  ? 'bg-gold text-zinc-950 shadow-sm'
                                  : 'bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer'
                              }`}
                            >
                              Student
                            </button>
                            <button
                              onClick={() => handleSwitchRole(userDetails.user.id, 'lecturer')}
                              disabled={switchingRole || userDetails.user.role === 'lecturer'}
                              className={`px-2 py-2 rounded-xl text-xs font-bold transition-all text-center ${
                                userDetails.user.role === 'lecturer'
                                  ? 'bg-gold text-zinc-950 shadow-sm'
                                  : 'bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer'
                              }`}
                            >
                              Lecturer
                            </button>
                            <button
                              onClick={() => handleSwitchRole(userDetails.user.id, 'driver')}
                              disabled={switchingRole || userDetails.user.role === 'driver'}
                              className={`px-2 py-2 rounded-xl text-xs font-bold transition-all text-center ${
                                userDetails.user.role === 'driver'
                                  ? 'bg-gold text-zinc-950 shadow-sm'
                                  : 'bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer'
                              }`}
                            >
                              Driver
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Driver Fleet Details (If Driver) */}
                    {userDetails.driver_profile && (
                      <div className="p-6 rounded-2xl bg-muted/40 border border-border space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <SteeringWheel weight="duotone" className="w-4 h-4 text-gold" />
                            Driver Fleet Specifications
                          </p>
                          <button
                            onClick={handleStartEdit}
                            className="text-xs text-gold font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit Specs
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div className="p-4 rounded-xl bg-card border border-border">
                            <p className="text-muted-foreground text-[10px] uppercase font-bold">Vehicle Model</p>
                            <p className="font-bold text-foreground text-sm truncate mt-1">
                              {userDetails.driver_profile.vehicle_color} {userDetails.driver_profile.vehicle_model}
                            </p>
                          </div>
                          <div className="p-4 rounded-xl bg-card border border-border">
                            <p className="text-muted-foreground text-[10px] uppercase font-bold">Plate Number</p>
                            <p className="font-bold text-gold font-mono text-sm truncate mt-1">{userDetails.driver_profile.plate_number}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-card border border-border">
                            <p className="text-muted-foreground text-[10px] uppercase font-bold">Driver Rating</p>
                            <p className="font-bold text-foreground text-sm mt-1">⭐ {userDetails.driver_profile.rating?.toFixed(1) || '5.0'}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-card border border-border">
                            <p className="text-muted-foreground text-[10px] uppercase font-bold">Total Earnings</p>
                            <p className="font-bold text-emerald-400 text-sm mt-1">ZMW {userDetails.driver_profile.total_earnings?.toFixed(2) || '0.00'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Active Ongoing Trip (If Any) */}
                    {userDetails.active_ride && (
                      <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Active Ongoing Trip
                          </p>
                          <span className="text-sm font-bold text-gold">ZMW {userDetails.active_ride.fare?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-foreground font-medium pt-1 space-y-1">
                          <p className="break-words">📍 From: {userDetails.active_ride.pickup_location?.name || userDetails.active_ride.pickup_location?.address}</p>
                          <p className="break-words">🏁 To: {userDetails.active_ride.dropoff_location?.name || userDetails.active_ride.dropoff_location?.address}</p>
                          <p className="text-muted-foreground text-[11px] pt-1">Status: <span className="text-foreground capitalize">{userDetails.active_ride.status}</span></p>
                        </div>
                      </div>
                    )}

                    {/* Expandable Recent Ride Logs */}
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Complete Trip History Records ({userDetails.recent_rides?.length || 0})
                        </p>
                        <span className="text-xs text-muted-foreground">Click any card to expand full trip breakdown</span>
                      </div>

                      {userDetails.recent_rides && userDetails.recent_rides.length > 0 ? (
                        <div className="space-y-3 w-full">
                          {userDetails.recent_rides.map((ride) => {
                            const isExpanded = expandedRideIds[ride.id];
                            const dateStr = ride.created_at
                              ? new Date(ride.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'N/A';

                            return (
                              <div 
                                key={ride.id} 
                                className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 w-full"
                              >
                                {/* Summary Header (Click to Expand) */}
                                <div 
                                  onClick={() => toggleRideExpand(ride.id)}
                                  className="p-4 md:p-5 flex items-center justify-between text-xs hover:bg-muted/40 cursor-pointer transition-colors gap-4"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-foreground text-sm break-words whitespace-normal">
                                        {ride.pickup_location?.name || ride.pickup_location?.address || 'Pickup'} → {ride.dropoff_location?.name || ride.dropoff_location?.address || 'Destination'}
                                      </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                      <span>{dateStr}</span>
                                      <span>•</span>
                                      <span className="capitalize">{ride.ride_mode || 'private'}</span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right">
                                      <span className="font-bold text-gold text-base">ZMW {ride.fare?.toFixed(2)}</span>
                                      <div className="mt-0.5">
                                        <StatusBadge status={ride.status} />
                                      </div>
                                    </div>
                                    {isExpanded ? (
                                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>

                                {/* Expanded Trip Full Details */}
                                {isExpanded && (
                                  <div className="p-5 md:p-6 bg-muted/20 border-t border-border space-y-4 text-xs w-full">
                                    {/* Route Details */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                      <div className="p-4 rounded-xl bg-card border border-border overflow-hidden">
                                        <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-1 text-gold">
                                          <MapPin className="w-4 h-4 shrink-0" /> Pickup Point
                                        </p>
                                        <p className="font-bold text-foreground text-sm mt-1 break-words whitespace-normal">{ride.pickup_location?.name || 'Pickup Point'}</p>
                                        <p className="text-muted-foreground text-xs mt-0.5 break-words whitespace-normal">{ride.pickup_location?.address}</p>
                                      </div>

                                      <div className="p-4 rounded-xl bg-card border border-border overflow-hidden">
                                        <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-1 text-emerald-400">
                                          <MapPin className="w-4 h-4 shrink-0" /> Destination Point
                                        </p>
                                        <p className="font-bold text-foreground text-sm mt-1 break-words whitespace-normal">{ride.dropoff_location?.name || 'Dropoff Point'}</p>
                                        <p className="text-muted-foreground text-xs mt-0.5 break-words whitespace-normal">{ride.dropoff_location?.address}</p>
                                      </div>
                                    </div>

                                    {/* Metrics Breakdown */}
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                      <div className="p-3.5 rounded-xl bg-card border border-border">
                                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Total Fare</p>
                                        <p className="font-extrabold text-gold text-base mt-1">ZMW {ride.fare?.toFixed(2)}</p>
                                      </div>
                                      <div className="p-3.5 rounded-xl bg-card border border-border">
                                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Driver Share</p>
                                        <p className="font-extrabold text-emerald-400 text-base mt-1">ZMW {ride.driver_earning?.toFixed(2) || (ride.fare * 0.85).toFixed(2)}</p>
                                      </div>
                                      <div className="p-3.5 rounded-xl bg-card border border-border">
                                        <p className="text-muted-foreground text-[10px] uppercase font-bold">Commission</p>
                                        <p className="font-extrabold text-foreground text-base mt-1">ZMW {ride.commission?.toFixed(2) || (ride.fare * 0.15).toFixed(2)}</p>
                                      </div>
                                    </div>

                                    {/* Passenger & Driver Involved */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-2 pt-2 border-t border-border">
                                      <span>Passenger: <strong className="text-foreground">{ride.student?.name || 'Student'}</strong></span>
                                      <span>Driver: <strong className="text-foreground">{ride.driver?.user?.name || (ride.driver_id ? 'Assigned Driver' : 'None')}</strong></span>
                                    </div>

                                    {/* Delete Ride Action */}
                                    <div className="flex items-center justify-between pt-2">
                                      <span className="font-mono text-[11px] text-muted-foreground">ID: {ride.id}</span>
                                      <button
                                        onClick={() => handleDeleteRide(ride.id)}
                                        className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete Record
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-12 text-center text-sm text-muted-foreground bg-muted/20 border border-border rounded-3xl">
                          No trip history recorded for this account yet
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Bottom Sticky Action Footer */}
              <div className="px-6 py-4 md:px-8 md:py-4 border-t border-border bg-card/95 backdrop-blur flex items-center justify-between shrink-0">
                {selectedUser?.role !== 'super_admin' && (
                  <button
                    onClick={() => handleToggleActiveStatus(selectedUser)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      selectedUser?.is_active !== false
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                    }`}
                  >
                    {selectedUser?.is_active !== false ? 'Suspend Account' : 'Activate Account'}
                  </button>
                )}

                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-6 py-2.5 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80 transition-colors ml-auto cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User / Driver Details Modal */}
        <Dialog open={isEditingUser} onOpenChange={setIsEditingUser}>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl">
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="text-xl font-bold flex items-center justify-between">
                <span>Edit {selectedUser?.role === 'driver' ? 'Driver' : 'Student'} Profile</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveUserEdits} className="space-y-4 pt-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-bold mb-1">Full Name</label>
                <GlassInput
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-bold mb-1">Email Address</label>
                  <GlassInput
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-bold mb-1">Phone Number</label>
                  <GlassInput
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-bold mb-1">Reset Password (Leave blank to keep current)</label>
                <GlassInput
                  type="password"
                  placeholder="Enter new password..."
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                />
              </div>

              {selectedUser?.role === 'driver' && (
                <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                  <p className="font-bold text-gold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <SteeringWheel weight="duotone" className="w-4 h-4 text-gold" />
                    Vehicle Fleet Specs
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Vehicle Model</label>
                      <GlassInput
                        type="text"
                        placeholder="e.g. Toyota Vitz"
                        value={editFormData.vehicle_model}
                        onChange={(e) => setEditFormData({ ...editFormData, vehicle_model: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Vehicle Color</label>
                      <GlassInput
                        type="text"
                        placeholder="e.g. Silver"
                        value={editFormData.vehicle_color}
                        onChange={(e) => setEditFormData({ ...editFormData, vehicle_color: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Plate Number</label>
                      <GlassInput
                        type="text"
                        placeholder="e.g. ABC 1234"
                        value={editFormData.plate_number}
                        onChange={(e) => setEditFormData({ ...editFormData, plate_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">License Number</label>
                      <GlassInput
                        type="text"
                        placeholder="e.g. LIC-9988"
                        value={editFormData.license_number}
                        onChange={(e) => setEditFormData({ ...editFormData, license_number: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditingUser(false)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <GoldButton type="submit" disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </GoldButton>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
          <DialogContent className="bg-card border-border sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground font-heading text-xl">Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <div className="p-2 rounded-full bg-red-500/20 text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-foreground font-bold mb-1">Permanently Delete User?</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Are you sure you want to delete <span className="text-foreground font-bold">{deleteConfirmation?.name}</span>?
                    This will permanently purge this account and all associated trip logs.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors text-xs font-bold shadow-lg shadow-red-500/20 cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminUsersPage;
