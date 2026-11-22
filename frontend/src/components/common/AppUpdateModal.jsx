import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpCircle } from 'lucide-react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '../../context/ThemeContext';
import { getBackendUrl } from '../../utils/urlHelpers';
import { GooglePlayIcon, PLAY_STORE_URL } from './PlayStoreAccessModal';

const PLAY_STORE_PACKAGE_ID = 'com.jaeyride.app';

// Android Robot Head SVG
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

// Fallback build metadata (Version 1.0.3, Build 10 matching Google Play Console)
const DEFAULT_APP_VERSION = "1.0.3";
const DEFAULT_BUILD_CODE = 10;

export const openGooglePlayStore = (customUrl) => {
  const targetUrl = customUrl && customUrl.startsWith('http') ? customUrl : PLAY_STORE_URL;

  try {
    // 1. Primary path inside Capacitor Android app: native Android Intent directly into Google Play app
    if (
      typeof window !== 'undefined' &&
      window.JaeyNative &&
      typeof window.JaeyNative.openPlayStore === 'function'
    ) {
      window.JaeyNative.openPlayStore(PLAY_STORE_PACKAGE_ID);
      return;
    }

    // 2. Native WebView fallback: top-level navigation triggers Capacitor BridgeWebViewClient.launchIntent
    if (Capacitor.isNativePlatform()) {
      window.location.href = targetUrl;
      return;
    }

    // 3. Standard web browser fallback
    window.location.href = targetUrl;
  } catch (err) {
    window.location.href = targetUrl;
  }
};

export const AppUpdateModal = () => {
  const { accentColor, ACCENT_COLORS } = useTheme();
  const activeAccentHex = ACCENT_COLORS?.[accentColor]?.hex || '#8B5CF6';

  const [updateInfo, setUpdateInfo] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isOpeningStore, setIsOpeningStore] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      const isNative = Capacitor.isNativePlatform();
      let currentBuildCode = DEFAULT_BUILD_CODE;

      // Dynamically query real native build version from Android OS package
      if (isNative) {
        try {
          const info = await App.getInfo();
          if (info && info.build) {
            currentBuildCode = parseInt(info.build, 10) || currentBuildCode;
          }
        } catch (e) {
          console.warn('[AppUpdateModal] Could not read native App.getInfo():', e);
        }
      }

      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/app/version-check`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();

      const serverVersionCode = Number(data.version_code) || 0;
      const isNewer = serverVersionCode > currentBuildCode;
      const forcePreview = typeof window !== 'undefined' && Boolean(window.__SHOW_UPDATE_MODAL__);

      const isForced = (isNewer || forcePreview) && Boolean(data.force_update);
      const shouldShow = (isNative && isNewer) || forcePreview;

      if (shouldShow) {
        setUpdateInfo({
          ...data,
          force_update: isForced,
        });
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } catch (err) {
      console.warn('App version check failed:', err);
    }
  }, []);

  useEffect(() => {
    checkVersion();

    let stateListener = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          setIsOpeningStore(false);
          checkVersion();
        }
      })
        .then((handle) => {
          stateListener = handle;
        })
        .catch(() => {});
    }

    return () => {
      if (stateListener && typeof stateListener.remove === 'function') {
        stateListener.remove();
      }
    };
  }, [checkVersion]);

  if (!isOpen || !updateInfo) return null;

  const handleUpdate = () => {
    setIsOpeningStore(true);
    openGooglePlayStore(updateInfo.download_url || PLAY_STORE_URL);
    setTimeout(() => setIsOpeningStore(false), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-5">
        {/* Clean Backdrop Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Centered Dialog */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm bg-card text-foreground border border-border rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-5"
        >
          {/* Green Android Robot Icon */}
          <div className="pt-1 flex items-center justify-center">
            <AndroidRobotIcon className="w-16 h-12 drop-shadow-sm" />
          </div>

          {/* Title & Version Pill */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              {updateInfo.force_update ? 'Update Required' : 'New Update Available'}
            </h3>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              <ArrowUpCircle className="w-3.5 h-3.5" style={{ color: activeAccentHex }} />
              <span>Version {updateInfo.latest_version || DEFAULT_APP_VERSION}</span>
            </div>
          </div>

          {/* Clean Readable Release Notes (No input-like bordered box) */}
          <div className="w-full px-1 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              What&apos;s New
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed text-center">
              {updateInfo.release_notes || 'This update includes important stability improvements, bug fixes, and a smoother ride experience.'}
            </p>
          </div>

          {/* Direct Play Store Action Button */}
          <div className="w-full space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isOpeningStore}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-lg cursor-pointer disabled:opacity-75"
              style={{
                backgroundColor: activeAccentHex,
              }}
            >
              <GooglePlayIcon className="w-4 h-4 shrink-0" />
              <span>{isOpeningStore ? 'Opening Google Play...' : 'Update on Google Play'}</span>
            </button>

            {!updateInfo.force_update && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1.5"
              >
                Remind Me Later
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AppUpdateModal;
