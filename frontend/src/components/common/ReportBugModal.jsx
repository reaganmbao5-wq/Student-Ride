import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, X, ChevronDown, Check, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

// localStorage key for persisting shake preference
const SHAKE_ENABLED_KEY = 'student-ride-shake-bug-report';

export const ReportBugModal = () => {
  const { api } = useAuth();

  // Modal visibility
  const [isOpen, setIsOpen] = useState(false);

  // How the modal was triggered — controls screenshot checkbox visibility
  // 'settings' = opened from Profile/Settings (no screenshot checkbox)
  // 'active-ride' = opened from active ride button
  // 'shake' = opened by shaking the phone
  const [triggerSource, setTriggerSource] = useState('settings');

  const [locationData, setLocationData] = useState(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Map & Location Accuracy');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Persisted shake toggle — read from localStorage
  const [shakeEnabled, setShakeEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(SHAKE_ENABLED_KEY);
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });
  const shakeEnabledRef = useRef(shakeEnabled);

  const [allowScreenshot, setAllowScreenshot] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const lastShakeTime = useRef(0);
  const modalContainerRef = useRef(null);
  const isOpenRef = useRef(false);

  const categories = [
    'Map & Location Accuracy',
    'Ride & Driver Acceptance',
    'Fare & Billing',
    'App Performance / Lag',
    'Other Technical Issue'
  ];

  // Keep refs in sync for use inside devicemotion handler (avoids stale closures)
  useEffect(() => { shakeEnabledRef.current = shakeEnabled; }, [shakeEnabled]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Persist shake toggle to localStorage
  const toggleShake = useCallback(() => {
    setShakeEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(SHAKE_ENABLED_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  // Global window custom event listener — opens modal from ANY page
  useEffect(() => {
    const handleOpenEvent = (e) => {
      const detail = e.detail || {};
      setIsOpen(true);
      // Determine trigger source
      if (detail.isFromActiveRide) {
        setTriggerSource('active-ride');
      } else {
        setTriggerSource('settings');
      }
      if (detail.locationData) setLocationData(detail.locationData);
    };

    window.addEventListener('open-bug-report-modal', handleOpenEvent);
    return () => window.removeEventListener('open-bug-report-modal', handleOpenEvent);
  }, []);

  // ─── Accelerometer Shake-to-Report ───
  // Single persistent listener that checks refs for current state.
  // This way the listener doesn't need to be re-added/removed on state changes.
  useEffect(() => {
    if (!window.DeviceMotionEvent) return;

    let lastX = null, lastY = null, lastZ = null;

    // Require a forceful shake — threshold set to 38
    // (sum of absolute deltas across X+Y+Z must exceed 38 in one frame)
    const SHAKE_THRESHOLD = 38;
    // Minimum 4 seconds between shake triggers to prevent rapid-fire
    const COOLDOWN_MS = 4000;

    const handleMotion = (event) => {
      // Check ref (not stale state) — if user disabled shake, bail out
      if (!shakeEnabledRef.current) return;
      // Don't trigger if modal is already open
      if (isOpenRef.current) return;

      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null) return;

      if (lastX !== null) {
        const delta = Math.abs(acc.x - lastX) + Math.abs(acc.y - lastY) + Math.abs(acc.z - lastZ);

        if (delta > SHAKE_THRESHOLD) {
          const now = Date.now();
          if (now - lastShakeTime.current > COOLDOWN_MS) {
            lastShakeTime.current = now;
            toast('Shake detected! Opening Bug Report...', { icon: '📱' });
            setTriggerSource('shake');
            setIsOpen(true);
          }
        }
      }

      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;
    };

    window.addEventListener('devicemotion', handleMotion, true);
    return () => window.removeEventListener('devicemotion', handleMotion, true);
  }, []); // Empty deps — single persistent listener using refs

  const handleClose = () => {
    setIsOpen(false);
    setIsDropdownOpen(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;

    setLoading(true);
    let screenshotBase64 = null;

    // Screenshot Capture Flow — fires whenever checkbox is checked (active-ride OR shake)
    if (allowScreenshot) {
      setIsCapturing(true);
      try {
        // Temporarily hide entire modal overlay so it's NOT in the screenshot
        const overlayEl = document.querySelector('[data-bug-modal-overlay]');
        if (overlayEl) overlayEl.style.display = 'none';
        await new Promise((r) => setTimeout(r, 200));

        // Capture the underlying page/map
        const canvas = await html2canvas(document.body, {
          useCORS: true,
          logging: false,
          allowTaint: true,
          scale: window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio,
        });
        screenshotBase64 = canvas.toDataURL('image/jpeg', 0.55);

        // Restore modal visibility
        if (overlayEl) overlayEl.style.display = '';
      } catch (err) {
        console.warn('Screenshot capture failed:', err);
        // Restore just in case
        const overlayEl = document.querySelector('[data-bug-modal-overlay]');
        if (overlayEl) overlayEl.style.display = '';
      } finally {
        setIsCapturing(false);
      }
    }

    try {
      const deviceInfo = {
        platform: window.Capacitor?.getPlatform() || 'web',
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        triggerSource,
        shakeEnabled,
        screenshot: screenshotBase64
      };

      await api.post('/support/report-bug', {
        category,
        description,
        device_info: deviceInfo,
        location_data: locationData || {}
      });

      setSubmitted(true);
      toast.success('Thank you for reporting! We will get it fixed as soon as possible.');

      setTimeout(() => {
        setSubmitted(false);
        setDescription('');
        setAllowScreenshot(false);
        handleClose();
      }, 1600);
    } catch (error) {
      console.error('Failed to submit bug report:', error);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show screenshot checkbox when NOT opened from settings/profile
  const showScreenshotCheckbox = triggerSource === 'active-ride' || triggerSource === 'shake';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        data-bug-modal-overlay
        className="fixed inset-0 z-[999] flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4"
      >
        {/* Backdrop click dismiss */}
        <div className="absolute inset-0" onClick={handleClose} />

        {/* Bottom Sheet Card */}
        <motion.div
          ref={modalContainerRef}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg bg-[#212121] text-white rounded-t-3xl md:rounded-3xl p-6 shadow-2xl border border-white/10 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        >
          {/* Top Handle */}
          <div className="w-12 h-1 bg-zinc-600 rounded-full self-center" />

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-white">Report bug</h2>
            <button
              onClick={handleClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {submitted ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <CheckCircle className="w-16 h-16 text-emerald-500 animate-bounce" />
              <h3 className="text-lg font-bold text-white">Thank you!</h3>
              <p className="text-sm text-zinc-400">We will get it fixed as soon as possible.</p>
            </div>
          ) : (
            <>
              {/* Native In-App Custom Dropdown */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">CATEGORY</label>

                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full h-12 px-4 bg-[#2A2A2A] border border-white/10 rounded-2xl text-sm font-medium text-white flex items-center justify-between hover:bg-[#323232] transition-colors focus:outline-none"
                >
                  <span className="text-white font-medium">{category}</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-[72px] left-0 right-0 z-50 bg-[#2A2A2A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1.5 space-y-0.5"
                    >
                      {categories.map((cat) => {
                        const isSelected = category === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setCategory(cat);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-sm font-medium flex items-center justify-between transition-colors ${
                              isSelected ? 'bg-white/10 text-white font-semibold' : 'text-zinc-300 hover:bg-white/5'
                            }`}
                          >
                            <span>{cat}</span>
                            {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Input Area */}
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-sm font-semibold text-zinc-200">What happened?</label>
                <div className="relative">
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us about the issue you encountered"
                    className="w-full p-4 bg-[#2A2A2A] border border-white/10 rounded-2xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 resize-none font-medium"
                  />
                  <div className="text-right text-xs text-zinc-500 mt-1">
                    {description.length} / 2000
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-zinc-400">
                Your feedback can be used to improve Student Ride.{' '}
                <span className="underline cursor-pointer hover:text-white">Learn more</span>.
              </p>

              {/* SCREENSHOT CHECKBOX — shown for active-ride AND shake triggers (NON-SETTINGS) */}
              {triggerSource !== 'settings' && (
                <div className="flex items-center gap-3 py-1 bg-[#1A1A1A] p-3 rounded-xl border border-white/5">
                  <input
                    type="checkbox"
                    id="allow-screenshot-checkbox"
                    checked={allowScreenshot}
                    onChange={(e) => setAllowScreenshot(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-gold focus:ring-0 cursor-pointer accent-white"
                  />
                  <label htmlFor="allow-screenshot-checkbox" className="text-xs text-zinc-300 cursor-pointer flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-zinc-400" />
                    Allow app to take a screenshot
                  </label>
                </div>
              )}

              {/* SHAKE PHONE TOGGLE — shown ONLY when opened from Settings/Profile */}
              {triggerSource === 'settings' && (
                <>
                  <div className="h-px bg-white/10 my-0.5" />
                  <div className="flex items-center justify-between py-1">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">Shake phone to report a bug</span>
                      <span className="text-xs text-zinc-400">Toggle off to disable</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleShake}
                      className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                        shakeEnabled ? 'bg-white' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          shakeEnabled ? 'translate-x-6 bg-black' : 'translate-x-0 bg-zinc-400'
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}

              {/* Send Action Button */}
              <button
                onClick={handleSubmit}
                disabled={loading || isCapturing || !description.trim()}
                className="w-full py-4 mt-2 bg-[#3A3A3A] hover:bg-[#4A4A4A] disabled:opacity-40 disabled:hover:bg-[#3A3A3A] text-white font-semibold rounded-2xl text-base transition-colors flex items-center justify-center gap-2"
              >
                {loading || isCapturing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send'}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
