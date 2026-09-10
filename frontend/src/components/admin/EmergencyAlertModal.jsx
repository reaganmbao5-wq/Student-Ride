import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../context/WebSocketContext';
import { 
  ShieldWarning, Phone, MapPin, NavigationArrow, 
  SpeakerHigh, SpeakerSlash, CheckCircle, ArrowSquareOut 
} from '@phosphor-icons/react';

// Web Audio API Dual-Frequency Emergency Siren Synthesizer
class EmergencySirenSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.intervalId = null;
    this.isPlaying = false;
  }

  start() {
    if (this.isPlaying) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      this.audioCtx = new AudioCtxClass();

      // Master Gain Node
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
      this.gainNode.connect(this.audioCtx.destination);

      // Primary Oscillator
      this.oscillator = this.audioCtx.createOscillator();
      this.oscillator.type = 'sawtooth';
      this.oscillator.frequency.setValueAtTime(650, this.audioCtx.currentTime);
      this.oscillator.connect(this.gainNode);
      this.oscillator.start();
      this.isPlaying = true;

      // Dual-tone sweeping siren: 650Hz to 1150Hz sweep
      let freq = 650;
      let rising = true;
      this.intervalId = setInterval(() => {
        if (!this.audioCtx || !this.oscillator) return;
        if (rising) {
          freq += 70;
          if (freq >= 1150) rising = false;
        } else {
          freq -= 70;
          if (freq <= 650) rising = true;
        }
        try {
          this.oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        } catch (e) {}
      }, 50);
    } catch (err) {
      console.warn('Emergency siren audio initialization notice:', err);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    try {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
        this.audioCtx = null;
      }
    } catch (err) {
      console.warn('Emergency siren cleanup notice:', err);
    }
    this.isPlaying = false;
  }
}

export const EmergencyAlertModal = () => {
  const { emergencyAlert, clearEmergencyAlert } = useWebSocket();
  const [isMuted, setIsMuted] = useState(false);
  const sirenRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sirenRef.current) {
      sirenRef.current = new EmergencySirenSynthesizer();
    }

    if (emergencyAlert && !isMuted) {
      sirenRef.current.start();
      
      // Hardware vibration pulse
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([600, 200, 600, 200, 800]);
        } catch (e) {}
      }
    } else {
      if (sirenRef.current) {
        sirenRef.current.stop();
      }
    }

    return () => {
      if (sirenRef.current) {
        sirenRef.current.stop();
      }
    };
  }, [emergencyAlert, isMuted]);

  if (!emergencyAlert) return null;

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      if (sirenRef.current) sirenRef.current.start();
    } else {
      setIsMuted(true);
      if (sirenRef.current) sirenRef.current.stop();
    }
  };

  const handleDismiss = () => {
    if (sirenRef.current) {
      sirenRef.current.stop();
    }
    clearEmergencyAlert();
  };

  const handleViewRide = () => {
    if (sirenRef.current) {
      sirenRef.current.stop();
    }
    clearEmergencyAlert();
    navigate('/admin/rides');
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Just now';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-neutral-950 border-2 border-red-600 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.5)] overflow-hidden text-white animate-in zoom-in-95 duration-200">
        
        {/* Flashing Alert Header */}
        <div className="bg-red-600/20 border-b border-red-600/40 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center animate-pulse shadow-lg shadow-red-600/50">
              <ShieldWarning size={30} weight="fill" className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] tracking-wider uppercase">
                  Critical SOS
                </span>
                <span className="text-xs text-red-300 font-mono">
                  {formatTimestamp(emergencyAlert.timestamp)}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-red-100">
                Emergency Alert Triggered
              </h2>
            </div>
          </div>

          <button
            onClick={handleMuteToggle}
            className={`p-2.5 rounded-xl border transition-all ${
              isMuted 
                ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white' 
                : 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
            }`}
            title={isMuted ? "Unmute Siren" : "Mute Siren"}
            aria-label={isMuted ? "Unmute Siren" : "Mute Siren"}
          >
            {isMuted ? <SpeakerSlash size={22} weight="bold" /> : <SpeakerHigh size={22} weight="bold" className="animate-bounce" />}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          
          {/* Passenger Details Card */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Passenger In Distress</p>
              <h3 className="text-lg font-bold text-white mt-0.5">{emergencyAlert.student_name || 'Student Passenger'}</h3>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">Phone: {emergencyAlert.student_phone || 'Not provided'}</p>
            </div>
            {emergencyAlert.student_phone && (
              <a
                href={`tel:${emergencyAlert.student_phone}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Phone size={18} weight="fill" />
                <span>Call Now</span>
              </a>
            )}
          </div>

          {/* Route & Locations */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <MapPin size={20} weight="fill" className="text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Pickup</span>
                <p className="text-sm font-medium text-neutral-200">{emergencyAlert.pickup_location || 'Campus Location'}</p>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-2 flex items-start gap-3">
              <NavigationArrow size={20} weight="fill" className="text-blue-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Destination</span>
                <p className="text-sm font-medium text-neutral-200">{emergencyAlert.dropoff_location || 'Campus Destination'}</p>
              </div>
            </div>

            {emergencyAlert.location && (
              <div className="border-t border-neutral-800 pt-2 flex items-start gap-3">
                <MapPin size={20} weight="duotone" className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Reported Incident Location</span>
                  <p className="text-sm font-medium text-amber-200">{emergencyAlert.location}</p>
                </div>
              </div>
            )}
          </div>

          {/* Alert Message */}
          <div className="bg-red-950/40 border border-red-900/50 rounded-2xl p-3.5">
            <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">Reported Reason / Note</p>
            <p className="text-sm text-red-100 font-medium mt-1">
              "{emergencyAlert.message || 'Passenger activated emergency beacon from within ride.'}"
            </p>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-neutral-900/50 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            onClick={handleViewRide}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-sm transition-all active:scale-95"
          >
            <ArrowSquareOut size={18} weight="bold" />
            <span>Open Ride Monitor</span>
          </button>

          <button
            onClick={handleDismiss}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/40 transition-all active:scale-95"
          >
            <CheckCircle size={18} weight="bold" />
            <span>Acknowledge & Close</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default EmergencyAlertModal;
