import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  User as UserIcon, Mail, Phone as PhoneIcon, Shield as ShieldIcon, Car as CarIcon, LogOut, Trash2, Loader2, 
  Camera, ChevronRight, Check, Edit3, Bell as BellIcon, Vibrate, CheckCircle2, AlertCircle, ShieldAlert, X,
  Sun, Paintbrush, MapPin as MapPinIcon, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  User, EnvelopeSimple, Phone, Shield, Car, Bell, DeviceMobile, MapPin, Info 
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { MultiPlatformInstallSection } from '../components/common/MultiPlatformInstallSection';
import { BugReportButton } from '../components/common/BugReportButton';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { haptics } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { openExternalUrl, getBackendUrl } from '../utils/urlHelpers';
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
  const { user, driverProfile, logout, isDriver, isAdmin, isSuperAdmin, api, fetchUser, updateUser, setUser } = useAuth();
  const navigate = useNavigate();
  
  // Bottom Sheet Edit Profile Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar_url || '');
  const [editYearOfStudy, setEditYearOfStudy] = useState(user?.year_of_study || 1);
  const [editProgramType, setEditProgramType] = useState(user?.program_type || 'standard');
  const [isSaving, setIsSaving] = useState(false);

  // Push & Vibration Settings State
  const [isPushEnabled, setIsPushEnabled] = useState(() => localStorage.getItem('mulu_push_enabled') !== 'false');
  const [permissionState, setPermissionState] = useState('default');
  const [vibrationsEnabled, setVibrationsEnabled] = useState(() => haptics.isVibrationEnabled());

  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Theme & Accent Color Context
  const { themeMode, setThemeMode, accentColor, setAccentColor, ACCENT_COLORS } = useTheme();
  const [appearanceMenuOpen, setAppearanceMenuOpen] = useState(false);
  const [accentMenuOpen, setAccentMenuOpen] = useState(false);
  const [aboutMenuOpen, setAboutMenuOpen] = useState(false);

  // Map Theme State & Handler
  const [mapThemeMode, setMapThemeMode] = useState(() => localStorage.getItem('map_theme_mode') || 'auto');
  const [mapThemeMenuOpen, setMapThemeMenuOpen] = useState(false);

  const handleMapThemeChange = (mode) => {
    setMapThemeMode(mode);
    localStorage.setItem('map_theme_mode', mode);
    window.dispatchEvent(new CustomEvent('map-theme-change', { detail: mode }));
    toast.success(`Map Theme set to ${mode === 'auto' ? 'Auto (Follow Time)' : mode === 'light' ? 'Light Mode' : 'Night Dark Mode'}`);
  };

  // Location Permission & Toggle State
  const [isLocationEnabled, setIsLocationEnabled] = useState(() => localStorage.getItem('mulu_location_enabled') !== 'false');
  const [locationPermissionState, setLocationPermissionState] = useState('prompt');


  const fileInputRef = useRef(null);

  // Sync state if user loads/changes
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone || '');
      setEditAvatar(user.avatar_url || '');
      setEditYearOfStudy(user.year_of_study || 1);
      setEditProgramType(user.program_type || 'standard');
    }
  }, [user]);

  // Check Location & Push Notification permission status on mount
  useEffect(() => {
    const checkPermissions = async () => {
      // Check Push
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

      // Check Location Permission
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const res = await navigator.permissions.query({ name: 'geolocation' });
          setLocationPermissionState(res.state);
          res.onchange = () => setLocationPermissionState(res.state);
        } catch (e) {
          setLocationPermissionState('prompt');
        }
      }
    };
    checkPermissions();
  }, []);

  const handleToggleLocation = async () => {
    haptics.tap();
    if (isLocationEnabled) {
      setIsLocationEnabled(false);
      localStorage.setItem('mulu_location_enabled', 'false');
      window.dispatchEvent(new Event('mulu-location-setting-changed'));
      toast.info('Location turned OFF');
    } else {
      setIsLocationEnabled(true);
      localStorage.setItem('mulu_location_enabled', 'true');
      window.dispatchEvent(new Event('mulu-location-setting-changed'));
      toast.success('Location turned ON');

      if (Capacitor.isNativePlatform()) {
        try { await PermissionsService.requestLocationPermission(); } catch (e) {}
      } else if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocationPermissionState('granted'),
          (err) => {},
          { timeout: 5000, enableHighAccuracy: true }
        );
      }
    }
  };

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

    setIsSaving(true);
    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim(),
        avatar_url: editAvatar,
        ...(user?.role === 'student' ? {
          year_of_study: Number(editYearOfStudy),
          program_type: editProgramType
        } : {})
      };

      const response = await api.patch('/users/me', payload);
      const updatedUser = response.data || { ...user, ...payload };

      if (updateUser) {
        updateUser(updatedUser);
      } else if (setUser) {
        setUser(updatedUser);
      }

      setEditName(updatedUser.name || editName);
      setEditPhone(updatedUser.phone || editPhone);
      setEditAvatar(updatedUser.avatar_url || editAvatar);
      if (updatedUser.year_of_study) setEditYearOfStudy(updatedUser.year_of_study);
      if (updatedUser.program_type) setEditProgramType(updatedUser.program_type);

      if (fetchUser) {
        fetchUser();
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

  // Seamless Zero-Error Push Notifications Toggle (Uses existing granted browser permission fingerprint)
  const handleToggleNotifications = async () => {
    haptics.tap();
    const nextState = !isPushEnabled;
    setIsPushEnabled(nextState);
    localStorage.setItem('mulu_push_enabled', nextState ? 'true' : 'false');

    if (!nextState) {
      toast.info('Notifications Turned OFF');
      // Background unsubscribe cleanup
      try { await api.post('/notifications/unsubscribe'); } catch (e) {}
      return;
    }

    // Turning ON
    toast.success('Notifications Turned ON');

    // Register / Push setup in background using existing permission fingerprint
    try {
      if (Capacitor.isNativePlatform()) {
        const hasPermission = await PermissionsService.requestPushPermission();
        if (hasPermission) {
          await PushNotifications.register();
          setPermissionState('granted');
        }
      } else if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          setPermissionState('granted');
          const registration = await navigator.serviceWorker.ready;
          let publicKey;
          try {
            const res = await api.get('/notifications/vapid-public-key');
            publicKey = res.data?.publicKey || res.data?.public_key;
          } catch (e) {
            try {
              const backendUrl = getBackendUrl ? getBackendUrl() : '';
              if (backendUrl) {
                const res = await fetch(`${backendUrl}/api/notifications/vapid-public-key`);
                if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
                  const data = await res.json();
                  publicKey = data?.publicKey || data?.public_key;
                }
              }
            } catch (fetchErr) {
              console.warn('Could not fetch VAPID key:', fetchErr);
            }
          }
          if (publicKey) {
            const convertedVapidKey = urlBase64ToUint8Array(publicKey);
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey,
            });
            await api.post('/notifications/subscribe', subscription);
          }
        } else {
          const perm = await Notification.requestPermission();
          setPermissionState(perm);
        }
      }
    } catch (err) {
      console.warn('Background push registration notice:', err);
    }
  };

  const handleToggleVibrations = () => {
    haptics.tap();
    const newState = !vibrationsEnabled;
    setVibrationsEnabled(newState);
    haptics.setVibrationEnabled(newState);
    if (newState) {
      haptics.driverArrived();
      toast.success('App Vibrations Turned ON');
    } else {
      toast.info('App Vibrations Turned OFF');
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

  // Render Bottom Sheet Edit Modal via Portal (Slides UP from bottom)
  const renderEditBottomSheet = () => {
    if (!isEditing) return null;

    const modalJSX = (
      <AnimatePresence>
        <div className="fixed inset-0 z-[999999] flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsEditing(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-xl mx-auto bg-card text-card-foreground border-t border-border rounded-t-[32px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Top Drag Handle Bar */}
            <div className="w-full flex justify-center pb-2">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <User className="w-5 h-5 text-gold" /> Edit Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile Photo Row */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted/40 border border-border">
                <div className="w-14 h-14 rounded-full bg-muted overflow-hidden border border-gold/30 shrink-0">
                  {editAvatar || user?.avatar_url ? (
                    <img src={editAvatar || user?.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-muted-foreground m-3" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">Profile Photo</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gold font-bold hover:underline mt-0.5 cursor-pointer"
                  >
                    Change Picture
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-muted/50 text-foreground rounded-2xl pl-10 pr-4 py-3 text-sm border border-border focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-medium">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-muted/50 text-foreground rounded-2xl pl-10 pr-4 py-3 text-sm border border-border focus:outline-none focus:border-gold"
                    required
                  />
                </div>
              </div>

              {/* Student Year of Study & Program Type (if student) */}
              {user?.role === 'student' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Year of Study</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {['1', '2', '3', '4', '5'].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setEditYearOfStudy(Number(yr))}
                          className={`py-2 rounded-xl text-xs font-extrabold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                            Number(editYearOfStudy) === Number(yr)
                              ? 'bg-gold border-gold text-white font-bold shadow-none scale-[1.02]'
                              : 'bg-muted/60 border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                          }`}
                        >
                          <span>{yr === '1' ? '1st' : yr === '2' ? '2nd' : yr === '3' ? '3rd' : `${yr}th`}</span>
                          <span className="text-[9px] font-semibold opacity-75">Year</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Program Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditProgramType('standard')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                          editProgramType === 'standard'
                            ? 'bg-gold/15 border-gold text-gold shadow-none'
                            : 'bg-muted/60 border-border text-muted-foreground hover:border-border/80'
                        }`}
                      >
                        <span>Standard</span>
                        <span className="text-[10px] font-medium opacity-80">(4-Year Degree)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditProgramType('engineering')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                          editProgramType === 'engineering'
                            ? 'bg-gold/15 border-gold text-gold shadow-none'
                            : 'bg-muted/60 border-border text-muted-foreground hover:border-border/80'
                        }`}
                      >
                        <span>Engineering</span>
                        <span className="text-[10px] font-medium opacity-80">(5-Year Degree)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-muted text-foreground text-xs font-bold border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3.5 rounded-2xl bg-gold text-zinc-950 text-xs font-bold shadow-lg cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </AnimatePresence>
    );

    return ReactDOM.createPortal(modalJSX, document.body);
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
                haptics.tap();
                setIsEditing(true);
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
            <h1 className="font-heading text-2xl font-bold text-foreground tracking-tight">
              {user?.name || 'User Name'}
            </h1>
            <p className="text-xs font-medium text-gold/90 bg-gold/10 px-3 py-1 rounded-full border border-gold/20 inline-block mt-1 capitalize">
              {isSuperAdmin 
                ? 'Super Admin' 
                : isAdmin 
                  ? 'Administrator' 
                  : isDriver 
                    ? 'Driver' 
                    : user?.role === 'lecturer' 
                      ? 'Lecturer' 
                      : user?.year_of_study 
                        ? `Student • Year ${user.year_of_study}` 
                        : 'Student'}
            </p>
          </div>
        </div>

        {/* Bottom Sheet Modal Portal */}
        {renderEditBottomSheet()}

        {/* ==================================================== */}
        {/* GROUP 1: ACCOUNT CATEGORY (ChatGPT Style Group Card) */}
        {/* ==================================================== */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Account</p>
          <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border">
            {/* Edit Profile Row */}
            <div 
              onClick={() => {
                haptics.tap();
                setIsEditing(true);
              }}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <User weight="duotone" className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Full Name</p>
                  <p className="text-xs text-muted-foreground">{user?.name || 'Not set'}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Email Row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <EnvelopeSimple weight="duotone" className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Email</p>
                  <p className="text-xs text-muted-foreground">{user?.email || 'Not set'}</p>
                </div>
              </div>
            </div>

            {/* Phone Row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <Phone weight="duotone" className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Phone Number</p>
                  <p className="text-xs text-muted-foreground">{user?.phone || 'Not set'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* GROUP 2: PREFERENCES, LOCATION & NOTIFICATIONS       */}
        {/* ==================================================== */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Preferences & Permissions</p>
          <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border">
            
            {/* Location Permission & Toggle Row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <MapPin weight="duotone" className={`w-5 h-5 ${isLocationEnabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Location Services</p>
                  <p className="text-xs text-muted-foreground">
                    {isLocationEnabled ? 'GPS pickup & ETA tracking active' : 'Location disabled'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleLocation}
                className={`relative w-12 h-7 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  isLocationEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                }`}
                title={isLocationEnabled ? 'Location ON' : 'Location OFF'}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                    isLocationEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notifications Row with Authentic Native Mobile Toggle Switch */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <Bell weight="duotone" className={`w-5 h-5 ${isPushEnabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {isPushEnabled ? 'Driver arrival alerts & ride updates' : 'Notifications disabled'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`relative w-12 h-7 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  isPushEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                }`}
                title={isPushEnabled ? 'Notifications ON' : 'Notifications OFF'}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                    isPushEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* App Vibrations Row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <DeviceMobile weight="duotone" className={`w-5 h-5 ${vibrationsEnabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">App Vibrations & Pocket Alerts</p>
                  <p className="text-xs text-muted-foreground">Vibrate on arrival & button taps</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleVibrations}
                className={`relative w-12 h-7 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  vibrationsEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                }`}
                title={vibrationsEnabled ? 'App vibrations ON' : 'App vibrations OFF'}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                    vibrationsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* APPEARANCE & ACCENT COLOR                            */}
        {/* ==================================================== */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Theme & Style</p>
          <div className="bg-card border border-border rounded-3xl divide-y divide-border relative z-30">
            
            {/* Appearance Card */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setAppearanceMenuOpen(!appearanceMenuOpen);
                  setAccentMenuOpen(false);
                  setMapThemeMenuOpen(false);
                  setAboutMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3.5">
                  <Sun className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Appearance</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {themeMode === 'system' ? 'System (Default)' : themeMode === 'light' ? 'Light' : 'Dark'}
                    </p>
                  </div>
                </div>
                {appearanceMenuOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Appearance Popup Menu (Opens UPWARDS) */}
              <AnimatePresence>
                {appearanceMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-4 bottom-full mb-2 z-[100] w-56 bg-card border border-border rounded-2xl shadow-2xl p-2 space-y-1"
                  >
                    {[
                      { id: 'system', label: 'System (Default)' },
                      { id: 'light', label: 'Light' },
                      { id: 'dark', label: 'Dark' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setThemeMode(opt.id);
                          setAppearanceMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${
                          themeMode === opt.id ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {themeMode === opt.id && <Check className="w-4 h-4 text-foreground shrink-0" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Accent color Card */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setAccentMenuOpen(!accentMenuOpen);
                  setAppearanceMenuOpen(false);
                  setMapThemeMenuOpen(false);
                  setAboutMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3.5">
                  <Paintbrush className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Accent color</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 capitalize mt-0.5">
                      <span
                        className="w-3 h-3 rounded-full inline-block shrink-0 border border-border"
                        style={{ backgroundColor: ACCENT_COLORS[accentColor]?.hex || '#3B82F6' }}
                      />
                      <span>{ACCENT_COLORS[accentColor]?.label || 'Blue (Default)'}</span>
                    </p>
                  </div>
                </div>
                {accentMenuOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Accent Color Popup Menu (Opens UPWARDS) */}
              <AnimatePresence>
                {accentMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 0, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-4 bottom-full mb-2 z-[100] w-56 bg-card border border-border rounded-2xl shadow-2xl p-2 space-y-1 max-h-72 overflow-y-auto"
                  >
                    {Object.entries(ACCENT_COLORS).map(([key, opt]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setAccentColor(key);
                          setAccentMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${
                          accentColor === key ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full inline-block shrink-0 border border-border"
                            style={{ backgroundColor: opt.hex }}
                          />
                          <span>{opt.label}</span>
                        </div>
                        {accentColor === key && <Check className="w-4 h-4 text-foreground shrink-0" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Map Theme Mode Card */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setMapThemeMenuOpen(!mapThemeMenuOpen);
                  setAppearanceMenuOpen(false);
                  setAccentMenuOpen(false);
                  setAboutMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3.5">
                  <MapPin className="w-5 h-5 text-gold shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Map Theme</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {mapThemeMode === 'auto' ? 'Auto (Follow Time)' : mapThemeMode === 'light' ? 'Light Mode' : 'Night Dark Mode'}
                    </p>
                  </div>
                </div>
                {mapThemeMenuOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Map Theme Popup Menu */}
              <AnimatePresence>
                {mapThemeMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-4 bottom-full mb-2 z-[100] w-64 bg-card border border-border rounded-2xl shadow-2xl p-2 space-y-1"
                  >
                    {[
                      { id: 'auto', label: 'Auto (Follow Time)' },
                      { id: 'light', label: 'Light Mode' },
                      { id: 'dark', label: 'Night Dark Mode' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          handleMapThemeChange(opt.id);
                          setMapThemeMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${
                          mapThemeMode === opt.id ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {mapThemeMode === opt.id && <Check className="w-4 h-4 text-foreground shrink-0" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* About Card */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setAboutMenuOpen(!aboutMenuOpen);
                  setAppearanceMenuOpen(false);
                  setAccentMenuOpen(false);
                  setMapThemeMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3.5">
                  <Info weight="duotone" className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">About</p>
                    <p className="text-xs text-muted-foreground">Terms of service & privacy policy</p>
                  </div>
                </div>
                {aboutMenuOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {aboutMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden bg-muted/30 border-t border-border divide-y divide-border"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        openExternalUrl('/terms');
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-sm font-medium text-foreground">Terms of service</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        openExternalUrl('/privacy');
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-sm font-medium text-foreground">Privacy policy</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* Blocked Permission Warning Notice */}
        {permissionState === 'denied' && (
          <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-500">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-500">
                {Capacitor.isNativePlatform() 
                  ? 'Notifications are disabled in phone settings' 
                  : 'Notifications are blocked in browser settings'}
              </p>
              <p className="text-red-500/80 mt-0.5">
                {Capacitor.isNativePlatform()
                  ? 'Please enable notifications in your phone Settings > Apps > Jaey Ride > Notifications.'
                  : 'Tap the lock icon 🔒 next to the web address at the top of your browser to set Notification permission to "Allow".'}
              </p>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* GROUP 3: VEHICLE DETAILS (For Drivers Only)          */}
        {/* ==================================================== */}
        {isDriver && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Vehicle Details</p>
            </div>

            {(!driverProfile || driverProfile.needs_setup || !driverProfile.plate_number || !driverProfile.vehicle_model) ? (
              <div className="bg-card border-2 border-dashed border-amber-500/40 dark:border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-sm">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Car weight="duotone" className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">Action Required</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        Incomplete Setup
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Your driver vehicle details and credentials have not been submitted yet. Complete setup to submit your documents and start driving.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    haptics.tap();
                    navigate('/driver/register');
                  }}
                  className="w-full py-3.5 px-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-transform shadow-sm"
                >
                  Complete Vehicle Setup
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border shadow-sm">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3.5">
                    <Car weight="duotone" className="w-5 h-5 text-gold" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Vehicle</p>
                      <p className="text-xs text-muted-foreground">{driverProfile.vehicle_color} {driverProfile.vehicle_model} ({driverProfile.vehicle_type})</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3.5">
                    <Shield weight="duotone" className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Plate Number</p>
                      <p className="text-xs text-gold font-mono font-bold">{driverProfile.plate_number}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3.5">
                    {driverProfile.is_approved ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">Approval Status</p>
                      <p className={`text-xs font-medium ${driverProfile.is_approved ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {driverProfile.is_approved ? 'Approved Active Driver' : 'Pending Admin Review'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* GROUP 4: APP & SYSTEM FEATURES                       */}
        {/* ==================================================== */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Support & App</p>
          <BugReportButton onClick={() => window.dispatchEvent(new CustomEvent('open-bug-report-modal', { detail: { isFromActiveRide: false } }))} />
          <MultiPlatformInstallSection />
        </div>

        {/* ==================================================== */}
        {/* GROUP 5: ACTIONS (Log Out & Delete Account)          */}
        {/* ==================================================== */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Actions</p>
          <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border">
            {/* Log Out Row */}
            <div 
              onClick={handleLogout}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <LogOut className="w-5 h-5 text-red-500" />
                <p className="text-sm font-semibold text-red-500">Log Out</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Delete Account Row */}
            <div 
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Trash2 className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-semibold text-muted-foreground">Delete Account</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="bg-card border border-border text-foreground rounded-3xl p-6 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">Delete Account?</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-2">
              Are you sure you want to permanently delete your account? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-xs font-bold text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-lg cursor-pointer"
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
