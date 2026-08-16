import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, Mail, Phone, User as UserIcon, Lock, UploadCloud, FileText, CheckCircle2, Camera as CameraIcon } from 'lucide-react';
import { Car } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleAuth } from '@daniele-rolli/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { motion, AnimatePresence } from 'framer-motion';
import { PermissionsService } from '../services/PermissionsService';
import { compressImage } from '../utils/imageCompressor';
import { getOnlineWebUrl, openExternalUrl, getBackendUrl } from '../utils/urlHelpers';
import { showFriendlyError } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/common/GlassComponents';

const GlassInput = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all ${className}`}
    {...props}
  />
));
GlassInput.displayName = 'GlassInput';

const GoldButton = ({ children, className, loading, ...props }) => (
  <button
    disabled={loading}
    className={`w-full bg-gold hover:bg-gold/90 text-zinc-950 font-semibold py-3.5 px-6 rounded-xl transition-all shadow-gold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
    {...props}
  >
    {loading ? (
      <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
    ) : children}
  </button>
);

const Checkbox = React.forwardRef(({ className, checked, onChange, ...props }, ref) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={() => onChange && onChange(!checked)}
    className={`peer size-4 shrink-0 rounded border border-zinc-700 shadow-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'border-gold bg-gold text-zinc-950' : 'bg-zinc-900 text-transparent hover:border-gold/50'
    } ${className}`}
    {...props}
  >
    <span className="flex items-center justify-center text-current">
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.53547 0.62293C8.88226 0.849446 8.97976 1.3142 8.75325 1.66099L4.5083 8.1599C4.38833 8.34356 4.19397 8.4655 3.9764 8.49358C3.75883 8.52167 3.53987 8.45309 3.3772 8.30591L0.616113 5.80777C0.308959 5.52987 0.285246 5.05559 0.563148 4.74844C0.84105 4.44128 1.31533 4.41757 1.62249 4.69547L3.73256 6.60459L7.49741 0.840706C7.72393 0.493916 8.18868 0.396414 8.53547 0.62293Z"
        />
      </svg>
    </span>
  </button>
));
Checkbox.displayName = 'Checkbox';

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register, signupDriver, api } = useAuth();

  const isRegisterParam = searchParams.get('mode') === 'register' || searchParams.get('mode') === 'driver';
  const [mode, setMode] = useState(isRegisterParam ? 'register' : 'login');
  const [direction, setDirection] = useState(isRegisterParam ? 1 : -1);
  const [isDriver, setIsDriver] = useState(searchParams.get('mode') === 'driver');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleModeChange = (newMode) => {
    if (newMode !== mode) {
      setDirection(newMode === 'register' ? 1 : -1);
      setMode(newMode);
    }
  };

  useEffect(() => {
    try {
      GoogleAuth.initialize({
        clientId: '613545438163-5eo9e0tpustjgotq6u7m7elsas8gkjst.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
    } catch (e) {
      console.warn("GoogleAuth initialization skipped/failed:", e);
    }
  }, []);
  
  const [docs, setDocs] = useState({
    profile_photo: null,
    license: null,
    registration: null
  });
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const [formData, setFormData] = useState({
    name: location.state?.name || '',
    email: '',
    phone: location.state?.phone || '',
    password: '',
    confirmPassword: '',
    vehicle_type: 'car',
    vehicle_model: '',
    vehicle_color: '',
    plate_number: '',
    vehicle_capacity: 4
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDocs(prev => ({ ...prev, [e.target.name]: file }));
      if (e.target.name === 'profile_photo') {
        setProfilePhotoPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleNativeCapture = async (docId) => {
    const hasPermission = await PermissionsService.requestCameraPermission();
    if (!hasPermission) return;

    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });
      
      const response = await fetch(image.webPath);
      const blob = await response.blob();
      const file = new File([blob], `${docId}_capture.${image.format}`, { type: `image/${image.format}` });
      
      setDocs(prev => ({ ...prev, [docId]: file }));
      if (docId === 'profile_photo') {
        setProfilePhotoPreview(URL.createObjectURL(file));
      }
    } catch (error) {
      console.error('Camera capture cancelled or failed:', error);
    }
  };

  const uploadFile = async (file) => {
    const compressed = await compressImage(file, 1200, 0.8);
    const formData = new FormData();
    formData.append("file", compressed);
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!agreedToTerms) {
          toast.error('You must agree to the Terms of Service and Privacy Policy');
          setLoading(false);
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }

        let user;
        if (isDriver) {
          if (!docs.profile_photo) {
            toast.error('Please upload your driver profile photo');
            setLoading(false);
            return;
          }

          setUploadingDocs(true);
          let profilePhotoUrl = "";
          let licenseUrl = "";
          let registrationUrl = "";
          
          if (docs.profile_photo) {
            profilePhotoUrl = await uploadFile(docs.profile_photo);
          }
          if (docs.license) {
            licenseUrl = await uploadFile(docs.license);
          }
          if (docs.registration) {
            registrationUrl = await uploadFile(docs.registration);
          }
          
          user = await signupDriver(formData, {
            vehicle_type: formData.vehicle_type,
            vehicle_model: formData.vehicle_model,
            vehicle_color: formData.vehicle_color,
            plate_number: formData.plate_number,
            vehicle_capacity: parseInt(formData.vehicle_capacity) || 4,
            avatar_url: profilePhotoUrl,
            verification_docs: {
              profile_photo: profilePhotoUrl,
              license: licenseUrl,
              registration: registrationUrl
            }
          });
          setUploadingDocs(false);
          toast.success('Driver account created! Waiting for approval.');
          navigate('/driver');
        } else {
          user = await register(
            formData.name,
            formData.email,
            formData.phone,
            formData.password,
            'student'
          );
          toast.success('Account created successfully!');
          navigate('/dashboard');
        }
      } else {
        const user = await login(formData.email, formData.password);
        toast.success(`Welcome back, ${user.name}!`);

        if (user.role === 'admin' || user.role === 'super_admin') {
          navigate('/admin');
        } else if (user.role === 'driver') {
          navigate('/driver');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      showFriendlyError(error, 'Authentication failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const backendUrl = getBackendUrl();

      const response = await fetch(`${backendUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: credentialResponse.credential }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || 'Google authentication failed');
      }

      localStorage.setItem('token', data.access_token);

      if (data.is_new_user) {
        navigate('/complete-profile', {
          state: {
            name: data.user.name,
            email: data.user.email,
            token: data.access_token,
          }
        });
      } else {
        const role = data.user.role;
        window.location.href = role === 'admin' || role === 'super_admin' ? '/admin'
          : role === 'driver' && !data.driver_profile_complete ? '/driver/register'
          : role === 'driver' ? '/driver' : '/dashboard';
      }

    } catch (error) {
      console.error('Google auth error:', error);
      showFriendlyError(error, 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogleWeb = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (mode === 'register' && !agreedToTerms) {
        toast.error('You must agree to the Terms of Service and Privacy Policy before signing up');
        return;
      }
      setLoading(true);
      try {
        if (tokenResponse.credential) {
          await handleGoogleSuccess({ credential: tokenResponse.credential });
        } else if (tokenResponse.access_token) {
          const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          }).then(res => res.json());

          const backendUrl = getBackendUrl();
          const response = await fetch(`${backendUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: tokenResponse.access_token,
              email: userInfo.email,
              name: userInfo.name,
            }),
          });

          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.detail || 'Google sign-in failed');
          }

          localStorage.setItem('token', data.access_token);
          if (data.is_new_user) {
            navigate('/complete-profile', {
              state: {
                name: data.user.name,
                email: data.user.email,
                token: data.access_token,
              }
            });
          } else {
            const role = data.user.role;
            window.location.href = role === 'admin' || role === 'super_admin' ? '/admin'
              : role === 'driver' && !data.driver_profile_complete ? '/driver/register'
              : role === 'driver' ? '/driver' : '/dashboard';
          }
        }
      } catch (err) {
        console.error('Google web auth error:', err);
        showFriendlyError(err, 'Google sign-in failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      showFriendlyError(null, 'Google sign-in was cancelled or failed.');
      setLoading(false);
    }
  });

  const handleGoogleClick = async () => {
    if (mode === 'register' && !agreedToTerms) {
      toast.error('You must agree to the Terms of Service and Privacy Policy before signing up');
      return;
    }

    if (Capacitor.isNativePlatform()) {
      setLoading(true);
      try {
        await GoogleAuth.signOut();
      } catch (e) {}
      try {
        const response = await GoogleAuth.signIn();
        const idToken = response?.authentication?.idToken || response?.idToken;
        if (idToken) {
          handleGoogleSuccess({ credential: idToken });
        } else {
          throw new Error("No ID token returned by Google");
        }
      } catch (error) {
        console.error('Native Google Auth Error:', error);
        toast.error('Google authentication failed or cancelled');
        setLoading(false);
      }
    } else {
      loginWithGoogleWeb();
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-50 overflow-hidden flex flex-col justify-end">
      {/* Optimized Static Hardware-Accelerated Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[150vw] h-[150vw] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold/15 via-zinc-950/0 to-zinc-950/0 rounded-full blur-2xl transform-gpu" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik02MCAwaDF2NjBoLTF6TTAgNTloNjB2MWgtNnoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIC8+PC9nPjwvc3ZnPg==')] opacity-20" />
      </div>

      {/* Header Area (Visible before sheet) */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Hardware-Accelerated Zero-Flicker Bottom Sheet */}
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 1.85, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        className="relative z-20 w-full md:max-w-md md:mx-auto md:mb-auto md:mt-32 bg-zinc-950 border-t md:border border-zinc-800/80 rounded-t-[2.5rem] md:rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black max-h-[90vh] md:max-h-[85vh] overflow-y-auto transform-gpu"
      >
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 md:hidden" />

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-zinc-100 mb-1">
            {mode === 'login' ? 'Welcome Back' : isDriver ? 'Become a Driver' : 'Create Account'}
          </h2>
          <p className="text-zinc-400 text-sm">
            {mode === 'login'
              ? 'Sign in to continue your journey'
              : isDriver
                ? 'Start earning with Jaey Ride'
                : 'Join the Jaey Ride community'}
          </p>
        </div>

        {/* Mode Toggle Tabs with Sliding Active Pill */}
        <div className="relative flex p-1 bg-zinc-900/80 rounded-xl mb-8 border border-zinc-800/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`relative flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 z-10 ${mode === 'login' ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            {mode === 'login' && (
              <motion.div
                layoutId="activeAuthTabPill"
                className="absolute inset-0 bg-gold rounded-lg shadow-md shadow-gold/20 -z-10"
                transition={{ type: "spring", stiffness: 100, damping: 22, mass: 1 }}
              />
            )}
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`relative flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 z-10 ${mode === 'register' ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            {mode === 'register' && (
              <motion.div
                layoutId="activeAuthTabPill"
                className="absolute inset-0 bg-gold rounded-lg shadow-md shadow-gold/20 -z-10"
                transition={{ type: "spring", stiffness: 100, damping: 22, mass: 1 }}
              />
            )}
            Sign Up
          </button>
        </div>

        {/* Form Container with Clean Non-Overlapping Directional Transitions */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.form 
            key={mode}
            initial={{ opacity: 0, x: mode === 'register' ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'register' ? -24 : 24 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={handleSubmit} 
            className="space-y-4"
          >
            {mode === 'register' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl mb-4 border border-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <Car weight="duotone" className="w-5 h-5 text-gold" />
                    <span className="text-zinc-200 text-sm font-medium">Register as Driver</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDriver(!isDriver)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isDriver ? 'bg-gold' : 'bg-zinc-800'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-zinc-50 absolute top-0.5 transition-all ${isDriver ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="space-y-4 mb-4">
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <GlassInput
                      type="text"
                      name="name"
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-11 !bg-zinc-900/90 !text-white !border-zinc-800 placeholder:!text-zinc-500"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <GlassInput
                      type="tel"
                      name="phone"
                      placeholder="Phone Number"
                      value={formData.phone}
                      onChange={handleChange}
                      className="pl-11 !bg-zinc-900/90 !text-white !border-zinc-800 placeholder:!text-zinc-500"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <GlassInput
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                className="pl-11 !bg-zinc-900/90 !text-white !border-zinc-800 placeholder:!text-zinc-500"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <GlassInput
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="pl-11 pr-11 !bg-zinc-900/90 !text-white !border-zinc-800 placeholder:!text-zinc-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {mode === 'login' && (
              <div className="flex justify-end pt-1 pb-2">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password', { state: { email: formData.email } })}
                  className="text-sm font-medium text-gold hover:text-gold/80 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {mode === 'register' && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <GlassInput
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-11 !bg-zinc-900/90 !text-white !border-zinc-800 placeholder:!text-zinc-500"
                  required
                />
              </div>
            )}

            {mode === 'register' && isDriver && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-4">
                {/* Mandatory Driver Profile Photo Upload */}
                <div className="flex flex-col items-center justify-center pt-2 pb-2">
                  <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2">Driver Profile Photo *</label>
                  <div className="relative group cursor-pointer">
                    <input
                      type="file"
                      name="profile_photo"
                      id="auth_profile_photo_upload"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="auth_profile_photo_upload" className="block relative cursor-pointer">
                      <div className={`w-24 h-24 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all ${profilePhotoPreview ? 'border-gold shadow-lg shadow-gold/20' : 'border-dashed border-zinc-700 bg-zinc-900 hover:border-gold'}`}>
                        {profilePhotoPreview ? (
                          <img src={profilePhotoPreview} alt="Driver Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-zinc-500 hover:text-gold transition-colors">
                            <CameraIcon className="w-7 h-7" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-gold text-zinc-950 flex items-center justify-center shadow-md">
                        <CameraIcon className="w-4 h-4" />
                      </div>
                    </label>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">Clear facial photo for passenger verification</p>
                </div>

                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Vehicle Details</p>

                {/* Vehicle Type Selection (Bicycle removed!) */}
                <div className="grid grid-cols-2 gap-2">
                  {['car', 'motorcycle'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        vehicle_type: type,
                        vehicle_capacity: type === 'motorcycle' ? 1 : 4
                      })}
                      className={`p-3 rounded-xl text-xs font-semibold capitalize transition-all ${formData.vehicle_type === type
                        ? 'bg-gold text-zinc-950 shadow-md shadow-gold/10 font-bold'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Mandatory Vehicle Passenger Capacity Selector */}
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider">Passenger Capacity *</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => setFormData({ ...formData, vehicle_capacity: cap })}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${formData.vehicle_capacity === cap
                          ? 'bg-gold text-zinc-950 shadow-md shadow-gold/10'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {cap} {cap === 1 ? 'Seat' : 'Seats'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <GlassInput
                    type="text"
                    name="vehicle_model"
                    placeholder="Model (e.g. Vitz)"
                    value={formData.vehicle_model}
                    onChange={handleChange}
                    className="!bg-zinc-900/90 !text-white !border-zinc-800 placeholder:!text-zinc-500"
                    required
                  />
                  <GlassInput
                    type="text"
                    name="vehicle_color"
                    placeholder="Color (e.g. White)"
                    value={formData.vehicle_color}
                    onChange={handleChange}
                    className="!bg-zinc-900/90 !text-white !border-zinc-800 placeholder:!text-zinc-500"
                    required
                  />
                </div>

                <GlassInput
                  type="text"
                  name="plate_number"
                  placeholder="Plate Number (e.g. ABA 1234)"
                  value={formData.plate_number}
                  onChange={handleChange}
                  required
                  className="uppercase !bg-zinc-900/90 !text-white !border-zinc-800 placeholder:!text-zinc-500"
                />

                <div className="pt-2">
                  <label className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-3">Documents</label>
                  <div className="space-y-3">
                    {[{ id: 'license', label: "Driver's License" }, { id: 'registration', label: "Vehicle Registration" }].map(doc => (
                      <div key={doc.id} className="relative">
                        {!Capacitor.isNativePlatform() ? (
                          <>
                            <input
                              type="file"
                              name={doc.id}
                              id={`auth_${doc.id}_upload`}
                              accept="image/*"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            <label 
                              htmlFor={`auth_${doc.id}_upload`}
                              className={`flex items-center justify-between p-3.5 rounded-xl border border-dashed cursor-pointer transition-colors ${docs[doc.id] ? 'bg-gold/10 border-gold/50 text-gold' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80'}`}
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5" />
                                <span className="text-sm font-medium">{docs[doc.id] ? docs[doc.id].name : doc.label}</span>
                              </div>
                              {docs[doc.id] ? <CheckCircle2 className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                            </label>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleNativeCapture(doc.id)}
                            className={`w-full flex items-center justify-between p-3.5 rounded-xl border border-dashed cursor-pointer transition-colors ${docs[doc.id] ? 'bg-gold/10 border-gold/50 text-gold' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80'}`}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5" />
                              <span className="text-sm font-medium">{docs[doc.id] ? docs[doc.id].name : doc.label}</span>
                            </div>
                            {docs[doc.id] ? <CheckCircle2 className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {mode === 'register' && (
              <div className="flex items-start gap-2.5 pt-4 pb-1">
                <Checkbox
                  id="auth-terms-checkbox"
                  checked={agreedToTerms}
                  onChange={setAgreedToTerms}
                  className="mt-0.5"
                />
                <label htmlFor="auth-terms-checkbox" className="text-xs text-zinc-400 select-none cursor-pointer leading-relaxed">
                  I agree to the{' '}
                  <a
                    href={getOnlineWebUrl('/terms')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold underline hover:text-gold/80 transition-colors font-semibold"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openExternalUrl('/terms');
                    }}
                  >
                    terms of service
                  </a>
                  {' '}and{' '}
                  <a
                    href={getOnlineWebUrl('/privacy')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold underline hover:text-gold/80 transition-colors font-semibold"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openExternalUrl('/privacy');
                    }}
                  >
                    privacy policy
                  </a>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || uploadingDocs || (mode === 'register' && !agreedToTerms)}
              className="w-full mt-6 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-semibold py-3.5 rounded-xl transition-colors shadow-lg flex justify-center items-center h-[52px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || uploadingDocs ? (
                <div className="flex flex-col items-center">
                  <LoadingSpinner className="!text-zinc-950 mx-auto" />
                </div>
              ) : mode === 'login' ? (
                'Sign In'
              ) : isDriver ? (
                'Create Driver Account'
              ) : (
                'Create Account'
              )}
            </button>

            {/* Divider */}
            <div className="relative py-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-semibold">
                <span className="bg-zinc-950 px-3 text-zinc-600">Or</span>
              </div>
            </div>

            {/* Google Authentication */}
            <div className="flex justify-center flex-col items-center gap-2 pb-8">
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-zinc-900 border border-zinc-800 text-zinc-100 py-3.5 rounded-xl hover:bg-zinc-800 transition-colors font-semibold shadow-sm h-[52px] active:scale-[0.99]"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AuthPage;
