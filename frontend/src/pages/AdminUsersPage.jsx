import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, Shield, Ban, Check, UserPlus, Trash2, Loader2, 
  Calendar, Filter, ArrowUpDown, ArrowUp, ArrowDown, Eye, Car, 
  MapPin, Clock, Phone, Mail, CheckCircle, AlertCircle, RefreshCw, X, ShieldAlert
} from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, EmptyState } from '../components/common/GlassComponents';
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

const AdminUsersPage = () => {
  const { api, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState(() => AppCache.get('admin_users') || []);
  const [loading, setLoading] = useState(() => !AppCache.get('admin_users'));
  
  // Search & Filter Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'name'

  // Admin Management Modals
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  
  // User Inspection & Management Drawer State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

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

  // Switch Role between Student and Driver
  const handleSwitchRole = async (targetUserId, currentRole) => {
    const nextRole = currentRole === 'student' ? 'driver' : 'student';
    setSwitchingRole(true);
    try {
      const res = await api.patch(`/admin/users/${targetUserId}/role`, { role: nextRole });
      const updatedUser = res.data;
      
      // Optimistically update local users list and cache
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

  // Fast Optimistic Suspend / Activate
  const handleToggleActiveStatus = async (userObj) => {
    const isCurrentlyActive = userObj.is_active !== false;
    const nextStatus = !isCurrentlyActive;

    // Optimistic UI update
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
      // Revert on error
      fetchUsers(true);
      toast.error(error.response?.data?.detail || 'Failed to update user status');
    }
  };

  // Fast Delete User
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    const targetId = deleteConfirmation.id;
    const targetName = deleteConfirmation.name;

    // Optimistic UI removal
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
      toast.success('Admin created successfully');
      setShowAddAdmin(false);
      setAdminForm({ name: '', email: '', phone: '', password: '' });
      fetchUsers(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  // Available Years for filter extraction
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

      // Date / Month / Year Filters
      if (user.created_at) {
        const dateObj = new Date(user.created_at);
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
      if (sortOrder === 'newest') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      } else if (sortOrder === 'oldest') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      } else if (sortOrder === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return result;
  }, [users, searchQuery, roleFilter, selectedMonth, selectedYear, sortOrder]);

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-gold/20 text-gold border-gold/30';
      case 'admin':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'driver':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  if (loading && users.length === 0) {
    return <AdminUsersSkeleton />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-users-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              User Management
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage accounts, roles, access controls & view detailed trip histories
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchUsers(false)}
              className="p-2.5 rounded-2xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              title="Refresh Users"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {isSuperAdmin && (
              <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
                <DialogTrigger asChild>
                  <GoldButton data-testid="add-admin-btn">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Admin
                  </GoldButton>
                </DialogTrigger>
                <DialogContent className="bg-card border-border sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-foreground font-heading">Create New Admin</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddAdmin} className="space-y-4 mt-4">
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
                      {addingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Admin'}
                    </GoldButton>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-card/60 p-4 rounded-3xl border border-border">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
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
              <option value="driver">Drivers</option>
              <option value="admin">Admins</option>
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
              <option value="name">Name (A-Z)</option>
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
                    <div className="w-11 h-11 rounded-2xl bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                      ) : user.role === 'super_admin' ? (
                        <Shield className="w-5 h-5 text-gold" />
                      ) : (
                        <span className="text-foreground font-heading font-bold text-base">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
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
                  <div className="lg:col-span-2 flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize whitespace-nowrap ${getRoleBadgeClass(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Col 3: Joined Date */}
                  <div className="lg:col-span-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                    <span>{joinedDate}</span>
                  </div>

                  {/* Col 4: Quick Role Switch (Student <-> Driver) */}
                  <div className="lg:col-span-2">
                    {isStudentOrDriver ? (
                      <button
                        onClick={() => handleSwitchRole(user.id, user.role)}
                        disabled={switchingRole}
                        className="text-xs px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={`Convert to ${user.role === 'student' ? 'Driver' : 'Student'}`}
                      >
                        <Car className="w-3.5 h-3.5 text-gold" />
                        <span>Make {user.role === 'student' ? 'Driver' : 'Student'}</span>
                      </button>
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

        {/* Detailed User Management Drawer / Modal (Desktop-Focused) */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl font-bold flex items-center justify-between">
                <span>User Management & History</span>
                {selectedUser && (
                  <span className={`text-xs px-2.5 py-1 rounded-full border capitalize font-semibold ${getRoleBadgeClass(selectedUser.role)}`}>
                    {selectedUser.role.replace('_', ' ')}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            {loadingDetails ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-gold animate-spin" />
                <p className="text-xs text-muted-foreground">Loading complete user profile & ride records...</p>
              </div>
            ) : userDetails ? (
              <div className="space-y-6 pt-4 text-sm">
                {/* User Identity Card */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted border border-gold/30 overflow-hidden flex items-center justify-center shrink-0">
                    {userDetails.user?.avatar_url ? (
                      <img src={userDetails.user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-heading font-bold text-2xl text-gold">
                        {(userDetails.user?.name || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-foreground truncate">{userDetails.user?.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5" /> {userDetails.user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5" /> {userDetails.user?.phone || 'No phone added'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Trips</p>
                    <p className="text-xl font-extrabold text-foreground">{userDetails.total_rides || 0}</p>
                  </div>
                </div>

                {/* Role Switcher Action Box */}
                {(userDetails.user?.role === 'student' || userDetails.user?.role === 'driver') && (
                  <div className="p-4 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gold uppercase tracking-wider">Account Role</p>
                      <p className="text-xs text-foreground mt-0.5">
                        Currently registered as <strong>{userDetails.user.role}</strong>. Convert if created in error.
                      </p>
                    </div>
                    <button
                      onClick={() => handleSwitchRole(userDetails.user.id, userDetails.user.role)}
                      disabled={switchingRole}
                      className="px-4 py-2 rounded-xl bg-gold text-zinc-950 font-bold text-xs shadow-md hover:bg-gold/90 transition-colors cursor-pointer shrink-0"
                    >
                      {switchingRole ? 'Switching...' : `Make ${userDetails.user.role === 'student' ? 'Driver' : 'Student'}`}
                    </button>
                  </div>
                )}

                {/* Driver Vehicle Specs (If Driver) */}
                {userDetails.driver_profile && (
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Driver Fleet Details</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div className="p-2.5 rounded-xl bg-card border border-border">
                        <p className="text-muted-foreground text-[10px]">Vehicle</p>
                        <p className="font-bold text-foreground">{userDetails.driver_profile.vehicle_color} {userDetails.driver_profile.vehicle_model}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-card border border-border">
                        <p className="text-muted-foreground text-[10px]">Plate Number</p>
                        <p className="font-bold text-gold font-mono">{userDetails.driver_profile.plate_number}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-card border border-border">
                        <p className="text-muted-foreground text-[10px]">Driver Rating</p>
                        <p className="font-bold text-foreground">⭐ {userDetails.driver_profile.rating?.toFixed(1) || '5.0'}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-card border border-border">
                        <p className="text-muted-foreground text-[10px]">Total Earnings</p>
                        <p className="font-bold text-emerald-400">ZMW {userDetails.driver_profile.total_earnings?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Ongoing Trip (If Any) */}
                {userDetails.active_ride && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Active Ongoing Trip
                      </p>
                      <span className="text-xs font-bold text-gold">ZMW {userDetails.active_ride.fare?.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-foreground font-medium pt-1">
                      <p>📍 From: {userDetails.active_ride.pickup_location?.name || userDetails.active_ride.pickup_location?.address}</p>
                      <p className="mt-1">🏁 To: {userDetails.active_ride.dropoff_location?.name || userDetails.active_ride.dropoff_location?.address}</p>
                      <p className="text-muted-foreground text-[11px] mt-1.5">Status: <span className="text-foreground capitalize">{userDetails.active_ride.status}</span></p>
                    </div>
                  </div>
                )}

                {/* Recent Ride Logs Table */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Recent Trip Logs ({userDetails.recent_rides?.length || 0})
                  </p>

                  {userDetails.recent_rides && userDetails.recent_rides.length > 0 ? (
                    <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                      {userDetails.recent_rides.map((ride) => (
                        <div key={ride.id} className="p-3 bg-card flex items-center justify-between text-xs hover:bg-muted/40 transition-colors">
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="font-bold text-foreground truncate">
                              {ride.pickup_location?.name || 'Pickup'} → {ride.dropoff_location?.name || 'Dropoff'}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                              <span>{ride.created_at ? new Date(ride.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              <span>•</span>
                              <span className="capitalize">{ride.ride_mode || 'private'}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-foreground">ZMW {ride.fare?.toFixed(2)}</span>
                            <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{ride.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-border rounded-2xl">
                      No trip history recorded for this account yet
                    </div>
                  )}
                </div>

                {/* Account Action Buttons */}
                <div className="pt-2 flex items-center justify-between border-t border-border">
                  {selectedUser?.role !== 'super_admin' && (
                    <button
                      onClick={() => handleToggleActiveStatus(selectedUser)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
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
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80 transition-colors ml-auto cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
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
