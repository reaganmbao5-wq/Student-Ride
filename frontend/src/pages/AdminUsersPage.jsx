import React, { useState, useEffect } from 'react';
import { Users, Search, Shield, Ban, Check, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

const AdminUsersPage = () => {
  const { api, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { type: 'user' | 'admin', id: string, name: string }

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    try {
      if (deleteConfirmation.type === 'admin') {
        await api.delete(`/admin/delete-admin/${deleteConfirmation.id}`);
        toast.success(`Admin ${deleteConfirmation.name} deleted`);
      } else {
        await api.delete(`/admin/users/${deleteConfirmation.id}`);
        toast.success(`User ${deleteConfirmation.name} deleted`);
      }
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setDeleteConfirmation(null);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/suspend`);
      toast.success('User suspended');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to suspend user');
    }
  };

  const handleActivateUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/activate`);
      toast.success('User activated');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to activate user');
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
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-gold/20 text-gold border-gold/30';
      case 'admin':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'driver':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-white/10 text-white/60 border-white/10';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="admin-users-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
              User Management
            </h1>
            <p className="text-white/50">{users.length} total users</p>
          </div>

          {isSuperAdmin && (
            <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
              <DialogTrigger asChild>
                <GoldButton data-testid="add-admin-btn">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Add Admin
                </GoldButton>
              </DialogTrigger>
              <DialogContent className="bg-[#121212] border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-white font-heading">Create New Admin</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddAdmin} className="space-y-4 mt-4">
                  <GlassInput
                    type="text"
                    placeholder="Full Name"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    required
                    data-testid="admin-name-input"
                  />
                  <GlassInput
                    type="email"
                    placeholder="Email"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    required
                    data-testid="admin-email-input"
                  />
                  <GlassInput
                    type="tel"
                    placeholder="Phone"
                    value={adminForm.phone}
                    onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                    required
                    data-testid="admin-phone-input"
                  />
                  <GlassInput
                    type="password"
                    placeholder="Password"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    required
                    data-testid="admin-password-input"
                  />
                  <GoldButton type="submit" className="w-full" disabled={addingAdmin}>
                    {addingAdmin ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Admin'}
                  </GoldButton>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <GlassInput
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12"
            data-testid="search-users-input"
          />
        </div>

        {/* Users List */}
        {filteredUsers.length > 0 ? (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <GlassCard key={user.id} className="p-4" data-testid={`user-card-${user.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      {user.role === 'super_admin' ? (
                        <Shield className="w-6 h-6 text-gold" />
                      ) : (
                        <span className="text-white font-heading font-bold text-lg">
                          {user.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white truncate">{user.name}</p>
                        {!user.is_active && (
                          <span className="text-xs text-red-400 shrink-0 bg-red-500/10 px-2 py-0.5 rounded-full">Suspended</span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 truncate">{user.email}</p>
                      <p className="text-xs text-white/30">{user.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-[4rem] sm:pl-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border capitalize whitespace-nowrap ${getRoleBadgeClass(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>

                    {user.role !== 'super_admin' && (
                      <div className="flex items-center gap-2">
                        {user.is_active ? (
                          <button
                            onClick={() => handleSuspendUser(user.id)}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            title="Suspend"
                            data-testid={`suspend-user-${user.id}`}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateUser(user.id)}
                            className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                            title="Activate"
                            data-testid={`activate-user-${user.id}`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}

                        {isSuperAdmin && user.role === 'admin' && (
                          <button
                            onClick={() => setDeleteConfirmation({ type: 'admin', id: user.id, name: user.name })}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            title="Delete Admin"
                            data-testid={`delete-admin-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => setDeleteConfirmation({ type: 'user', id: user.id, name: user.name })}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Delete User"
                          data-testid={`delete-user-${user.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Try adjusting your search terms"
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
          <DialogContent className="bg-[#121212] border-white/10 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white font-heading text-xl">Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <div className="p-2 rounded-full bg-red-500/20 text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Permanently Delete User?</h4>
                  <p className="text-white/60 text-sm">
                    Are you sure you want to delete <span className="text-white font-bold">{deleteConfirmation?.name}</span>?
                    This action cannot be undone and will remove all associated data (rides, history, profile).
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium shadow-lg shadow-red-500/20"
              >
                Delete User
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminUsersPage;
