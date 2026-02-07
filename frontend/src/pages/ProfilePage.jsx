import React, { useState } from 'react';
import { User, Mail, Phone, Shield, Car, LogOut, Trash2, Loader2 } from 'lucide-react';
import { GlassCard, GoldButton } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const ProfilePage = () => {
  const { user, driverProfile, logout, isDriver, isAdmin, isSuperAdmin, api } = useAuth();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.delete('/users/me');
      toast.success('Account deleted successfully');
      logout();
      navigate('/');
    } catch (error) {
      toast.error('Failed to delete account');
      console.error(error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="profile-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
            Profile
          </h1>
          <p className="text-white/50">Manage your account</p>
        </div>

        {/* User Info Card */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center">
              {isSuperAdmin ? (
                <Shield className="w-10 h-10 text-gold" />
              ) : (
                <span className="text-3xl font-heading font-bold text-gold">
                  {user?.name?.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-heading text-xl font-semibold text-white">{user?.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${isSuperAdmin ? 'bg-gold/20 text-gold' :
                  isAdmin ? 'bg-purple-500/20 text-purple-400' :
                    isDriver ? 'bg-blue-500/20 text-blue-400' :
                      'bg-white/10 text-white/60'
                  }`}>
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
              <Mail className="w-5 h-5 text-white/40" />
              <div>
                <p className="text-xs text-white/40">Email</p>
                <p className="text-white">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
              <Phone className="w-5 h-5 text-white/40" />
              <div>
                <p className="text-xs text-white/40">Phone</p>
                <p className="text-white">{user?.phone}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Driver Info */}
        {isDriver && driverProfile && (
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <Car className="w-5 h-5 text-gold" />
              </div>
              <h3 className="font-heading font-semibold text-white">Vehicle Details</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-1">Vehicle Type</p>
                <p className="text-white capitalize">{driverProfile.vehicle_type}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-1">Model</p>
                <p className="text-white">{driverProfile.vehicle_model}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-1">Color</p>
                <p className="text-white">{driverProfile.vehicle_color}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-1">Plate Number</p>
                <p className="text-white font-mono">{driverProfile.plate_number}</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Approval Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${driverProfile.is_approved
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                  {driverProfile.is_approved ? 'Approved' : 'Pending Approval'}
                </span>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Become a Driver CTA */}
        {!isDriver && !isAdmin && (
          <GlassCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
                <Car className="w-6 h-6 text-gold" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-semibold text-white">Want to earn?</h3>
                <p className="text-white/50 text-sm">Register as a driver and start earning</p>
              </div>
              <GoldButton size="sm" onClick={() => navigate('/driver/register')} data-testid="become-driver-btn">
                Get Started
              </GoldButton>
            </div>
          </GlassCard>
        )}

        {/* Account Info */}
        <GlassCard className="p-6" hover={false}>
          <h3 className="font-heading font-semibold text-white mb-4">Account</h3>
          <div className="space-y-3 text-sm text-white/50">
            <div className="flex justify-between">
              <span>Member Since</span>
              <span className="text-white">
                {new Date(user?.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Account Status</span>
              <span className="text-green-400">Active</span>
            </div>
          </div>
        </GlassCard>

        {/* Logout Button */}
        <GoldButton
          variant="secondary"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </GoldButton>

        {/* Danger Zone */}
        <div className="pt-6 border-t border-white/10">
          <h3 className="font-heading font-semibold text-red-400 mb-4">Danger Zone</h3>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all font-medium"
            data-testid="delete-account-btn"
          >
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="bg-[#121212] border-white/10 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white font-heading text-xl">Delete Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <div className="p-2 rounded-full bg-red-500/20 text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Permanently Delete Account?</h4>
                  <p className="text-white/60 text-sm">
                    Are you sure you want to delete your account? This action cannot be undone and will remove all your data, ride history, and profile information.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium shadow-lg shadow-red-500/20 flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Forever
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProfilePage;
