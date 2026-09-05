import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { AndroidRobotIcon } from './AppUpdateModal';
import { getBackendUrl } from '../../utils/urlHelpers';

const detectPlatform = () => {
  if (typeof window === 'undefined') return 'unknown';
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/windows/.test(ua)) return 'windows';
  return 'other';
};

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState('unknown');
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if already installed / standalone
    const standsAlone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || window.Capacitor?.isNativePlatform?.();
    setIsStandalone(!!standsAlone);

    if (standsAlone) return;

    // Check if user dismissed previously
    const isDismissed = localStorage.getItem('mulu_rides_pwa_dismissed');
    if (isDismissed) return;

    const detected = detectPlatform();
    setPlatform(detected);

    if (detected === 'ios' || detected === 'android') {
      setShowPrompt(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleAction = async () => {
    if (platform === 'ios') {
      setShowIOSModal(true);
      return;
    }

    if (platform === 'android') {
      const backendUrl = getBackendUrl();
      const downloadUrl = `${backendUrl}/api/app/download-latest-apk`;
      window.location.href = downloadUrl;
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('mulu_rides_pwa_dismissed', 'true');
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto">
        <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl p-4 flex items-start sm:items-center justify-between gap-4 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0">
              {platform === 'android' ? (
                <AndroidRobotIcon className="w-5 h-5 text-emerald-500" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </div>
            <div>
              <h4 className="font-heading font-semibold text-foreground text-sm">
                {platform === 'android' ? 'Download Android APK' : 'Install Jaey Ride App'}
              </h4>
              <p className="text-muted-foreground text-xs mt-0.5">
                {platform === 'ios' && 'Add to Home Screen for fast booking & live alerts'}
                {platform === 'android' && 'Get the official APK for native speed & alerts'}
                {platform !== 'ios' && platform !== 'android' && 'Install for a faster, full-screen experience'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAction}
              className="bg-gold text-black text-xs font-semibold px-4 py-2 rounded-xl hover:bg-gold/90 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              {platform === 'ios' ? 'How to Add' : platform === 'android' ? 'Download' : 'Install'}
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Step-by-Step Clean Modal (No AI glow, absolute solid colors, theme-aware) */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="bg-card border-border sm:max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground font-heading text-xl">Install on iOS</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add Jaey Ride directly to your home screen on your iPhone or iPad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-muted border border-border">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Share className="w-5 h-5" />
              </div>
              <div className="pt-1">
                <p className="text-foreground text-sm font-semibold">1. Tap the Share button</p>
                <p className="text-muted-foreground text-xs mt-1">Located at the bottom of Safari on iPhone, or top on iPad.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-muted border border-border">
              <div className="w-10 h-10 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0">
                <PlusSquare className="w-5 h-5" />
              </div>
              <div className="pt-1">
                <p className="text-foreground text-sm font-semibold">2. Tap "Add to Home Screen"</p>
                <p className="text-muted-foreground text-xs mt-1">Scroll down the share sheet and tap "Add to Home Screen" 📲</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <button
              onClick={() => setShowIOSModal(false)}
              className="px-6 py-2.5 rounded-xl bg-gold text-black font-semibold hover:bg-gold/90 active:scale-95 transition-all text-sm"
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PWAInstallPrompt;
