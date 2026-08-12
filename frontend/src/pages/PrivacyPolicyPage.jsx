import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, MapPin, Eye, ShieldCheck, Database, Smartphone, Bell, CheckCircle2 } from 'lucide-react';
import { Shield } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/common/GlassComponents';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#08091A] text-white flex flex-col selection:bg-gold/30 selection:text-gold">
      {/* Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#08091A]/80 backdrop-blur-xl border-b border-white/10 px-4 py-4 md:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-2xl border border-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-gold" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-2">
            <Shield weight="duotone" className="w-5 h-5 text-gold" />
            <span className="font-heading font-bold text-sm text-white tracking-wide">MuluRides Privacy</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 md:px-8 space-y-8">
        {/* Title Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden bg-gradient-to-br from-[#13142D] to-[#0A0B1A] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              <span>Data Protection & Privacy</span>
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              At Mulungushi Rides (MuluRides), we respect your personal privacy. This policy explains what information we collect, how we protect it, and how your data is used to deliver a safe, reliable campus commuting experience.
            </p>
            <p className="text-xs text-emerald-400 font-mono font-medium pt-1">
              Effective Date: August 13, 2026 • Version 2.4
            </p>
          </div>
        </motion.div>

        {/* Detailed Privacy Sections */}
        <div className="space-y-6">
          {/* Section 1 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-gold font-heading font-bold text-lg border-b border-white/10 pb-3">
              <Database className="w-5 h-5 shrink-0" />
              <h2>1. Information We Collect</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>To provide matching and navigation services, MuluRides collects minimal necessary data:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-gold uppercase tracking-wider">Account Data</span>
                  <p className="text-xs text-neutral-400">Full Name, University Email address, Phone Number, and profile avatar.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Location Data (GPS)</span>
                  <p className="text-xs text-neutral-400">Real-time precise location coordinates during active ride requests and navigation.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Trip History</span>
                  <p className="text-xs text-neutral-400">Pickup & dropoff points, trip timestamps, fares, and star ratings given.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Device & App Info</span>
                  <p className="text-xs text-neutral-400">Device model, operating system, and push notification tokens for ride alerts.</p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Section 2 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-emerald-400 font-heading font-bold text-lg border-b border-white/10 pb-3">
              <MapPin className="w-5 h-5 shrink-0" />
              <h2>2. How Location Data Is Used</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                GPS location tracking is essential for matching riders with nearby drivers and providing smooth animated map turn-by-turn guidance:
              </p>
              <ul className="space-y-2 list-disc list-inside text-neutral-400 text-xs md:text-sm pl-2">
                <li><strong className="text-white">Active Trip Guidance:</strong> Your location is shared with your assigned driver or passenger solely while a ride is active.</li>
                <li><strong className="text-white">Background Location (Drivers):</strong> Active drivers broadcast location updates while online to receive nearby pickup requests.</li>
                <li><strong className="text-white">Privacy Control:</strong> Location tracking automatically stops as soon as a trip is completed or when a driver toggles offline. You can disable location permissions anytime in your device settings or Profile page.</li>
              </ul>
            </div>
          </GlassCard>

          {/* Section 3 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-blue-400 font-heading font-bold text-lg border-b border-white/10 pb-3">
              <Eye className="w-5 h-5 shrink-0" />
              <h2>3. Data Sharing & Third-Party Protection</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl space-y-1 text-xs text-blue-200">
                <p className="font-bold uppercase tracking-wider text-blue-400">We Never Sell Your Personal Data</p>
                <p>
                  MuluRides will never sell, rent, or monetize your personal information or travel history to third-party advertisers or data brokers.
                </p>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Information is disclosed only under the following limited conditions: (1) to assigned drivers/students for active trip coordination; (2) to university security or law enforcement in response to emergency safety incidents or legal mandates.
              </p>
            </div>
          </GlassCard>

          {/* Section 4 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-purple-400 font-heading font-bold text-lg border-b border-white/10 pb-3">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <h2>4. Data Storage & Security Measures</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                We implement industry-standard encryption protocols (TLS/HTTPS in transit and encrypted data stores) to safeguard credentials and user records. Access to administrative controls is protected via role-based authentication.
              </p>
            </div>
          </GlassCard>

          {/* Section 5 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-gold font-heading font-bold text-lg border-b border-white/10 pb-3">
              <Smartphone className="w-5 h-5 shrink-0" />
              <h2>5. Your Rights & Account Deletion</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                You retain full control over your personal data:
              </p>
              <ul className="space-y-2 list-disc list-inside text-neutral-400 text-xs md:text-sm pl-2">
                <li><strong className="text-white">Access & Edit:</strong> Update your profile details directly from the Profile Settings tab.</li>
                <li><strong className="text-white">Account Deletion:</strong> You can delete your account and clear stored trip history at any time using the "Delete Account" button on the Profile page.</li>
              </ul>
            </div>
          </GlassCard>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-neutral-500 pt-4 pb-8 space-y-1">
          <p>© 2026 Mulungushi Rides (MuluRides). All rights reserved.</p>
          <p>Mulungushi University • Kabwe, Zambia</p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
