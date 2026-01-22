import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Eye, EyeOff, ArrowLeft, Mail, Phone, User, Lock } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();
  
  const [mode, setMode] = useState(searchParams.get('mode') === 'driver' ? 'register' : 'login');
  const [isDriver, setIsDriver] = useState(searchParams.get('mode') === 'driver');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
        
        const user = await register(
          formData.name,
          formData.email,
          formData.phone,
          formData.password,
          'student' // Always register as student first
        );
        
        toast.success('Account created successfully!');
        
        if (isDriver) {
          // Navigate to driver registration with state to indicate flow
          navigate('/driver/register', { state: { fromAuth: true } });
        } else {
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
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4 relative overflow-hidden">
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
        className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors z-20"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold flex items-center justify-center shadow-gold">
            <Car className="w-7 h-7 text-black" />
          </div>
        </div>

        <GlassCard className="p-8" data-testid="auth-card">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-heading text-2xl font-bold text-white mb-2">
              {mode === 'login' ? 'Welcome Back' : isDriver ? 'Become a Driver' : 'Create Account'}
            </h1>
            <p className="text-white/50 text-sm">
              {mode === 'login' 
                ? 'Sign in to continue your journey' 
                : isDriver 
                  ? 'Start earning with MuluRides'
                  : 'Join the MuluRides community'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex p-1 bg-white/5 rounded-xl mb-8">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' 
                  ? 'bg-gold text-black' 
                  : 'text-white/60 hover:text-white'
              }`}
              data-testid="login-tab"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'register' 
                  ? 'bg-gold text-black' 
                  : 'text-white/60 hover:text-white'
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
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl mb-4">
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-gold" />
                    <span className="text-white text-sm">Register as Driver</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDriver(!isDriver)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      isDriver ? 'bg-gold' : 'bg-white/20'
                    }`}
                    data-testid="driver-toggle"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${
                      isDriver ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {/* Name */}
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
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
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
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
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
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
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Confirm Password */}
            {mode === 'register' && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
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

            {/* Submit */}
            <GoldButton
              type="submit"
              className="w-full mt-6"
              disabled={loading}
              data-testid="submit-btn"
            >
              {loading ? (
                <LoadingSpinner size="sm" className="mx-auto" />
              ) : mode === 'login' ? (
                'Sign In'
              ) : isDriver ? (
                'Continue to Driver Setup'
              ) : (
                'Create Account'
              )}
            </GoldButton>
          </form>

          {/* Footer */}
          <p className="text-center text-white/40 text-sm mt-6">
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
