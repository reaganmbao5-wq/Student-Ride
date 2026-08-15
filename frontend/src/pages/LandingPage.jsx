import React, { useState, useEffect, useRef } from 'react';
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
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
  },
  exit: (direction) => ({
    x: direction < 0 ? 50 : -50,
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
  const [step, setStep] = useState(() => {
    const saved = parseInt(localStorage.getItem('onboarding_step') || '1', 10);
    return saved >= 1 && saved <= 5 ? saved : 1;
  });
  const [direction, setDirection] = useState(1);

  // Sub-steps for step 4: 'theme' -> 'accent' -> 'map'
  const [customSubStep, setCustomSubStep] = useState(() => {
    return localStorage.getItem('onboarding_substep') || 'theme';
  });

  // Form State with local storage persistence
  const [firstName, setFirstName] = useState(() => localStorage.getItem('onboarding_firstname') || '');
  const [lastName, setLastName] = useState(() => localStorage.getItem('onboarding_lastname') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('onboarding_phone') || '');
  const [showLastNameInput, setShowLastNameInput] = useState(() => localStorage.getItem('onboarding_show_lastname') === 'true');
  const [showPhoneInput, setShowPhoneInput] = useState(() => localStorage.getItem('onboarding_show_phone') === 'true');
  const [gender, setGender] = useState(() => localStorage.getItem('onboarding_gender') || 'male'); // 'male' | 'female'
  const [mapStylePreference, setMapStylePreference] = useState(() => localStorage.getItem('map_theme_mode') || 'auto'); // 'day' | 'night' | 'auto'

  const [googleLoading, setGoogleLoading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef(null);

  // Sync state changes to localStorage
  useEffect(() => {
    localStorage.setItem('onboarding_step', step.toString());
    localStorage.setItem('onboarding_substep', customSubStep);
    localStorage.setItem('onboarding_firstname', firstName);
    localStorage.setItem('onboarding_lastname', lastName);
    localStorage.setItem('onboarding_phone', phone);
    localStorage.setItem('onboarding_show_lastname', showLastNameInput ? 'true' : 'false');
    localStorage.setItem('onboarding_show_phone', showPhoneInput ? 'true' : 'false');
    localStorage.setItem('onboarding_gender', gender);
  }, [step, customSubStep, firstName, lastName, phone, showLastNameInput, showPhoneInput, gender]);

  // Fetch video as Blob URL for instant native Android playback without HTTP 206 Range errors
  useEffect(() => {
    let isMounted = true;
    let objectUrl = null;

    fetch('/assets/videos/Firstpage.mp4')
      .then((res) => {
        if (!res.ok) throw new Error('Video fetch status: ' + res.status);
        return res.blob();
      })
      .then((blob) => {
        if (isMounted && videoRef.current) {
          objectUrl = URL.createObjectURL(blob);
          videoRef.current.src = objectUrl;
          videoRef.current.defaultMuted = true;
          videoRef.current.muted = true;
          videoRef.current.play().then(() => {
            if (isMounted) setVideoLoaded(true);
          }).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn("Video blob load error:", err);
      });

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  // Auto-play / resume video on step 1 mount and remount
  useEffect(() => {
    if (step === 1 && videoRef.current && videoRef.current.src) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Video auto-play warning:", err);
        });
      }
    }
  }, [step]);

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

  // Capacitor Android Hardware Back Button Listener & Browser popstate
  useEffect(() => {
    let backListener = null;
    if (Capacitor.isNativePlatform()) {
      try {
        import('@capacitor/app').then(({ App: CapApp }) => {
          CapApp.addListener('backButton', () => {
            setStep((currStep) => {
              if (currStep > 1) {
                handleBack();
                return currStep;
              } else {
                CapApp.exitApp();
                return currStep;
              }
            }).then((handle) => {
              backListener = handle;
            }).catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
      } catch (e) {
        console.warn("Capacitor backButton error:", e);
      }
    }

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, []);

  const clearOnboardingCache = () => {
    localStorage.removeItem('onboarding_step');
    localStorage.removeItem('onboarding_substep');
    localStorage.removeItem('onboarding_firstname');
    localStorage.removeItem('onboarding_lastname');
    localStorage.removeItem('onboarding_phone');
    localStorage.removeItem('onboarding_show_lastname');
    localStorage.removeItem('onboarding_show_phone');
    localStorage.removeItem('onboarding_gender');
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

      clearOnboardingCache();
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
    <div className="fixed inset-0 w-screen h-screen bg-[#0B0B0E] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* Permanent Background Media (Mounted ONCE, never unmounted across step changes) */}
      <div
        className={`absolute inset-0 w-full h-full overflow-hidden bg-[#0B0B0E] transition-opacity duration-500 pointer-events-none ${
          step === 1 ? 'opacity-100 z-0' : 'opacity-0 -z-10'
        }`}
      >
        {/* Desktop/Tablet Horizontal Static Image */}
        <img
          src="/assets/images/desktop_hero_car.jpg"
          alt="JRide Background"
          className="hidden md:block w-full h-full object-cover"
        />

        {/* Mobile Looping Portrait Video with smooth fade-in */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          className={`block md:hidden w-full h-full object-cover scale-105 pointer-events-none transition-opacity duration-700 ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Frosted Glass Overlay (15% reduced intensity) */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[3.5px] backdrop-filter" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/75" />
      </div>

      {/* Top Header / Back Navigation across all viewports */}
      {step > 1 && (
        <div className="relative z-20 w-full flex items-center justify-between px-6 sm:px-12 md:px-16 lg:px-24 pt-6 pb-2">
          <button
            onClick={handleBack}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white active:scale-95 transition-transform cursor-pointer shadow-lg"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>

          {/* Progress Indicator dots */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {[2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-10 sm:w-16 bg-blue-500' : s < step ? 'w-3 sm:w-4 bg-zinc-600' : 'w-3 sm:w-4 bg-zinc-800'
                }`}
                style={s === step ? { backgroundColor: activeAccentHex } : {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center relative z-10 w-full h-full">
        <AnimatePresence mode="wait" custom={direction}>
          
          {/* ========================================================================= */}
          {/* STEP 1: HERO PAGE (Edge-to-Edge Split Header, Responsive Text & Wide Button) */}
          {/* ========================================================================= */}
          {step === 1 && (
            <motion.div
              key="step-1-hero"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 flex flex-col justify-between w-full h-full z-10"
            >
              {/* Frosted Glass Top Header Bar with 2x thickness and lighter frost */}
              <div className="w-full px-7 sm:px-12 md:px-16 py-6 sm:py-8 md:py-10 flex items-center justify-between bg-white/[0.08] backdrop-blur-2xl border-b border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] z-20">
                {/* Left: JRIDE Text Logo (Larger) */}
                <img
                  src="/assets/images/jride_text_white.png"
                  alt="JRide"
                  className="h-12 sm:h-16 md:h-20 lg:h-24 w-auto object-contain drop-shadow-xl select-none"
                />

                {/* Right: Golden Car Asset Logo (Big, but slightly smaller than JRIDE) */}
                <img
                  src="/assets/images/Jaey-logo.png"
                  alt="Jaey Logo"
                  className="h-10 sm:h-13 md:h-16 lg:h-18 w-auto object-contain drop-shadow-xl select-none"
                />
              </div>

              {/* Bottom Hero Content & Wide Dynamic CTA */}
              <div className="w-full p-6 sm:p-10 md:p-14 lg:p-20 pb-6 sm:pb-10 flex flex-col items-start gap-6">
                <div className="space-y-3 text-left max-w-4xl">
                  <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-medium tracking-tight text-white leading-tight">
                    From Campus <br />
                    To Your Door Step
                  </h1>
                  <p className="text-sm sm:text-lg md:text-xl lg:text-2xl text-zinc-200 leading-relaxed max-w-3xl">
                    The platform that always moves in your hands. Request rides, share seats, and travel comfortably around campus.
                  </p>
                </div>

                <div className="w-full max-w-xl md:max-w-2xl lg:max-w-4xl space-y-4 pt-2">
                  <button
                    onClick={goToNextStep}
                    className="w-full py-4 sm:py-5 md:py-6 px-10 rounded-2xl font-bold text-lg sm:text-xl md:text-2xl text-white shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
                    style={{
                      backgroundColor: activeAccentHex,
                      boxShadow: `0 16px 40px -5px ${activeAccentHex}70`
                    }}
                  >
                    Get Started
                  </button>

                  <p className="text-left sm:text-center text-xs sm:text-sm md:text-base text-zinc-300">
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
          {/* STEP 2: NAME & MANDATORY PHONE INPUT (Fluid Responsive Wide Layout) */}
          {/* ========================================================================= */}
          {step === 2 && (
            <motion.div
              key="step-2-name"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex flex-col justify-between h-full px-6 sm:px-12 md:px-16 pt-4 pb-8"
            >
              <div className="space-y-8 overflow-y-auto pr-1">
                <div>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
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
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 sm:px-8 py-4 sm:py-5 md:py-6 text-lg sm:text-2xl md:text-3xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all mt-2 shadow-inner"
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
                      className="overflow-hidden pt-2"
                    >
                      <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 sm:px-8 py-4 sm:py-5 md:py-6 text-lg sm:text-2xl md:text-3xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all mt-2 shadow-inner"
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
                      className="overflow-hidden pt-2"
                    >
                      <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 sm:px-8 py-4 sm:py-5 md:py-6 text-lg sm:text-2xl md:text-3xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all mt-2 shadow-inner"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Actions (Wide Responsive Button) */}
              <div className="space-y-4 pt-8">
                <button
                  onClick={goToNextStep}
                  disabled={!firstName.trim() || (showLastNameInput && !lastName.trim()) || (showPhoneInput && !phone.trim())}
                  className="w-full py-4 sm:py-5 md:py-6 px-10 rounded-2xl font-bold text-lg sm:text-xl md:text-2xl text-white disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all shadow-2xl cursor-pointer"
                  style={{
                    backgroundColor: activeAccentHex,
                    boxShadow: `0 14px 35px -5px ${activeAccentHex}60`
                  }}
                >
                  Continue
                </button>

                <div className="text-center">
                  <button
                    onClick={() => navigate('/auth?mode=login')}
                    className="text-sm sm:text-base md:text-lg font-medium hover:underline text-zinc-400 hover:text-white transition-colors"
                  >
                    Already have an account? <span className="font-bold underline" style={{ color: activeAccentHex }}>Sign in</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: GENDER SELECTION (Side-by-Side on Desktop, Stacked on Mobile) */}
          {/* ========================================================================= */}
          {step === 3 && (
            <motion.div
              key="step-3-gender"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex flex-col justify-between h-full px-6 sm:px-12 md:px-16 pt-6 pb-8"
            >
              <div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-8">
                  Select your gender
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  {/* Male Card */}
                  <div
                    onClick={() => setGender('male')}
                    className={`p-6 sm:p-8 md:p-10 rounded-3xl border cursor-pointer flex items-center gap-6 transition-all ${
                      gender === 'male'
                        ? 'bg-zinc-800/90 border-blue-500 shadow-2xl shadow-blue-500/20 scale-[1.01]'
                        : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                    }`}
                    style={gender === 'male' ? { borderColor: activeAccentHex } : {}}
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800 flex items-center justify-center text-4xl sm:text-5xl border border-zinc-700">
                      👨
                    </div>
                    <div className="flex-1 font-bold text-2xl sm:text-3xl md:text-4xl text-white">Male</div>
                    {gender === 'male' && (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: activeAccentHex }}>
                        <Check className="w-6 h-6 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Female Card */}
                  <div
                    onClick={() => setGender('female')}
                    className={`p-6 sm:p-8 md:p-10 rounded-3xl border cursor-pointer flex items-center gap-6 transition-all ${
                      gender === 'female'
                        ? 'bg-zinc-800/90 border-blue-500 shadow-2xl shadow-blue-500/20 scale-[1.01]'
                        : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                    }`}
                    style={gender === 'female' ? { borderColor: activeAccentHex } : {}}
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800 flex items-center justify-center text-4xl sm:text-5xl border border-zinc-700">
                      👩
                    </div>
                    <div className="flex-1 font-bold text-2xl sm:text-3xl md:text-4xl text-white">Female</div>
                    {gender === 'female' && (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: activeAccentHex }}>
                        <Check className="w-6 h-6 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Actions (Wide Responsive Button) */}
              <div className="space-y-4 pt-8">
                <button
                  onClick={goToNextStep}
                  className="w-full py-4 sm:py-5 md:py-6 px-10 rounded-2xl font-bold text-lg sm:text-xl md:text-2xl text-white active:scale-[0.98] transition-all shadow-2xl cursor-pointer"
                  style={{
                    backgroundColor: activeAccentHex,
                    boxShadow: `0 14px 35px -5px ${activeAccentHex}60`
                  }}
                >
                  Continue
                </button>

                <div className="text-center">
                  <button
                    onClick={() => navigate('/auth?mode=login')}
                    className="text-sm sm:text-base md:text-lg font-medium hover:underline text-zinc-400 hover:text-white transition-colors"
                  >
                    Already have an account? <span className="font-bold underline" style={{ color: activeAccentHex }}>Sign in</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: EXPERIENCE CUSTOMIZATION (Full-Width Responsive Layout) */}
          {/* ========================================================================= */}
          {step === 4 && (
            <motion.div
              key="step-4-customization"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex flex-col justify-between h-full px-6 sm:px-12 md:px-16 pt-2 pb-6"
            >
              {/* Header */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
                  Now, let's customize your app experience
                </h1>
                <p className="text-xs sm:text-base md:text-lg text-zinc-400">It will only take a minute</p>
              </div>

              {/* Dynamic Center Customization Content */}
              <div className="my-auto py-2 flex flex-col items-center justify-center w-full">
                
                {/* 4A: App Theme Selection with 21st.dev Liquid Gallery */}
                {customSubStep === 'theme' && (
                  <div className="w-full flex justify-center">
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
                    className="space-y-8 w-full"
                  >
                    <p className="text-sm sm:text-lg text-center font-bold uppercase tracking-widest text-zinc-400 mb-4">
                      Choose Your Accent Color
                    </p>

                    <div className="grid grid-cols-4 gap-4 sm:gap-8 max-w-2xl mx-auto">
                      {Object.entries(ACCENT_COLORS).map(([key, item]) => {
                        const isSelected = accentColor === key || (key === 'default' && accentColor === 'blue');
                        return (
                          <button
                            key={key}
                            onClick={() => setAccentColor(key)}
                            className={`flex flex-col items-center gap-3 p-4 sm:p-8 rounded-3xl border transition-all ${
                              isSelected
                                ? 'bg-zinc-800 border-white/60 shadow-2xl scale-105 ring-2 ring-white/30'
                                : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-900'
                            }`}
                          >
                            <div
                              className="w-12 h-12 sm:w-20 sm:h-20 rounded-full shadow-2xl flex items-center justify-center text-white"
                              style={{ backgroundColor: item.hex }}
                            >
                              {isSelected && <Check className="w-7 h-7 sm:w-10 sm:h-10 stroke-[3]" />}
                            </div>
                            <span className="text-xs sm:text-base md:text-lg font-bold text-zinc-300 truncate w-full text-center">
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
                  <div className="w-full flex justify-center">
                    <ImageGallery
                      items={MAP_GALLERY_ITEMS}
                      selectedIndex={currentMapIndex}
                      onSelect={handleMapSelect}
                      accentColor={activeAccentHex}
                    />
                  </div>
                )}

              </div>

              {/* Bottom Actions with Clean "Customize Later" Text (No Stars) */}
              <div className="space-y-4 pt-2">
                <p className="text-center text-xs sm:text-base text-zinc-400 font-medium pb-0.5">
                  You can always customize this later in settings
                </p>

                <button
                  onClick={goToNextStep}
                  className="w-full py-4 sm:py-5 md:py-6 px-10 rounded-2xl font-bold text-lg sm:text-xl md:text-2xl text-white active:scale-[0.98] transition-all shadow-2xl cursor-pointer"
                  style={{
                    backgroundColor: activeAccentHex,
                    boxShadow: `0 14px 35px -5px ${activeAccentHex}60`
                  }}
                >
                  Continue
                </button>

                <div className="text-center">
                  <button
                    onClick={() => navigate('/auth?mode=login')}
                    className="text-sm sm:text-base md:text-lg font-medium hover:underline text-zinc-400 hover:text-white transition-colors"
                  >
                    Already have an account? <span className="font-bold underline" style={{ color: activeAccentHex }}>Sign in</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: SAVE PROGRESS (Huge Logo, Relocated Lower Description) */}
          {/* ========================================================================= */}
          {step === 5 && (
            <motion.div
              key="step-5-save"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex flex-col justify-between h-full px-6 sm:px-12 md:px-16 pt-2 pb-8"
            >
              {/* Big JRide Logo Display with Generous Vertical Spacing */}
              <div className="flex flex-col items-center text-center space-y-6 sm:space-y-8 pt-4 sm:pt-8">
                <img
                  src="/assets/images/jride_text_white.png"
                  alt="JRide Logo"
                  className="h-20 sm:h-28 md:h-36 lg:h-44 xl:h-52 w-auto object-contain drop-shadow-2xl select-none"
                />

                {/* Description with ample breathing space before action buttons */}
                <div className="space-y-3 max-w-2xl pt-2 sm:pt-4">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
                    Save Your Progress
                  </h1>
                  <p className="text-sm sm:text-lg md:text-xl text-zinc-400 leading-relaxed">
                    Create an account to save your setup and access JRide anywhere across campus.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4 pt-4">
                {/* Continue with Google */}
                <button
                  onClick={handleGoogleClick}
                  disabled={googleLoading}
                  className="w-full py-4 sm:py-5 md:py-6 px-10 rounded-2xl bg-white text-zinc-900 font-bold text-base sm:text-xl md:text-2xl flex items-center justify-center gap-4 shadow-2xl active:scale-[0.98] transition-all hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24">
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
                  className="w-full py-4 sm:py-5 md:py-6 px-10 rounded-2xl bg-zinc-900 border border-zinc-800 text-white font-bold text-base sm:text-xl md:text-2xl flex items-center justify-center gap-4 shadow-xl active:scale-[0.98] transition-all hover:bg-zinc-800/80 cursor-pointer"
                >
                  <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-zinc-400" />
                  Continue with Email
                </button>

                {/* Disclaimer with External Links */}
                <p className="text-center text-xs sm:text-sm md:text-base text-zinc-500 pt-2 leading-tight">
                  By continuing you accept the{' '}
                  <span onClick={openTerms} className="text-blue-400 underline cursor-pointer hover:text-blue-300">terms of use</span>
                  {' '}and{' '}
                  <span onClick={openPrivacy} className="text-blue-400 underline cursor-pointer hover:text-blue-300">privacy policy</span>
                </p>

                {/* Sign in redirect */}
                <div className="text-center pt-2">
                  <button
                    onClick={() => navigate('/auth?mode=login')}
                    className="text-sm sm:text-base md:text-lg font-medium hover:underline text-zinc-400 hover:text-white transition-colors"
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
