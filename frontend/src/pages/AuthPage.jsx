import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Eye, EyeOff, ArrowLeft, Mail, Phone, User, Lock, UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, signupDriver, api } = useAuth();

  const [mode, setMode] = useState(searchParams.get('mode') === 'driver' ? 'register' : 'login');
  const [isDriver, setIsDriver] = useState(searchParams.get('mode') === 'driver');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [docs, setDocs] = useState({
    license: null,
    registration: null
  });
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    vehicle_type: 'car',
    vehicle_model: '',
    vehicle_color: '',
    plate_number: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDocs({ ...docs, [e.target.name]: file });
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
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
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }

        let user;
        if (isDriver) {
          setUploadingDocs(true);
          // 1. Upload the documents first
          let licenseUrl = "";
          let registrationUrl = "";
          
          if (docs.license) {
            licenseUrl = await uploadFile(docs.license);
          }
          if (docs.registration) {
            registrationUrl = await uploadFile(docs.registration);
          }
          
          // Unified Driver Signup
          user = await signupDriver(formData, {
            vehicle_type: formData.vehicle_type,
            vehicle_model: formData.vehicle_model,
            vehicle_color: formData.vehicle_color,
            plate_number: formData.plate_number,
            verification_docs: {
              license: licenseUrl,
              registration: registrationUrl
            }
          });
          setUploadingDocs(false);
          toast.success('Driver account created! Waiting for approval.');
          navigate('/driver');
        } else {
          // Normal Student Signup
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

        // Redirect based on role
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
      const detail = error.response?.data?.detail;
      const errorMessage = Array.isArray(detail)
        ? detail.map(e => e.msg).join(', ') // Handle Pydantic validation errors
        : detail || 'Authentication failed. Please check your inputs.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: credentialResponse.credential }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Google authentication failed');
      }

      // Save token using the correct key that AuthContext reads
      localStorage.setItem('token', data.access_token);

      if (data.is_new_user) {
        // New Google user — send to complete-profile page (Uber style)
        navigate('/complete-profile', {
          state: {
            name: data.user.name,
            email: data.user.email,
            token: data.access_token,
          }
        });
      } else {
        // Existing user — redirect straight to their dashboard
        const role = data.user.role;
        // If driver, check if they need registration (profile data exists in data.user usually if backend is thorough)
        // But the safest way is to go to dashboard which now handles the redirect, 
        // OR better: if they are a driver, let them go to /driver and let dashboard handle it.
        window.location.href = role === 'admin' || role === 'super_admin' ? '/admin'
          : role === 'driver' && !data.user.driver_profile_complete ? '/driver/register' // Assuming backend sends driver_profile_complete
          : role === 'driver' ? '/driver' : '/dashboard';
      }

    } catch (error) {
      console.error('Google auth error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-16 pb-8 relative overflow-y-auto transition-colors duration-300">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px]" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(https://images.pexels.com/photos/21431027/pexels-photo-21431027.jpeg)` }}
        />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      <div className="relative z-10 w-full max-w-md my-auto">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold flex items-center justify-center shadow-gold">
            <Car className="w-7 h-7 text-black" />
          </div>
        </div>

        <GlassCard className="p-8" data-testid="auth-card">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
              {mode === 'login' ? 'Welcome Back' : isDriver ? 'Become a Driver' : 'Create Account'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === 'login'
                ? 'Sign in to continue your journey'
                : isDriver
                  ? 'Start earning with MuluRides'
                  : 'Join the MuluRides community'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex p-1 bg-muted rounded-xl mb-8">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'login'
                ? 'bg-gold text-black shadow-lg shadow-gold/20'
                : 'text-muted-foreground hover:text-foreground'
                }`}
              data-testid="login-tab"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'register'
                ? 'bg-gold text-black shadow-lg shadow-gold/20'
                : 'text-muted-foreground hover:text-foreground'
                }`}
              data-testid="register-tab"
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                {/* Driver Toggle */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-xl mb-4">
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-gold" />
                    <span className="text-foreground text-sm">Register as Driver</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDriver(!isDriver)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isDriver ? 'bg-gold' : 'bg-muted-foreground/30'
                      }`}
                    data-testid="driver-toggle"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${isDriver ? 'right-0.5' : 'left-0.5'
                      }`} />
                  </button>
                </div>

                {/* Name */}
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <GlassInput
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleChange}
                    className="pl-12"
                    required
                    data-testid="name-input"
                  />
                </div>

                {/* Phone */}
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <GlassInput
                    type="tel"
                    name="phone"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
                    className="pl-12"
                    required
                    data-testid="phone-input"
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <GlassInput
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                className="pl-12"
                required
                data-testid="email-input"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <GlassInput
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="pl-12 pr-12"
                required
                data-testid="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
              </button>
            </div>

            {mode === 'login' && (
              <div className="flex justify-end mt-1 mb-2">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password', { state: { email: formData.email } })}
                  className="text-sm font-medium text-gold hover:text-gold/80 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Confirm Password */}
            {mode === 'register' && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <GlassInput
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-12"
                  required
                  data-testid="confirm-password-input"
                />
              </div>
            )}

            {/* Vehicle Details (Only for Driver Registration) */}
            {mode === 'register' && isDriver && (
              <div className="space-y-4 pt-4 border-t border-border animate-in slide-in-from-top">
                <p className="text-muted-foreground text-sm font-medium">Vehicle Details</p>

                {/* Vehicle Type */}
                <div className="grid grid-cols-3 gap-2">
                  {['car', 'motorcycle', 'bicycle'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, vehicle_type: type })}
                      className={`p-2 rounded-lg text-xs capitalize transition-all ${formData.vehicle_type === type
                        ? 'bg-gold text-black font-medium shadow-md shadow-gold/10'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Model & Color */}
                <div className="grid grid-cols-2 gap-3">
                  <GlassInput
                    type="text"
                    name="vehicle_model"
                    placeholder="Model"
                    value={formData.vehicle_model}
                    onChange={handleChange}
                    required
                    className="text-sm"
                  />
                  <GlassInput
                    type="text"
                    name="vehicle_color"
                    placeholder="Color"
                    value={formData.vehicle_color}
                    onChange={handleChange}
                    required
                    className="text-sm"
                  />
                </div>

                {/* Plate Number */}
                <GlassInput
                  type="text"
                  name="plate_number"
                  placeholder="Plate Number"
                  value={formData.plate_number}
                  onChange={handleChange}
                  required
                  className="uppercase text-sm"
                />

                {/* KYC Documents */}
                <div className="pt-2 border-t border-border mt-4 mb-2">
                  <label className="block text-sm text-foreground font-medium mb-3">Verification Documents</label>
                  <div className="space-y-3">
                    
                    {/* Driver's License */}
                    <div className="relative">
                      <input
                        type="file"
                        name="license"
                        id="auth_license_upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label 
                        htmlFor="auth_license_upload"
                        className={`flex items-center justify-between p-3 rounded-xl border border-dashed cursor-pointer transition-colors ${docs.license ? 'bg-gold/10 border-gold/50 text-gold' : 'bg-background border-white/10 text-muted-foreground hover:bg-muted/80'}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5" />
                          <span className="text-sm font-medium">{docs.license ? docs.license.name : "Driver's License"}</span>
                        </div>
                        {docs.license ? <CheckCircle2 className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                      </label>
                    </div>

                    {/* Vehicle Registration */}
                    <div className="relative">
                      <input
                        type="file"
                        name="registration"
                        id="auth_registration_upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label 
                        htmlFor="auth_registration_upload"
                        className={`flex items-center justify-between p-3 rounded-xl border border-dashed cursor-pointer transition-colors ${docs.registration ? 'bg-gold/10 border-gold/50 text-gold' : 'bg-background border-white/10 text-muted-foreground hover:bg-muted/80'}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5" />
                          <span className="text-sm font-medium">{docs.registration ? docs.registration.name : "Vehicle Registration"}</span>
                        </div>
                        {docs.registration ? <CheckCircle2 className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                      </label>
                    </div>
                    
                  </div>
                </div>

              </div>
            )}

            <GoldButton
              type="submit"
              className="w-full mt-6"
              disabled={loading || uploadingDocs}
              data-testid="submit-btn"
            >
              {loading || uploadingDocs ? (
                <div className="flex flex-col items-center">
                  <LoadingSpinner size="sm" className="mx-auto" />
                  {uploadingDocs && <span className="text-xs mt-1">Uploading...</span>}
                </div>
              ) : mode === 'login' ? (
                'Sign In'
              ) : isDriver ? (
                'Create Driver Account'
              ) : (
                'Create Account'
              )}
            </GoldButton>

          </form>

          {/* Divider */}
          <div className="relative mt-6 mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google Authentication */}
          <div className="flex justify-center flex-col items-center gap-2">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                toast.error('Google authentication failed');
              }}
              useOneTap={false}
              shape="rect"
              theme="filled_black"
              text="continue_with"
              size="large"
            />
          </div>

          {/* Footer */}
          <p className="text-center text-muted-foreground text-sm mt-6">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-gold hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-gold hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

export default AuthPage;
