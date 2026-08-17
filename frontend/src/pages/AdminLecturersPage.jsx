import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Shield, Ban, Check, Trash2, Loader2, 
  Calendar, Eye, Phone, Mail, RefreshCw, X, GraduationCap
} from 'lucide-react';
import { SteeringWheel } from '@phosphor-icons/react';
import { GlassCard, GlassInput, GoldButton, EmptyState } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminUsersSkeleton } from '../components/common/PageSkeletons';
import { AppCache } from '../utils/AppCache';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AdminLecturersPage() {
  const { api, isSuperAdmin } = useAuth();
  const [lecturers, setLecturers] = useState(() => AppCache.get('admin_lecturers') || []);
  const [loading, setLoading] = useState(() => !AppCache.get('admin_lecturers'));
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'name'

  // Selected User Modal / Drawer State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  useEffect(() => {
    fetchLecturers(Boolean(AppCache.get('admin_lecturers')));
  }, []);

  const fetchLecturers = async (isBackground = false) => {
    try {
      if (!isBackground && lecturers.length === 0) setLoading(true);
      const response = await api.get('/admin/users?role=lecturer');
      setLecturers(response.data);
      AppCache.set('admin_lecturers', response.data);
    } catch (error) {
      console.error('Error fetching lecturers:', error);
      toast.error('Failed to load lecturers');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleOpenUserDetails = async (user) => {
    setSelectedUser(user);
    setUserDetails(null);
    setLoadingDetails(true);

    try {
      const res = await api.get(`/admin/users/${user.id}/details`);
      setUserDetails(res.data);
    } catch (error) {
      console.error('Error fetching lecturer details:', error);
      toast.error('Failed to load full lecturer details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSwitchRole = async (targetUserId, nextRole) => {
    setSwitchingRole(true);
    try {
      const res = await api.patch(`/admin/users/${targetUserId}/role`, { role: nextRole });
      const updatedUser = res.data;
      
      const nextLecturers = lecturers.filter(u => u.id !== targetUserId);
      setLecturers(nextLecturers);
      AppCache.set('admin_lecturers', nextLecturers);

      if (selectedUser?.id === targetUserId) {
        setSelectedUser(prev => ({ ...prev, role: nextRole }));
        if (userDetails) {
          setUserDetails(prev => ({ ...prev, user: updatedUser }));
        }
      }

      toast.success(`Role switched to ${nextRole.toUpperCase()} successfully`);
      fetchLecturers(true);
    } catch (error) {
      console.error('Error switching role:', error);
      toast.error(error.response?.data?.detail || 'Failed to switch user role');
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleToggleActiveStatus = async (userObj) => {
    const isCurrentlyActive = userObj.is_active !== false;
    const nextStatus = !isCurrentlyActive;

    const nextLecturers = lecturers.map(u => u.id === userObj.id ? { ...u, is_active: nextStatus } : u);
    setLecturers(nextLecturers);
    AppCache.set('admin_lecturers', nextLecturers);

    try {
      await api.patch(`/admin/users/${userObj.id}/status`, { is_active: nextStatus });
      toast.success(`Lecturer account ${nextStatus ? 'activated' : 'suspended'}`);
    } catch (err) {
      console.error('Error toggling lecturer status:', err);
      toast.error('Failed to update lecturer status');
      fetchLecturers(true);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      const nextLecturers = lecturers.filter(u => u.id !== userId);
      setLecturers(nextLecturers);
      AppCache.set('admin_lecturers', nextLecturers);

      if (selectedUser?.id === userId) {
        setSelectedUser(null);
        setUserDetails(null);
      }
      setDeleteConfirmation(null);
      toast.success('Lecturer deleted successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete lecturer');
    }
  };

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    lecturers.forEach(u => {
      if (u.created_at) {
        const y = new Date(u.created_at).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [lecturers]);

  // Filtered & Sorted Lecturers
  const processedLecturers = useMemo(() => {
    let result = lecturers.filter(user => {
      const matchesSearch = 
        (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.phone || '').includes(searchQuery);

      if (!matchesSearch) return false;

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
  }, [lecturers, searchQuery, selectedMonth, selectedYear, sortOrder]);

  if (loading && lecturers.length === 0) {
    return <AdminUsersSkeleton />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-lecturers-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
              <GraduationCap className="w-8 h-8 text-gold" />
              <span>Lecturer Directory</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              View and manage registered academic staff accounts, activity & history
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchLecturers(false)}
              className="p-2.5 rounded-2xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              title="Refresh Lecturers"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 bg-card/60 p-4 rounded-3xl border border-border">
          {/* Search Box */}
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search lecturer name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/60 text-foreground text-sm rounded-2xl pl-10 pr-4 py-2.5 border border-border focus:outline-none focus:border-gold"
            />
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
          <span>Showing <strong className="text-foreground">{processedLecturers.length}</strong> of {lecturers.length} lecturers</span>
          {(searchQuery || selectedMonth !== 'all' || selectedYear !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
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
        {processedLecturers.length > 0 ? (
          <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border shadow-sm">
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4">Lecturer Information</div>
              <div className="col-span-2">Role & Badge</div>
              <div className="col-span-2">Joined Date</div>
              <div className="col-span-2">Quick Convert</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {processedLecturers.map((user) => {
              const joinedDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

              return (
                <div 
                  key={user.id} 
                  className="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 lg:items-center hover:bg-muted/30 transition-colors"
                >
                  {/* Col 1: Profile Info */}
                  <div className="lg:col-span-4 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 overflow-hidden flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5 text-amber-500" />
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

                  {/* Col 2: Role Badge */}
                  <div className="lg:col-span-2 flex items-center gap-1.5">
                    <span className="text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Lecturer
                    </span>
                  </div>

                  {/* Col 3: Joined Date */}
                  <div className="lg:col-span-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                    <span>{joinedDate}</span>
                  </div>

                  {/* Col 4: Quick Role Convert */}
                  <div className="lg:col-span-2">
                    <select
                      value="lecturer"
                      disabled={switchingRole}
                      onChange={(e) => handleSwitchRole(user.id, e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold cursor-pointer focus:outline-none focus:border-gold"
                    >
                      <option value="lecturer">Lecturer</option>
                      <option value="student">Convert to Student</option>
                      <option value="driver">Convert to Driver</option>
                    </select>
                  </div>

                  {/* Col 5: Actions */}
                  <div className="lg:col-span-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenUserDetails(user)}
                      className="px-3 py-1.5 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Manage Lecturer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Manage</span>
                    </button>

                    <button
                      onClick={() => handleToggleActiveStatus(user)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        user.is_active !== false
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                      }`}
                      title={user.is_active !== false ? 'Suspend Lecturer' : 'Activate Lecturer'}
                    >
                      {user.is_active !== false ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => setDeleteConfirmation({ id: user.id, name: user.name })}
                      className="p-2 rounded-xl bg-muted hover:bg-red-500/10 text-muted-foreground hover:text-red-400 border border-border hover:border-red-500/20 transition-colors cursor-pointer"
                      title="Delete Lecturer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="No lecturers found"
            description="No accounts registered under the Lecturer role match your filters"
          />
        )}

        {/* Selected User Details Modal */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200">
            <div className="bg-card text-foreground border border-border w-full h-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
              <div className="px-6 py-4 md:px-8 md:py-5 border-b border-border flex items-center justify-between bg-card/95 backdrop-blur shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-extrabold text-foreground flex items-center gap-2">
                      <span>{selectedUser?.name}</span>
                      <span className="text-xs font-bold text-amber-400 uppercase">• Lecturer</span>
                    </h2>
                    <p className="text-xs text-muted-foreground">{selectedUser?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedUser(null); setUserDetails(null); }}
                  className="p-2 rounded-2xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {loadingDetails ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-gold" />
                    <p className="text-sm font-medium">Loading lecturer history...</p>
                  </div>
                ) : userDetails ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-muted/40 border border-border">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Total Trips</p>
                        <p className="text-2xl font-extrabold text-foreground mt-1">{userDetails.total_rides || 0}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/40 border border-border">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Phone</p>
                        <p className="text-sm font-bold text-foreground mt-1">{selectedUser.phone || 'N/A'}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/40 border border-border">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Account Status</p>
                        <p className="text-sm font-bold text-emerald-400 mt-1">{selectedUser.is_active !== false ? 'Active' : 'Suspended'}</p>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-gold/10 border border-gold/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-gold uppercase tracking-wider">Switch Account Role</p>
                        <p className="text-xs text-foreground mt-0.5">Convert this academic account to Student or Driver.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSwitchRole(selectedUser.id, 'student')}
                          disabled={switchingRole}
                          className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold cursor-pointer"
                        >
                          Make Student
                        </button>
                        <button
                          onClick={() => handleSwitchRole(selectedUser.id, 'driver')}
                          disabled={switchingRole}
                          className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold cursor-pointer"
                        >
                          Make Driver
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-0">
            <div className="bg-card border border-border p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-foreground">Confirm Deletion</h3>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete <strong>{deleteConfirmation.name}</strong>?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteUser(deleteConfirmation.id)}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
