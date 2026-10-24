import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getBackendUrl } from '../../utils/urlHelpers';
import { PlayStoreAccessModal, checkOrRequestPlayStoreAccess, getStoredPlayStoreEmail, PLAY_STORE_URL } from './PlayStoreAccessModal';

// Android Robot Head SVG from Screenshot 1
export const AndroidRobotIcon = ({ className = "w-10 h-10", fill = "#3DDC84" }) => (
  <svg
    viewBox="0 0 100 60"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Antennas */}
    <line x1="28" y1="18" x2="16" y2="4" stroke={fill} strokeWidth="5" strokeLinecap="round" />
    <line x1="72" y1="18" x2="84" y2="4" stroke={fill} strokeWidth="5" strokeLinecap="round" />
    {/* Semi-circle head */}
    <path
      d="M 12 55 A 38 38 0 0 1 88 55 Z"
      fill={fill}
    />
    {/* Eyes */}
    <circle cx="34" cy="34" r="4.5" fill="#18181b" />
    <circle cx="66" cy="34" r="4.5" fill="#18181b" />
  </svg>
);

// Fallback build metadata (Version 1.0.0, Build 4 matching Google Play Console)
const DEFAULT_APP_VERSION = "1.0.0";
const DEFAULT_BUILD_CODE = 6;

export const AppUpdateModal = () => {
  const { accentColor, ACCENT_COLORS } = useTheme();
  const { user } = useAuth();
  const activeAccentHex = ACCENT_COLORS?.[accentColor]?.hex || '#8B5CF6';
  
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPlayStoreModal, setShowPlayStoreModal] = useState(false);
  const [playStoreResult, setPlayStoreResult] = useState(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const isNative = Capacitor.isNativePlatform();
        let currentBuildCode = DEFAULT_BUILD_CODE;
        let currentVersionName = DEFAULT_APP_VERSION;

        // Dynamically query real native build version from Android OS package
        if (isNative) {
          try {
            const info = await App.getInfo();
            if (info) {
              if (info.build) currentBuildCode = parseInt(info.build, 10) || currentBuildCode;
              if (info.version) currentVersionName = info.version;
            }
          } catch (e) {
            console.warn('[AppUpdateModal] Could not read native App.getInfo():', e);
          }
        }

        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/app/version-check`);
        if (!res.ok) return;
        const data = await res.json();

        const serverVersionCode = Number(data.version_code) || 0;
        
        // Genuinely newer build available
        const isNewer = serverVersionCode > currentBuildCode;
        
        // Only force update IF an update is actually newer than current installed version
        const isForced = isNewer && Boolean(data.force_update);

        // Never trigger on web unless explicitly testing via window.__SHOW_UPDATE_MODAL__
        const shouldShow = (isNative && isNewer) || (typeof window !== 'undefined' && window.__SHOW_UPDATE_MODAL__);

        if (shouldShow) {
          setUpdateInfo({
            ...data,
            force_update: isForced
          });
          setIsOpen(true);
        }
      } catch (err) {
        console.warn('App version check failed:', err);
      }
    };

    checkVersion();
  }, []);

  if (!isOpen || !updateInfo) return null;

  const handleUpdate = async () => {
    setIsDownloading(true);
    try {
      const userEmail = user?.email || getStoredPlayStoreEmail();
      if (userEmail) {
        const res = await checkOrRequestPlayStoreAccess(userEmail, user?.name || '');
        if (res.status === 'synced') {
          window.open(res.play_store_url || PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
          setIsDownloading(false);
          return;
        }
        setShowPlayStoreModal(true);
        setIsDownloading(false);
        return;
      }
      setShowPlayStoreModal(true);
    } catch (err) {
      window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        {/* Clean Backdrop Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Centered Solid Dialog (Clean Solid Palette, Zero Artificial Glow) */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm bg-card text-foreground border border-border rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4"
        >
          {/* Green Android Robot Icon (Standalone, No Black Box) */}
          <div className="py-1 flex items-center justify-center">
            <AndroidRobotIcon className="w-16 h-12 drop-shadow-sm" />
          </div>

          {/* Title & Version */}
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              {updateInfo.force_update ? 'Update Required' : 'New Update Available'}
            </h3>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-xs font-semibold text-muted-foreground">
              <ArrowUpCircle className="w-3.5 h-3.5" style={{ color: activeAccentHex }} />
              <span>Version {updateInfo.latest_version || '2.1.0'}</span>
            </div>
          </div>

          {/* Release Notes */}
          <p className="text-xs text-muted-foreground leading-relaxed px-2 bg-muted/50 p-3 rounded-2xl border border-border/60 text-left w-full">
            {updateInfo.release_notes || 'This release includes real-time multi-passenger route pooling, live GPS sync, and stability improvements.'}
          </p>

          {/* Action Button */}
          <button
            onClick={handleUpdate}
            disabled={isDownloading}
            className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg cursor-pointer"
            style={{
              backgroundColor: activeAccentHex,
            }}
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>{isDownloading ? 'Opening Play Store...' : 'Update on Play Store'}</span>
          </button>

          {!updateInfo.force_update && (
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
            >
              Remind Me Later
            </button>
          )}
        </motion.div>
      </div>
      <PlayStoreAccessModal
        open={showPlayStoreModal}
        onOpenChange={setShowPlayStoreModal}
      />
    </AnimatePresence>
  );
};

export default AppUpdateModal;
