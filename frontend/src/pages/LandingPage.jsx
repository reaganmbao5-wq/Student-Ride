import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mail, Check } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleAuth } from '@daniele-rolli/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { ImageGallery } from '../components/common/ImageGallery';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://student-ride-backend-manual.onrender.com';

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
  },
  exit: (direction) => ({
    x: direction < 0 ? 40 : -40,
    opacity: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
  })
};

const THEME_GALLERY_ITEMS = [
  {
    title: "Dark Mode",
    url: "/assets/previews/dark_theme_preview.png",
    mode: "dark"
  },
  {
    title: "Light Mode",
    url: "/assets/previews/light_theme_preview.png",
    mode: "light"
  },
  {
    title: "Auto (System)",
    url: "/assets/previews/dark_theme_preview.png",
    mode: "system"
  }
];

const MAP_GALLERY_ITEMS = [
  {
    title: "Night Map",
    url: "/assets/previews/night_map_preview.png",
    mode: "night"
  },
  {
    title: "Day Map",
    url: "/assets/previews/day_map_preview.png",
    mode: "day"
  },
  {
    title: "Auto Map",
    url: "/assets/previews/night_map_preview.png",
    mode: "auto"
  }
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { theme, themeMode, setThemeMode, accentColor, setAccentColor, ACCENT_COLORS } = useTheme();

  // Navigation state: step 1 (hero), 2 (name & phone), 3 (gender), 4 (customization), 5 (save progress)
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  // Sub-steps for step 4: 'theme' -> 'accent' -> 'map'
  const [customSubStep, setCustomSubStep] = useState('theme');

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [showLastNameInput, setShowLastNameInput] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [gender, setGender] = useState('male'); // 'male' | 'female'
  const [mapStylePreference, setMapStylePreference] = useState('auto'); // 'day' | 'night' | 'auto'

  const [googleLoading, setGoogleLoading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Initialize native Google Auth for Capacitor
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

  // Step Navigation Handlers
  const goToNextStep = () => {
    setDirection(1);
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!firstName.trim()) {
        toast.error('Please enter your first name');
        return;
      }
      if (!showLastNameInput) {
        setShowLastNameInput(true);
        return;
      }
      if (!lastName.trim()) {
        toast.error('Please enter your last name');
        return;
      }
      if (!showPhoneInput) {
        setShowPhoneInput(true);
        return;
      }
      if (!phone.trim()) {
        toast.error('Please enter your phone number');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
      setCustomSubStep('theme');
    } else if (step === 4) {
      if (customSubStep === 'theme') {
        setCustomSubStep('accent');
      } else if (customSubStep === 'accent') {
        setCustomSubStep('map');
      } else if (customSubStep === 'map') {
        localStorage.setItem('map_theme_mode', mapStylePreference);
        setStep(5);
      }
    }
  };

  const handleBack = () => {
    setDirection(-1);
    if (step === 5) {
      setStep(4);
      setCustomSubStep('map');
    } else if (step === 4) {
      if (customSubStep === 'map') {
        setCustomSubStep('accent');
      } else if (customSubStep === 'accent') {
        setCustomSubStep('theme');
      } else if (customSubStep === 'theme') {
        setStep(3);
      }
    } else if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      if (showPhoneInput) {
        setShowPhoneInput(false);
      } else if (showLastNameInput) {
        setShowLastNameInput(false);
      } else {
        setStep(1);
      }
    }
  };

  // Google OAuth Auth Handlers
  const handleGoogleSuccessBackend = async (idToken) => {
    setGoogleLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Google authentication failed');
      }

      localStorage.setItem('token', data.access_token);

      if (data.is_new_user) {
        navigate('/complete-profile', {
          state: {
            name: data.user.name || `${firstName} ${lastName}`.trim(),
            email: data.user.email,
            phone: phone,
            token: data.access_token,
            gender: gender,
            themeMode: themeMode,
            accentColor: accentColor,
            mapThemeMode: mapStylePreference
          }
        });
      } else {
        const role = data.user.role;
        window.location.href = role === 'admin' || role === 'super_admin' ? '/admin'
          : role === 'driver' && !data.driver_profile_complete ? '/driver/register'
          : role === 'driver' ? '/driver' : '/dashboard';
      }
    } catch (err) {
      console.error('Google Auth Error:', err);
      toast.error(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const loginWithGoogleWeb = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (tokenResponse.credential) {
        await handleGoogleSuccessBackend(tokenResponse.credential);
      } else if (tokenResponse.access_token) {
        try {
          const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          }).then(res => res.json());

          navigate('/complete-profile', {
            state: {
              name: userInfo.name || `${firstName} ${lastName}`.trim(),
              email: userInfo.email,
              phone: phone,
              token: tokenResponse.access_token,
              gender: gender,
              themeMode: themeMode,
              accentColor: accentColor,
              mapThemeMode: mapStylePreference
            }
          });
        } catch (e) {
          toast.error("Failed to retrieve Google profile");
        }
      }
    },
    onError: () => toast.error('Google Sign-In was cancelled or failed')
  });

  const handleGoogleClick = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const googleUser = await GoogleAuth.signIn();
        if (googleUser?.authentication?.idToken) {
          await handleGoogleSuccessBackend(googleUser.authentication.idToken);
        }
      } catch (err) {
        console.error("Native Google Auth error:", err);
        toast.error("Native Google sign-in cancelled or failed");
      }
    } else {
      loginWithGoogleWeb();
    }
  };

  // Continue with Email -> Pre-fill standard register form
  const handleEmailClick = () => {
    navigate('/auth?mode=register', {
      state: {
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        phone,
        gender,
        themeMode,
        accentColor,
        mapThemeMode: mapStylePreference
      }
    });
  };

  // Helper for opening terms/privacy without destroying onboarding state
  const openTerms = (e) => {
    e.preventDefault();
    window.open('/terms', '_blank', 'noopener,noreferrer');
  };

  const openPrivacy = (e) => {
    e.preventDefault();
    window.open('/privacy', '_blank', 'noopener,noreferrer');
  };

  // Get active accent hex for custom dynamic button color
  const activeAccentHex = ACCENT_COLORS[accentColor]?.hex || '#3B82F6';

  // Theme Gallery selection helper
  const currentThemeIndex = themeMode === 'dark' ? 0 : themeMode === 'light' ? 1 : 2;
  const handleThemeSelect = (index) => {
    const selected = THEME_GALLERY_ITEMS[index];
    if (selected) setThemeMode(selected.mode);
  };

  // Map Gallery selection helper
  const currentMapIndex = mapStylePreference === 'night' ? 0 : mapStylePreference === 'day' ? 1 : 2;
  const handleMapSelect = (index) => {
    const selected = MAP_GALLERY_ITEMS[index];
    if (selected) setMapStylePreference(selected.mode);
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0B0B0E] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* Top Header / Back Navigation (Visible for steps 2 to 5) */}
      {step > 1 && (
        <div className="relative z-20 w-full max-w-4xl mx-auto flex items-center justify-between px-6 pt-5 pb-2">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Progress Indicator dots */}
          <div className="flex items-center gap-2">
            {[2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-8 bg-blue-500' : s < step ? 'w-2.5 bg-zinc-600' : 'w-2.5 bg-zinc-800'
                }`}
                style={s === step ? { backgroundColor: activeAccentHex } : {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content Carousel */}
      <div className="flex-1 flex flex-col justify-center relative z-10 w-full">
        <AnimatePresence mode="wait" custom={direction}>
          
          {/* ========================================================================= */}
          {/* STEP 1: HERO PAGE (Full-Bleed Desktop Image / Mobile Video + 35% Frost) */}
          {/* ========================================================================= */}
          {step === 1 && (
            <motion.div
              key="step-1-hero"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 flex flex-col justify-between w-full h-full p-6 sm:p-10 md:p-14 z-10"
            >
              {/* Full-Bleed Background Media Container */}
              <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#0B0B0E] -z-10">
                {/* Desktop/Tablet Horizontal Static Image */}
                <img
                  src="/assets/images/desktop_hero_car.jpg"
                  alt="JRide Background"
                  className="hidden md:block w-full h-full object-cover"
                />

                {/* Mobile Looping Portrait Video with no-flash fade-in */}
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  onPlaying={() => setVideoLoaded(true)}
                  className={`block md:hidden w-full h-full object-cover scale-105 transition-opacity duration-500 ${
                    videoLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <source src="/assets/videos/Firstpage.mp4" type="video/mp4" />
                </video>

                {/* 35% Frosted Glass Overlay (Crystal-clear visibility with soft glass blur) */}
                <div className="absolute inset-0 bg-black/35 backdrop-blur-[5px] backdrop-filter" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85" />
              </div>

              {/* Top Branding Section (Moved high up, almost touching top) */}
              <div className="w-full max-w-4xl mx-auto pt-2 sm:pt-4 flex items-center gap-3.5 sm:gap-4">
                <img
                  src="/assets/images/Jaey-logo.png"
                  alt="JRide Logo"
                  className="h-12 sm:h-16 md:h-20 w-auto object-contain drop-shadow-lg"
                />
                <div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-wider text-white leading-tight">
                    JRIDE
                  </h2>
                  <p className="text-[11px] sm:text-xs font-semibold text-zinc-300 uppercase tracking-widest">
                    MULUNGUSHI UNIVERSITY
                  </p>
                </div>
              </div>

              {/* Bottom Content & CTA */}
              <div className="w-full max-w-4xl mx-auto pb-4 sm:pb-8 space-y-6">
                <div className="space-y-3 max-w-xl">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-medium tracking-tight text-white leading-tight">
                    From Campus <br />
                    To Your Door Step
                  </h1>
                  <p className="text-sm sm:text-base md:text-lg text-zinc-200 leading-relaxed">
                    The platform that always moves in your hands. Request rides, share seats, and travel comfortably around campus.
                  </p>
                </div>

                <div className="space-y-3.5 max-w-md">
                  <button
                    onClick={goToNextStep}
                    className="w-full py-4 sm:py-4.5 px-8 rounded-2xl font-bold text-base sm:text-lg text-white shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: activeAccentHex,
                      boxShadow: `0 12px 30px -5px ${activeAccentHex}60`
                    }}
                  >
                    Get Started
                  </button>

                  <p className="text-center text-xs text-zinc-300">
                    By proceeding, you agree to all our{' '}
                    <span onClick={openTerms} className="text-white underline cursor-pointer hover:text-blue-300">terms and conditions</span>
                    {' '}~{' '}
                    <span onClick={openPrivacy} className="text-white underline cursor-pointer hover:text-blue-300">about us</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: NAME & MANDATORY PHONE INPUT (No blue highlight) */}
          {/* ========================================================================= */}
          {step === 2 && (
            <motion.div
              key="step-2-name"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md md:max-w-lg mx-auto flex flex-col justify-between h-full px-6 pt-6 pb-8"
            >
              <div className="space-y-5 overflow-y-auto pr-1">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                    What is your first name?
                  </h1>
                  <input
                    type="text"
                    autoFocus
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') goToNextStep();
                    }}
                    placeholder="Your name"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all mt-2"
                  />
                </div>

                {/* Smooth In-Page Reveal for Last Name */}
                <AnimatePresence>
                  {showLastNameInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: 15 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: 15 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden pt-1"
                    >
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                        What is your last name?
                      </h2>
                      <input
                        type="text"
                        autoFocus
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') goToNextStep();
                        }}
                        placeholder="Your surname"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all mt-2"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Smooth In-Page Reveal for Phone Number */}
                <AnimatePresence>
                  {showPhoneInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: 15 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: 15 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden pt-1"
                    >
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                        What is your phone number?
                      </h2>
                      <input
                        type="tel"
                        autoFocus
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') goToNextStep();
                        }}
                        placeholder="e.g. 0971234567"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all mt-2"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Actions */}
              <div className="space-y-4 pt-6">
                <button
                  onClick={goToNextStep}
                  disabled={!firstName.trim() || (showLastNameInput && !lastName.trim()) || (showPhoneInput && !phone.trim())}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-base text-white disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all shadow-lg"
                  style={{
                    backgroundColor: activeAccentHex,
                    boxShadow: `0 10px 25px -5px ${activeAccentHex}50`
                  }}
                >
                  Continue
                </button>

                <div className="text-center">
                  <button
                    onClick={() => navigate('/auth?mode=login')}
                    className="text-sm font-medium hover:underline text-zinc-400 hover:text-white transition-colors"
                  >
                    Already have an account? <span className="font-bold underline" style={{ color: activeAccentHex }}>Sign in</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: GENDER SELECTION (Male vs Female) */}
          {/* ========================================================================= */}
          {step === 3 && (
            <motion.div
              key="step-3-gender"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md md:max-w-lg mx-auto flex flex-col justify-between h-full px-6 pt-8 pb-8"
            >
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-6">
                  Select your gender
                </h1>

                <div className="space-y-4">
                  {/* Male Card */}
                  <div
                    onClick={() => setGender('male')}
                    className={`p-5 rounded-2xl border cursor-pointer flex items-center gap-4 transition-all ${
                      gender === 'male'
                        ? 'bg-zinc-800/90 border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.01]'
                        : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                    }`}
                    style={gender === 'male' ? { borderColor: activeAccentHex } : {}}
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl border border-zinc-700">
                      👨
                    </div>
                    <div className="flex-1 font-semibold text-lg text-white">Male</div>
                    {gender === 'male' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: activeAccentHex }}>
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Female Card */}
                  <div
                    onClick={() => setGender('female')}
                    className={`p-5 rounded-2xl border cursor-pointer flex items-center gap-4 transition-all ${
                      gender === 'female'
                        ? 'bg-zinc-800/90 border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.01]'
                        : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                    }`}
                    style={gender === 'female' ? { borderColor: activeAccentHex } : {}}
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl border border-zinc-700">
                      👩
                    </div>
                    <div className="flex-1 font-semibold text-lg text-white">Female</div>
                    {gender === 'female' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: activeAccentHex }}>
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="space-y-4 pt-8">
                <button
                  onClick={goToNextStep}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-base text-white active:scale-[0.98] transition-all shadow-lg"
                  style={{
                    backgroundColor: activeAccentHex,
                    boxShadow: `0 10px 25px -5px ${activeAccentHex}50`
                  }}
                >
                  Continue
                </button>

                <div className="text-center">
                  <button
                    onClick={() => navigate('/auth?mode=login')}
                    className="text-sm font-medium hover:underline text-zinc-400 hover:text-white transition-colors"
                  >
                    Already have an account? <span className="font-bold underline" style={{ color: activeAccentHex }}>Sign in</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: EXPERIENCE CUSTOMIZATION WITH 21st.dev GSAP GALLERY */}
          {/* ========================================================================= */}
          {step === 4 && (
            <motion.div
              key="step-4-customization"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md md:max-w-lg mx-auto flex flex-col justify-between h-full px-6 pt-4 pb-6"
            >
              {/* Header */}
              <div className="text-center space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Now, let's customize your app experience
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400">It will only take a minute</p>
              </div>

              {/* Dynamic Center Customization Content */}
              <div className="my-auto py-2 flex flex-col items-center justify-center">
                
                {/* 4A: App Theme Selection with 21st.dev Liquid Gallery */}
                {customSubStep === 'theme' && (
                  <div className="w-full">
                    <ImageGallery
                      items={THEME_GALLERY_ITEMS}
                      selectedIndex={currentThemeIndex}
                      onSelect={handleThemeSelect}
                      accentColor={activeAccentHex}
                    />
                  </div>
                )}

                {/* 4B: Accent Color Picker (Elevated and Padded) */}
                {customSubStep === 'accent' && (
                  <motion.div
                    key="substep-accent"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-4 w-full"
                  >
                    <p className="text-xs text-center font-medium uppercase tracking-widest text-zinc-400 mb-2">
                      Choose Your Accent Color
                    </p>

                    <div className="grid grid-cols-4 gap-3.5 max-w-sm mx-auto">
                      {Object.entries(ACCENT_COLORS).map(([key, item]) => {
                        const isSelected = accentColor === key || (key === 'default' && accentColor === 'blue');
                        return (
                          <button
                            key={key}
                            onClick={() => setAccentColor(key)}
                            className={`flex flex-col items-center gap-2 p-3.5 sm:p-4 rounded-2xl border transition-all ${
                              isSelected
                                ? 'bg-zinc-800 border-white/50 shadow-xl scale-105 ring-2 ring-white/20'
                                : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-900'
                            }`}
                          >
                            <div
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-md flex items-center justify-center text-white"
                              style={{ backgroundColor: item.hex }}
                            >
                              {isSelected && <Check className="w-5 h-5 stroke-[3]" />}
                            </div>
                            <span className="text-[11px] font-semibold text-zinc-300 truncate w-full text-center">
                              {item.label.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 4C: Map Style Selection with 21st.dev Liquid Gallery */}
                {customSubStep === 'map' && (
                  <div className="w-full">
                    <ImageGallery
                      items={MAP_GALLERY_ITEMS}
                      selectedIndex={currentMapIndex}
                      onSelect={handleMapSelect}
                      accentColor={activeAccentHex}
                    />
                  </div>
                )}

              </div>

              {/* Bottom Actions with Relocated "Customize Later" Text */}
              <div className="space-y-3 pt-3">
                <p className="text-center text-xs text-zinc-400 font-medium pb-0.5">
                  ✨ You can always customize this later in settings
                </p>

                <button
                  onClick={goToNextStep}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-base text-white active:scale-[0.98] transition-all shadow-lg"
                  style={{
                    backgroundColor: activeAccentHex,
                    boxShadow: `0 10px 25px -5px ${activeAccentHex}50`
                  }}
                >
                  Continue
                </button>

                <div className="text-center">
                  <button
                    onClick={() => navigate('/auth?mode=login')}
                    className="text-sm font-medium hover:underline text-zinc-400 hover:text-white transition-colors"
                  >
                    Already have an account? <span className="font-bold underline" style={{ color: activeAccentHex }}>Sign in</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: SAVE PROGRESS & REGISTRATION */}
          {/* ========================================================================= */}
          {step === 5 && (
            <motion.div
              key="step-5-save"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md md:max-w-lg mx-auto flex flex-col justify-between h-full px-6 pt-6 pb-8"
            >
              {/* Clean Transparent Logo Display */}
              <div className="flex flex-col items-center text-center space-y-4 pt-2">
                <img
                  src="/assets/images/Jaey-logo.png"
                  alt="JRide Logo"
                  className="h-20 sm:h-24 md:h-28 w-auto object-contain drop-shadow-2xl"
                />

                <div className="space-y-2 max-w-sm">
                  <h1 className="text-3xl font-bold tracking-tight text-white">
                    Save Your Progress
                  </h1>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Create an account to save your setup and access JRide anywhere across campus.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-6">
                {/* Continue with Google */}
                <button
                  onClick={handleGoogleClick}
                  disabled={googleLoading}
                  className="w-full py-4 px-6 rounded-2xl bg-white text-zinc-900 font-bold text-sm flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] transition-all hover:bg-zinc-100 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
                </button>

                {/* Continue with Email */}
                <button
                  onClick={handleEmailClick}
                  className="w-full py-4 px-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all hover:bg-zinc-800/80"
                >
                  <Mail className="w-5 h-5 text-zinc-400" />
                  Continue with Email
                </button>

                {/* Disclaimer with External Links */}
                <p className="text-center text-[11px] text-zinc-500 pt-2 leading-tight">
                  By continuing you accept the{' '}
                  <span onClick={openTerms} className="text-blue-400 underline cursor-pointer hover:text-blue-300">terms of use</span>
                  {' '}and{' '}
                  <span onClick={openPrivacy} className="text-blue-400 underline cursor-pointer hover:text-blue-300">privacy policy</span>
                </p>

                {/* Sign in redirect */}
                <div className="text-center pt-2">
                  <button
                    onClick={() => navigate('/auth?mode=login')}
                    className="text-sm font-medium hover:underline text-zinc-400 hover:text-white transition-colors"
                  >
                    Already have an account? <span className="font-bold underline" style={{ color: activeAccentHex }}>Sign in</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
};

export default LandingPage;
