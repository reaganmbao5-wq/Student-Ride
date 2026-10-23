import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, Info, Smartphone, Monitor } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { AndroidRobotIcon } from './AppUpdateModal';
import { PlayStoreAccessModal, GooglePlayIcon, getStoredPlayStoreEmail, checkOrRequestPlayStoreAccess, PLAY_STORE_URL } from './PlayStoreAccessModal';
import { getBackendUrl } from '../../utils/urlHelpers';
import { toast } from 'sonner';

const AppleLogo = () => (
    <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor" className="shrink-0">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.1-44.6-35.9-2.8-74.3 22.7-93.1 22.7-18.9 0-50-22.3-79-22.3-37.4 0-72.2 21.6-91.8 55.7-40 68.6-10.4 171.3 28.5 227.4 19 27.2 41.5 57 71.4 55.7 28.4-1.2 39.8-18.6 74-18.6 34.1 0 44.8 18.6 74.3 18.3 30.6-.3 49.3-26.7 67.8-54 22.8-33.8 32.1-66.5 32.7-68-1.1-.5-50.5-19.1-50.7-87.4zM240 68.5c21.4-25.9 35.8-62.1 31.9-97.5-31 1.2-69 20.6-91.3 47.1-17.8 21.1-34 58.4-29.2 92.9 34.6 2.7 70.3-19.1 88.6-42.5z" />
    </svg>
);

const WindowsLogo = () => (
    <svg viewBox="0 0 448 512" width="20" height="20" fill="currentColor" className="shrink-0">
        <path d="M0 93.6l183.6-25.3v177.4H0V93.6zm203.3-28L448 32v213.7H203.3V65.6zM0 265.4h183.6v177.4L0 417.4V265.4zm203.3 0H448v213.7l-244.7-33.6V265.4z" />
    </svg>
);

const AndroidLogo = () => (
    <svg viewBox="0 0 576 512" width="22" height="22" fill="currentColor" className="shrink-0" style={{ transform: 'translateY(-2px)' }}>
        <path d="M420.22 112.55l36.56-63.35a11.51 11.51 0 0 0-4.22-15.74 11.55 11.55 0 0 0-15.75 4.22l-37.28 64.6c-34.93-15.65-74.2-24.36-115.64-24.36-41.25 0-80.32 8.6-115.15 24.1L131.5 37.66a11.52 11.52 0 0 0-15.73-4.24 11.53 11.53 0 0 0-4.22 15.75l36.42 63.15C59.66 148 0 236 0 339h576c0-103-59.66-191-155.78-226.45zM155 264.44a29 29 0 1 1 29-29 29 29 0 0 1-29 29zm266 0a29 29 0 1 1 29-29 29 29 0 0 1-29 29z" />
    </svg>
);

const detectOS = () => {
    const ua = window.navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
    if (/android/i.test(ua)) return 'Android';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
    if (/Windows/i.test(ua)) return 'Windows';
    return 'Unknown';
};

export const MultiPlatformInstallSection = () => {
    const [os, setOs] = useState('Unknown');
    const [isStandalone, setIsStandalone] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showIOSModal, setShowIOSModal] = useState(false);
    const [showAndroidModal, setShowAndroidModal] = useState(false);

    useEffect(() => {
        setOs(detectOS());

        const standsAlone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        setIsStandalone(standsAlone);

        const handleBeforeInstallPrompt = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    if (isStandalone || window.Capacitor?.isNativePlatform?.()) {
        return null; // Ensure the section completely hides if already installed
    }

    const handleInstallClick = async () => {
        if (os === 'iOS') {
            setShowIOSModal(true);
            return;
        }

        if (os === 'Android') {
            const storedEmail = getStoredPlayStoreEmail();
            if (storedEmail) {
                try {
                    const data = await checkOrRequestPlayStoreAccess(storedEmail);
                    if (data.status === 'synced') {
                        toast.success('Opening Google Play Store...');
                        window.location.href = data.play_store_url || PLAY_STORE_URL;
                        return;
                    }
                } catch (e) {}
            }
            setShowAndroidModal(true);
            return;
        }

        if (!deferredPrompt) {
            alert("App installation is not currently supported or already installed in this browser.");
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            setDeferredPrompt(null);
        }
    };

    const getButtonConfig = () => {
        const isInstallEnabled = !!deferredPrompt;

        switch (os) {
            case 'iOS':
                return {
                    logo: <AppleLogo />,
                    label: 'Install on iOS',
                    enabled: true // Always enabled to show the modal
                };
            case 'macOS':
                return {
                    logo: <AppleLogo />,
                    label: 'Install on macOS',
                    enabled: isInstallEnabled
                };
            case 'Windows':
                return {
                    logo: <WindowsLogo />,
                    label: 'Install on Windows',
                    enabled: isInstallEnabled
                };
            case 'Android':
                return {
                    logo: <GooglePlayIcon className="w-5 h-5" />,
                    label: 'Download from Play Store',
                    enabled: true
                };
            default:
                // Generic fallback for Unknown
                return {
                    logo: <Monitor className="w-5 h-5 shrink-0" />,
                    label: 'Install App',
                    enabled: isInstallEnabled
                };
        }
    };

    const { logo, label, enabled } = getButtonConfig();

    return (
        <div className="p-6 bg-muted border border-border rounded-2xl mb-6 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h3 className="font-heading font-semibold text-foreground text-lg">Download Our App</h3>
                    <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                        Get the full Jaey Ride experience on your home screen for faster booking, real-time tracking, and instant alerts.
                    </p>
                </div>

                <button
                    onClick={handleInstallClick}
                    disabled={!enabled && os !== 'iOS'}
                    className={`shrink-0 inline-flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all duration-300
            ${(enabled || os === 'iOS')
                            ? 'bg-transparent border-2 border-gold text-gold hover:bg-gold hover:text-black shadow-lg hover:shadow-gold/20'
                            : 'bg-muted border-2 border-transparent text-muted-foreground/30 cursor-not-allowed'
                        }`}
                >
                    {logo}
                    <span>{label}</span>
                </button>
            </div>

            {(!enabled && os !== 'iOS' && os !== 'Android' && os !== 'Unknown') && (
                <div className="mt-4 flex items-center gap-2 text-xs text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                    <Info className="w-4 h-4 shrink-0" />
                    <p>Installation is currently unavailable. You may be using an unsupported browser or the app is already installed.</p>
                </div>
            )}

            {/* iOS Manual Installation Instructions Modal */}
            <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
                <DialogContent className="bg-card border-border sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-foreground font-heading text-xl">Install on iOS</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Install Jaey Ride directly to your home screen across iPhone or iPad.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-muted">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                <Share className="w-5 h-5" />
                            </div>
                            <div className="pt-2">
                                <p className="text-foreground text-sm font-medium">1. Tap the Share button</p>
                                <p className="text-muted-foreground text-xs mt-1">Found at the bottom or top of your Safari browser.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-xl bg-muted">
                            <div className="w-10 h-10 rounded-full bg-muted border border-border text-foreground flex items-center justify-center shrink-0">
                                <PlusSquare className="w-5 h-5" />
                            </div>
                            <div className="pt-2">
                                <p className="text-foreground text-sm font-medium">2. Tap "Add to Home Screen"</p>
                                <p className="text-muted-foreground text-xs mt-1">Scroll down the share menu list until you see this option.</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={() => setShowIOSModal(false)}
                            className="px-6 py-2 rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-colors"
                        >
                            Got it
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Android Play Store Access Modal */}
            <PlayStoreAccessModal open={showAndroidModal} onOpenChange={setShowAndroidModal} />
        </div>
    );
};
