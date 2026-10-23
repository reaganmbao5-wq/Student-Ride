import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { getBackendUrl } from '../../utils/urlHelpers';
import { toast } from 'sonner';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.jaeyride.app';

export const GooglePlayIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
  </svg>
);

export const getStoredPlayStoreEmail = () => {
  try {
    const saved = localStorage.getItem('jride_play_email');
    if (saved && saved.includes('@')) return saved.trim().toLowerCase();
    const userCache = localStorage.getItem('mulu_user_cache');
    if (userCache) {
      const parsed = JSON.parse(userCache);
      if (parsed?.email && parsed.email.includes('@')) {
        return parsed.email.trim().toLowerCase();
      }
    }
  } catch (e) {}
  return '';
};

export const checkOrRequestPlayStoreAccess = async (email, name = '') => {
  const backendUrl = getBackendUrl();
  const res = await fetch(`${backendUrl}/api/play-store/request-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Unable to verify Play Store access');
  }
  return await res.json();
};

export const PlayStoreAccessModal = ({ open, onOpenChange, onContinueInBrowser }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedState, setSubmittedState] = useState(null); // null | 'pending'

  useEffect(() => {
    if (open) {
      const initialEmail = getStoredPlayStoreEmail();
      if (initialEmail) {
        setEmail(initialEmail);
      }
      try {
        const firstName = localStorage.getItem('onboarding_firstname') || '';
        const lastName = localStorage.getItem('onboarding_lastname') || '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) setName(fullName);
      } catch (e) {}
    }
  }, [open]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid Google Play email address.');
      return;
    }

    setLoading(true);
    try {
      const data = await checkOrRequestPlayStoreAccess(cleanEmail, name);
      try {
        localStorage.setItem('jride_play_email', cleanEmail);
      } catch (err) {}

      if (data.status === 'synced') {
        toast.success('Email verified! Opening Google Play Store...');
        onOpenChange(false);
        window.location.href = data.play_store_url || PLAY_STORE_URL;
      } else {
        setSubmittedState('pending');
      }
    } catch (err) {
      toast.error(err.message || 'Could not check Play Store access. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border border-zinc-800 text-white sm:max-w-md rounded-2xl shadow-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <GooglePlayIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-white font-heading text-lg font-bold">
                {submittedState === 'pending' ? 'Added to Play Store Queue' : 'Download from Play Store'}
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs mt-0.5">
                {submittedState === 'pending'
                  ? 'Your Google Play account has been registered for access'
                  : 'Enter your Google Play Gmail to open Jaey Ride on Play Store'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {submittedState === 'pending' ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-200 leading-relaxed space-y-1.5">
                <p>
                  We have added <span className="font-bold text-white font-mono">{email}</span> to our Play Store release whitelist.
                </p>
                <p className="text-zinc-400">
                  Once synced by the admin, tapping <strong className="text-white">Download from Play Store</strong> will take you straight to the official Play Store page.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
              Need a ride right now? You can create your account and book rides immediately right here in your browser.
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  if (onContinueInBrowser) onContinueInBrowser();
                }}
                className="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-black bg-gold hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue in Browser</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSubmittedState(null)}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check a different Gmail address</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Google Play Email Address (Gmail) *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-gold rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5 leading-normal">
                If your email is already active on our Play Store list, you will be redirected to Google Play immediately.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking Play Store Access...</span>
                </>
              ) : (
                <>
                  <GooglePlayIcon className="w-4 h-4" />
                  <span>Continue to Play Store</span>
                </>
              )}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
