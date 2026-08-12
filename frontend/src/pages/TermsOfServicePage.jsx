import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, Scale, UserCheck, AlertTriangle, HelpCircle, CheckCircle2 } from 'lucide-react';
import { Shield } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/common/GlassComponents';

const TermsOfServicePage = () => {
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
            <span className="font-heading font-bold text-sm text-white tracking-wide">MuluRides Terms</span>
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
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-bold uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>Official Legal Agreement</span>
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Terms of Service
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Welcome to Mulungushi Rides (MuluRides). Please read these terms carefully before using our campus transport platform. By creating an account or booking a ride, you agree to be legally bound by these terms.
            </p>
            <p className="text-xs text-gold font-mono font-medium pt-1">
              Effective Date: August 13, 2026 • Version 2.4
            </p>
          </div>
        </motion.div>

        {/* Accordion / Detailed Sections Grid */}
        <div className="space-y-6">
          {/* Section 1 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-gold font-heading font-bold text-lg border-b border-white/10 pb-3">
              <UserCheck className="w-5 h-5 shrink-0" />
              <h2>1. Platform Overview & Eligibility</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                Mulungushi Rides (MuluRides) provides a digital technology platform that connects students, staff, and authorized campus community members with registered drivers for point-to-point transportation around Mulungushi University campuses (Great North Road Campus, Town Campus, and surrounding Kabwe metropolitan areas).
              </p>
              <ul className="space-y-2 list-disc list-inside text-neutral-400 text-xs md:text-sm pl-2">
                <li>You must be at least 18 years old or possess legal student status at Mulungushi University to register a student account.</li>
                <li>Drivers must possess a valid Zambian driver's license, vehicle roadworthiness certification, and pass university security verification.</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials and all activities occurring under your login.</li>
              </ul>
            </div>
          </GlassCard>

          {/* Section 2 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-gold font-heading font-bold text-lg border-b border-white/10 pb-3">
              <Scale className="w-5 h-5 shrink-0" />
              <h2>2. Ride Booking, Modes & Fares</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                MuluRides offers flexible travel modes to suit campus commuting needs:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Private Rides</span>
                  <p className="text-xs text-neutral-400">Direct, exclusive transport for single passenger bookings with priority routing.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Shared Rides (Pool)</span>
                  <p className="text-xs text-neutral-400">Cost-effective shared rides along matching campus corridors with discounted per-seat fares.</p>
                </div>
              </div>
              <ul className="space-y-2 list-disc list-inside text-neutral-400 text-xs md:text-sm pl-2 pt-2">
                <li><strong className="text-white">Fare Calculations:</strong> Fares are computed transparently based on distance (KM), trip type, and campus zone rates before ride confirmation.</li>
                <li><strong className="text-white">Payment Methods:</strong> Payments are settled directly between passenger and driver via Cash or Mobile Money upon arrival at destination.</li>
                <li><strong className="text-white">Cancellations:</strong> Frequent unexcused trip cancellations after driver acceptance may result in temporary booking cooldowns.</li>
              </ul>
            </div>
          </GlassCard>

          {/* Section 3 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-emerald-400 font-heading font-bold text-lg border-b border-white/10 pb-3">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <h2>3. Safety & Code of Conduct</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                Safety is our highest priority. All platform participants must adhere to strict campus conduct standards:
              </p>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl space-y-2 text-xs text-emerald-200">
                <p className="font-bold uppercase tracking-wider text-emerald-400">Zero Tolerance Policy</p>
                <p>
                  MuluRides strictly prohibits verbal abuse, sexual harassment, intoxication, possession of illegal substances, weapons, or dangerous driving. Violation results in immediate permanent account termination and campus security reporting.
                </p>
              </div>
              <ul className="space-y-2 list-disc list-inside text-neutral-400 text-xs md:text-sm pl-2">
                <li>Passengers must respect driver vehicles and campus traffic regulations.</li>
                <li>Drivers must inspect vehicle safety features daily and operate within speed limits.</li>
                <li>An integrated 24/7 Safety Bug & Incident reporting tool is accessible directly from the app interface.</li>
              </ul>
            </div>
          </GlassCard>

          {/* Section 4 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-gold font-heading font-bold text-lg border-b border-white/10 pb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2>4. Limitation of Liability</h2>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                MuluRides serves as a software connecting platform. Drivers are independent providers and not employees of MuluRides. While we rigorously vet drivers and monitor live trips via GPS tracking, MuluRides is not liable for indirect damages, lost personal items, or unexpected traffic delays beyond reasonable control.
              </p>
            </div>
          </GlassCard>

          {/* Section 5 */}
          <GlassCard className="p-6 md:p-8 border-white/10 space-y-4" hover={false}>
            <div className="flex items-center gap-3 text-blue-400 font-heading font-bold text-lg border-b border-white/10 pb-3">
              <HelpCircle className="w-5 h-5 shrink-0" />
              <h2>5. Contact & Support</h2>
            </div>
            <div className="space-y-2 text-sm text-neutral-300 leading-relaxed">
              <p>For legal inquiries, dispute resolution, or policy questions, please contact:</p>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-xs text-neutral-300 space-y-1 font-mono">
                <p><span className="text-gold font-bold">Email:</span> support@mulurides.app</p>
                <p><span className="text-gold font-bold">Campus Office:</span> Student Center, Mulungushi University Great North Road Campus, Kabwe</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-neutral-500 pt-4 pb-8 space-y-1">
          <p>© 2026 Mulungushi Rides (MuluRides). All rights reserved.</p>
          <p>Designed for Mulungushi University Students & Campus Drivers.</p>
        </div>
      </main>
    </div>
  );
};

export default TermsOfServicePage;
