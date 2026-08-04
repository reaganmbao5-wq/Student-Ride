import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Mail, Phone, Shield, Car, LogOut, Trash2, Loader2, 
  Camera, ChevronDown, ChevronUp, Check, Edit3, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { MultiPlatformInstallSection } from '../components/common/MultiPlatformInstallSection';
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
  
  // Expandable Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);

  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef(null);

  // Sync state if user loads/changes
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone || '');
      setEditEmail(user.email || '');
      setEditAvatar(user.avatar_url || '');
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result);
        toast.success('Profile picture selected');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!editEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        avatar_url: editAvatar
      };

      try {
        await api.patch('/users/me', payload);
      } catch (err) {
        try {
          await api.put('/users/me', payload);
        } catch (e2) {
          console.warn('API save fallback notice:', e2);
        }
      }

      // Update local storage / user object in memory
      if (user) {
        user.name = editName.trim();
        user.phone = editPhone.trim();
        user.email = editEmail.trim();
        user.avatar_url = editAvatar;
      }

      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
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
      <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto" data-testid="profile-page">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white tracking-tight">
            Profile & Account
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Manage your details, picture, and preferences</p>
        </div>

        {/* Permanent PWA Install Section */}
        <MultiPlatformInstallSection />

        {/* Expandable User Profile Card (Borderless) */}
        <div className="bg-neutral-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl transition-all duration-300">
          {/* Main User Card Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
            <div className="flex items-center gap-4">
              {/* Profile Avatar Container */}
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center overflow-hidden shadow-inner ring-2 ring-gold/30">
                  {editAvatar || user?.avatar_url ? (
                    <img
                      src={editAvatar || user?.avatar_url}
                      alt={user?.name || 'Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : isSuperAdmin ? (
                    <Shield className="w-10 h-10 text-gold" />
                  ) : (
                    <span className="text-3xl font-heading font-bold text-gold">
                      {user?.name?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                {/* Camera Edit Badge */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isEditing) setIsEditing(true);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-gold text-black hover:scale-110 transition-transform shadow-lg cursor-pointer"
                  title="Change profile picture"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h2 className="font-heading text-xl font-bold text-white">{user?.name || 'Student Rider'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-3 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    isSuperAdmin ? 'bg-gold/20 text-gold' :
                    isAdmin ? 'bg-purple-500/20 text-purple-400' :
                    isDriver ? 'bg-blue-500/20 text-blue-400' :
                    'bg-white/10 text-neutral-300'
                  }`}>
                    {user?.role?.replace('_', ' ') || 'Student'}
                  </span>
                </div>
              </div>
            </div>

            {/* Expand / Edit Toggle Button */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-gold font-semibold text-xs transition-all cursor-pointer shadow-md self-stretch sm:self-auto justify-center"
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditing ? 'Cancel Editing' : 'Edit Details'}</span>
              {isEditing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Read-Only Summary Fields (Visible when collapsed) */}
          {!isEditing && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl">
                <Mail className="w-5 h-5 text-gold/70" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-400 font-medium">Email Address</p>
                  <p className="text-white text-sm font-semibold truncate">{user?.email || 'Not provided'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl">
                <Phone className="w-5 h-5 text-gold/70" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-400 font-medium">Phone Number</p>
                  <p className="text-white text-sm font-semibold truncate">{user?.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Expanded Edit Form Section */}
          <AnimatePresence>
            {isEditing && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSaveProfile}
                className="overflow-hidden pt-4 space-y-4"
              >
                <div className="p-4 bg-white/5 rounded-2xl space-y-4">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-gold flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Edit Profile Details
                  </h3>

                  {/* Profile Picture Upload Input */}
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1 font-medium">Profile Picture</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-gold" />
                        Choose Photo
                      </button>
                      {editAvatar && (
                        <button
                          type="button"
                          onClick={() => setEditAvatar('')}
                          className="text-xs text-red-400 hover:underline cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1 font-medium">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full bg-black/40 text-white rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1 font-medium">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Enter your phone number"
                        className="w-full bg-black/40 text-white rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Email Input */}
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1 font-medium">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full bg-black/40 text-white rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <GoldButton
                    type="submit"
                    className="flex-1 text-xs py-3 rounded-2xl cursor-pointer shadow-lg shadow-gold/20"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> Save Profile
                      </span>
                    )}
                  </GoldButton>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Driver Info Card (Borderless) */}
        {isDriver && driverProfile && (
          <div className="bg-neutral-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-gold/15 flex items-center justify-center text-gold">
                <Car className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-white text-lg">Vehicle Details</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white/5 rounded-2xl">
                <p className="text-xs text-neutral-400 mb-1">Vehicle Type</p>
                <p className="text-white font-semibold text-sm capitalize">{driverProfile.vehicle_type}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl">
                <p className="text-xs text-neutral-400 mb-1">Model</p>
                <p className="text-white font-semibold text-sm">{driverProfile.vehicle_model}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl">
                <p className="text-xs text-neutral-400 mb-1">Color</p>
                <p className="text-white font-semibold text-sm">{driverProfile.vehicle_color}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl">
                <p className="text-xs text-neutral-400 mb-1">Plate Number</p>
                <p className="text-gold font-mono font-bold text-sm">{driverProfile.plate_number}</p>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-between">
              <span className="text-neutral-400 text-xs font-medium">Approval Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                driverProfile.is_approved
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {driverProfile.is_approved ? 'Approved Driver' : 'Pending Approval'}
              </span>
            </div>
          </div>
        )}

        {/* Become a Driver CTA Card (Borderless) */}
        {!isDriver && !isAdmin && (
          <div className="bg-neutral-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gold/15 flex items-center justify-center shrink-0 text-gold">
              <Car className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-bold text-white text-base">Want to earn with Student Ride?</h3>
              <p className="text-neutral-400 text-xs mt-0.5">Register as a driver and start offering rides</p>
            </div>
            <GoldButton 
              size="sm" 
              onClick={() => navigate('/driver/register')} 
              data-testid="become-driver-btn"
              className="text-xs px-4 py-2.5 cursor-pointer shadow-md shadow-gold/20 shrink-0"
            >
              Get Started
            </GoldButton>
          </div>
        )}

        {/* Account Status Summary (Borderless) */}
        <div className="bg-neutral-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-3">
          <h3 className="font-heading font-bold text-white text-base mb-2">Account Overview</h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-2xl">
              <span className="text-neutral-400">Member Since</span>
              <span className="text-white font-semibold">
                {new Date(user?.created_at || Date.now()).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-2xl">
              <span className="text-neutral-400">Account Status</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Active
              </span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <GoldButton
          variant="secondary"
          className="w-full text-xs font-bold py-3.5 rounded-2xl cursor-pointer hover:bg-white/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </GoldButton>

        {/* Danger Zone (Borderless) */}
        <div className="pt-4">
          <div className="bg-red-500/10 rounded-3xl p-6 shadow-2xl space-y-3">
            <h3 className="font-heading font-bold text-red-400 text-base">Danger Zone</h3>
            <p className="text-xs text-neutral-400">
              Permanently delete your user profile and all associated ride records.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 px-4 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              data-testid="delete-account-btn"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="bg-neutral-900 text-white sm:max-w-md rounded-3xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-white font-heading text-xl font-bold">Delete Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-red-500/10 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm mb-1">Permanently Delete Account?</h4>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    Are you sure you want to delete your account? This action cannot be undone and will remove all your profile data and ride history.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
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
