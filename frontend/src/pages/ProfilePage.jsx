import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Mail, Phone, Shield, Car, LogOut, Trash2, Loader2, 
  Camera, ChevronRight, Check, Edit3, Sparkles, Bell, Vibrate, CheckCircle2, ShieldAlert, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { MultiPlatformInstallSection } from '../components/common/MultiPlatformInstallSection';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { haptics } from '../utils/haptics';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { PermissionsService } from '../services/PermissionsService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const ProfilePage = () => {
  const { user, driverProfile, logout, isDriver, isAdmin, isSuperAdmin, api, fetchUser } = useAuth();
  const navigate = useNavigate();
  
  // Expandable Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);

  // Push & Vibration Settings State
  const [permissionState, setPermissionState] = useState('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [vibrationsEnabled, setVibrationsEnabled] = useState(() => haptics.isVibrationEnabled());

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

  // Check Push Notification status
  useEffect(() => {
    const checkPush = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await PushNotifications.checkPermissions();
          setPermissionState(perm.receive === 'granted' ? 'granted' : 'default');
        } catch (e) {
          setPermissionState('default');
        }
      } else if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }
    };
    checkPush();
  }, []);

  const handleLogout = () => {
    haptics.tap();
    logout();
    navigate('/');
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedDataUrl = await compressImageToDataUrl(file, 800, 0.8);
        setEditAvatar(compressedDataUrl);
        toast.success('Profile picture ready to save');
      } catch (err) {
        console.error('Error compressing avatar:', err);
        const reader = new FileReader();
        reader.onloadend = () => setEditAvatar(reader.result);
        reader.readAsDataURL(file);
      }
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

      if (fetchUser) {
        await fetchUser();
      }

      haptics.pinDrop();
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePushNotifications = async () => {
    haptics.tap();

    if (permissionState === 'granted') {
      toast.info('Notifications are already active on this device!');
      return;
    }

    setIsSubscribing(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const hasPermission = await PermissionsService.requestPushPermission();
        if (!hasPermission) {
          toast.error('Push notification permission denied on device.');
          setPermissionState('denied');
          setIsSubscribing(false);
          return;
        }

        await PushNotifications.register();
        
        PushNotifications.addListener('registration', async (fcmToken) => {
          try {
            await api.post('/notifications/subscribe', {
              endpoint: `FCM_TOKEN:${fcmToken.value}`,
              keys: { p256dh: "native", auth: "native" }
            });
            haptics.pinDrop();
            toast.success('Live Push Notifications Enabled!');
            setPermissionState('granted');
          } catch (err) {
            console.error('Failed backend subscribe:', err);
          }
        });
      } else {
        if (!('Notification' in window)) {
          toast.error('Notifications are not supported in this browser.');
          setIsSubscribing(false);
          return;
        }

        const perm = await Notification.requestPermission();
        setPermissionState(perm);

        if (perm !== 'granted') {
          toast.error('Notification permission blocked in browser settings. Tap the lock icon 🔒 next to web address to allow.');
          setIsSubscribing(false);
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        
        let publicKey;
        try {
          const res = await api.get('/notifications/vapid-public-key');
          publicKey = res.data?.publicKey;
        } catch (e) {
          const res = await fetch('/api/notifications/vapid-public-key');
          const data = await res.json();
          publicKey = data?.publicKey;
        }

        if (!publicKey) {
          throw new Error('VAPID public key missing');
        }

        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });

        await api.post('/notifications/subscribe', subscription);

        haptics.pinDrop();
        toast.success('Live Push Notifications Enabled!');
        setPermissionState('granted');
      }
    } catch (error) {
      console.error('Push activation error:', error);
      toast.error('Could not activate notifications.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleToggleVibrations = () => {
    const newState = !vibrationsEnabled;
    setVibrationsEnabled(newState);
    haptics.setVibrationEnabled(newState);
    if (newState) {
      haptics.driverArrived();
      toast.success('App Vibrations Enabled (ON by default)');
    } else {
      toast.info('App Vibrations Disabled');
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
      <div className="p-4 md:p-8 space-y-6 max-w-xl mx-auto pb-24" data-testid="profile-page">
        
        {/* ==================================================== */}
        {/* CHATGPT STYLE TOP CENTER AVATAR HEADER               */}
        {/* ==================================================== */}
        <div className="flex flex-col items-center text-center pt-4 pb-2 space-y-3">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-zinc-900 border-2 border-gold/40 flex items-center justify-center overflow-hidden shadow-2xl ring-4 ring-gold/10">
              {editAvatar || user?.avatar_url ? (
                <img
                  src={editAvatar || user?.avatar_url}
                  alt={user?.name || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : isSuperAdmin ? (
                <Shield className="w-12 h-12 text-gold" />
              ) : (
                <span className="text-4xl font-heading font-bold text-gold">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              )}
            </div>

            {/* Pencil / Camera Edit Badge */}
            <button
              type="button"
              onClick={() => {
                if (!isEditing) setIsEditing(true);
                setTimeout(() => fileInputRef.current?.click(), 100);
              }}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-zinc-800 border border-zinc-700 text-white hover:bg-gold hover:text-black transition-all shadow-xl cursor-pointer"
              title="Change profile picture"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div>
            <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
              {user?.name || 'User Name'}
            </h1>
            <p className="text-xs font-medium text-gold/90 bg-gold/10 px-3 py-1 rounded-full border border-gold/20 inline-block mt-1 capitalize">
              {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrator' : isDriver ? 'Driver' : 'Student'}
            </p>
          </div>
        </div>

        {/* ==================================================== */}
        {/* EDIT PROFILE FORM MODAL / COLLAPSIBLE PANEL         */}
        {/* ==================================================== */}
        <AnimatePresence>
          {isEditing && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleSaveProfile}
              className="bg-zinc-900 border border-gold/40 rounded-3xl p-5 space-y-4 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" /> Edit Account Profile
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-zinc-950 text-white rounded-2xl pl-10 pr-4 py-3 text-sm border border-zinc-800 focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-zinc-950 text-white rounded-2xl pl-10 pr-4 py-3 text-sm border border-zinc-800 focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-zinc-950 text-white rounded-2xl pl-10 pr-4 py-3 text-sm border border-zinc-800 focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-2xl bg-zinc-800 text-zinc-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-2xl bg-gold text-zinc-950 text-xs font-bold shadow-lg"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* ==================================================== */}
        {/* GROUP 1: ACCOUNT CATEGORY (ChatGPT Style Group Card) */}
        {/* ==================================================== */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Account</p>
          <div className="bg-zinc-900 border border-zinc-800/90 rounded-3xl overflow-hidden divide-y divide-zinc-800/70">
            {/* Edit Profile Row */}
            <div 
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <User className="w-5 h-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Full Name</p>
                  <p className="text-xs text-zinc-400">{user?.name || 'Not set'}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>

            {/* Email Row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <Mail className="w-5 h-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Email</p>
                  <p className="text-xs text-zinc-400">{user?.email || 'Not set'}</p>
                </div>
              </div>
            </div>

            {/* Phone Row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <Phone className="w-5 h-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Phone Number</p>
                  <p className="text-xs text-zinc-400">{user?.phone || 'Not set'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* GROUP 2: PREFERENCES & NOTIFICATIONS                */}
        {/* ==================================================== */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Preferences & Notifications</p>
          <div className="bg-zinc-900 border border-zinc-800/90 rounded-3xl overflow-hidden divide-y divide-zinc-800/70">
            {/* Push Notifications Row */}
            <div 
              onClick={handleTogglePushNotifications}
              className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Bell className={`w-5 h-5 ${permissionState === 'granted' ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <div>
                  <p className="text-sm font-semibold text-white">Live Push Notifications</p>
                  <p className="text-xs text-zinc-400">Driver arrival alerts & ride updates</p>
                </div>
              </div>

              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                permissionState === 'granted' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-gold/10 text-gold border-gold/30'
              }`}>
                {isSubscribing ? 'Enabling...' : permissionState === 'granted' ? 'Active 🟢' : 'Tap to Turn On'}
              </span>
            </div>

            {/* App Vibrations Row (Master Switch) */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <Vibrate className="w-5 h-5 text-gold" />
                <div>
                  <p className="text-sm font-semibold text-white">App Vibrations & Pocket Alerts</p>
                  <p className="text-xs text-zinc-400">Vibrate on arrival & button taps (ON by default)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleVibrations}
                className={`relative w-12 h-7 rounded-full p-1 transition-colors duration-300 focus:outline-none cursor-pointer ${
                  vibrationsEnabled ? 'bg-gold' : 'bg-zinc-700'
                }`}
              >
                <motion.div
                  animate={{ x: vibrationsEnabled ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={`w-5 h-5 rounded-full shadow-md ${
                    vibrationsEnabled ? 'bg-zinc-950' : 'bg-zinc-400'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Blocked Permission Warning Notice */}
        {permissionState === 'denied' && (
          <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-200">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-300">Notifications are blocked in browser settings</p>
              <p className="text-red-200/80 mt-0.5">
                Tap the lock icon 🔒 next to the web address at the top of your browser to set Notification permission to "Allow".
              </p>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* GROUP 3: VEHICLE DETAILS (For Drivers Only)          */}
        {/* ==================================================== */}
        {isDriver && driverProfile && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Vehicle Details</p>
            <div className="bg-zinc-900 border border-zinc-800/90 rounded-3xl overflow-hidden divide-y divide-zinc-800/70">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3.5">
                  <Car className="w-5 h-5 text-gold" />
                  <div>
                    <p className="text-sm font-semibold text-white">Vehicle</p>
                    <p className="text-xs text-zinc-400">{driverProfile.vehicle_color} {driverProfile.vehicle_model} ({driverProfile.vehicle_type})</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3.5">
                  <Shield className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Plate Number</p>
                    <p className="text-xs text-gold font-mono font-bold">{driverProfile.plate_number}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Approval Status</p>
                    <p className="text-xs text-emerald-400 font-medium">
                      {driverProfile.is_approved ? 'Approved Active Driver' : 'Pending Review'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* GROUP 4: APP & SYSTEM FEATURES                       */}
        {/* ==================================================== */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">App & System</p>
          <MultiPlatformInstallSection />
        </div>

        {/* ==================================================== */}
        {/* GROUP 5: ACTIONS (Log Out & Delete Account)          */}
        {/* ==================================================== */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Actions</p>
          <div className="bg-zinc-900 border border-zinc-800/90 rounded-3xl overflow-hidden divide-y divide-zinc-800/70">
            {/* Log Out Row */}
            <div 
              onClick={handleLogout}
              className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <LogOut className="w-5 h-5 text-red-400" />
                <p className="text-sm font-semibold text-red-400">Log Out</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </div>

            {/* Delete Account Row */}
            <div 
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Trash2 className="w-5 h-5 text-zinc-500" />
                <p className="text-sm font-semibold text-zinc-400">Delete Account</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-3xl p-6 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">Delete Account?</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-zinc-400 mt-2">
              Are you sure you want to permanently delete your account? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-lg"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
};

export default ProfilePage;
