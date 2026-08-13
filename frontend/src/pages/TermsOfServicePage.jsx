import React from 'react';
import { useNavigate } from 'react-router-dom';

const TermsOfServicePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#08091A] text-zinc-100 flex flex-col selection:bg-gold/30 selection:text-gold">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 bg-[#08091A]/90 backdrop-blur-xl border-b border-zinc-800/80 px-4 py-4 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-xs font-semibold text-zinc-300 hover:text-white transition-colors bg-zinc-900 hover:bg-zinc-800 px-3.5 py-2 rounded-xl border border-zinc-800 cursor-pointer"
          >
            ← Back to App
          </button>
          
          <span className="font-heading font-bold text-xs uppercase tracking-widest text-gold">
            Mulungushi Rides
          </span>
        </div>
      </header>

      {/* Main Document Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 md:px-8 space-y-8">
        {/* Big Header */}
        <div className="border-b border-zinc-800/80 pb-6 space-y-2">
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Last Updated: August 13, 2026 • Official Platform Agreement
          </p>
        </div>

        {/* Subsections with Highly Highlighted Titles & Detailed Content */}
        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              1. Acceptance of Terms
            </p>
            <p className="text-zinc-300">
              By accessing, registering, or using the Mulungushi Rides (MuluRides) web application or mobile platform, users explicitly agree to comply with and be bound by these Terms of Service. If you do not agree with any part of these terms, you must immediately discontinue using the application.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              2. Platform Overview & User Eligibility
            </p>
            <p className="text-zinc-300">
              MuluRides provides a digital ride-matching platform connecting students, staff, and drivers within Mulungushi University (Great North Road Campus, Town Campus, and Kabwe metropolitan areas).
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400 text-xs md:text-sm">
              <li>Student accounts require active enrollment or authorized campus affiliate status.</li>
              <li>Drivers must hold a valid Zambian driver's license, vehicle fitness certification, and clear security verification.</li>
              <li>Users must be at least 18 years old or legal students authorized by the university.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              3. User Account Responsibilities
            </p>
            <p className="text-zinc-300">
              Users are solely responsible for maintaining the confidentiality of their account credentials, passwords, and phone verification access. All activities occurring under a user's account remain the legal responsibility of the account holder. Users must notify MuluRides administrators immediately if unauthorized account access is suspected.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              4. Ride Booking, Fares & Payment Terms
            </p>
            <p className="text-zinc-300">
              MuluRides supports both Private (direct) and Shared (pooled) ride options with clear upfront fare estimations.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400 text-xs md:text-sm">
              <li>Fares are calculated based on travel distance (KM), ride mode, and campus zone pricing.</li>
              <li>Payments are settled directly between passenger and driver via Cash or Mobile Money upon arrival at destination.</li>
              <li>Repeated unexcused cancellations after driver assignment may lead to temporary booking restrictions.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              5. Safety, Code of Conduct & Zero Tolerance Policy
            </p>
            <p className="text-zinc-300">
              Safety is paramount across all campus commutes. MuluRides maintains a strict zero-tolerance policy regarding harassment, physical or verbal abuse, intoxication, possession of illegal substances, weapons, or reckless driving. Violations result in immediate permanent account suspension and reporting to campus security.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              6. Limitation of Liability
            </p>
            <p className="text-zinc-300">
              MuluRides acts as an intermediary technology platform connecting independent drivers and passengers. MuluRides shall not be held liable for indirect, incidental, or consequential damages, personal property loss, or unexpected travel delays outside reasonable platform control.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              7. Modifications to Terms
            </p>
            <p className="text-zinc-300">
              MuluRides reserves the right to modify or update these Terms of Service at any time. Continued use of the platform following published changes constitutes full acceptance of the updated terms.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              8. Account Termination
            </p>
            <p className="text-zinc-300">
              MuluRides administration reserves the right to suspend or terminate user accounts without prior notice for violations of these guidelines, security breaches, or fraudulent behavior.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              9. Contact Information
            </p>
            <p className="text-zinc-300">
              For questions regarding these terms, contact MuluRides Support at <span className="text-gold font-mono">support@mulurides.app</span> or visit the Student Center, Mulungushi University Great North Road Campus, Kabwe, Zambia.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800/80 pt-6 text-center text-xs text-zinc-500">
          <p>© 2026 Mulungushi Rides (MuluRides). All rights reserved.</p>
        </div>
      </main>
    </div>
  );
};

export default TermsOfServicePage;
