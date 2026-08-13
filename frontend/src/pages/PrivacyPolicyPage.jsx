import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage = () => {
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
            Privacy Policy
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Last Updated: August 13, 2026 • Official Data Protection Statement
          </p>
        </div>

        {/* Subsections with Highly Highlighted Titles & Detailed Content */}
        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              1. Commitment to Privacy
            </p>
            <p className="text-zinc-300">
              Mulungushi Rides (MuluRides) is dedicated to protecting your personal privacy. This Privacy Policy details the types of information we collect, how it is processed to deliver safe campus transport, and how your data is secured.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              2. Information We Collect
            </p>
            <p className="text-zinc-300">
              We collect minimal data necessary for operating ride booking and safety tracking:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400 text-xs md:text-sm">
              <li><strong className="text-zinc-200">Account Credentials:</strong> Name, University Email address, Phone Number, and optional profile picture.</li>
              <li><strong className="text-zinc-200">Real-Time Location Data:</strong> Precise GPS coordinates during active ride requests, driver navigation, and trip tracking.</li>
              <li><strong className="text-zinc-200">Trip & Rating Records:</strong> Pickup points, dropoff destinations, trip timestamps, fares, and ratings.</li>
              <li><strong className="text-zinc-200">Device Information:</strong> Operating system, hardware model, and push notification tokens for ride status updates.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              3. Use of Location Data
            </p>
            <p className="text-zinc-300">
              High-accuracy GPS location data is essential for route optimization and safety monitoring:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400 text-xs md:text-sm">
              <li>Location coordinates are shared with your assigned driver or passenger solely during an active trip.</li>
              <li>Location broadcasting automatically terminates once a trip is completed or when a driver goes offline.</li>
              <li>You may manage or revoke location permissions at any time via device settings.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              4. Data Sharing & Third-Party Protection
            </p>
            <p className="text-zinc-300">
              MuluRides strictly prohibits selling, renting, or leasing user data to third-party advertisers. Personal information is disclosed only to matched trip participants for active navigation or to campus security authorities when legally required during safety emergency investigations.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              5. Data Security & Retention
            </p>
            <p className="text-zinc-300">
              We implement industry-standard encryption protocols (HTTPS/TLS in transit and encrypted data storage) to safeguard user credentials and trip history. Data is retained only as long as necessary to fulfill platform operations or legal compliance.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              6. Your Rights & Account Deletion
            </p>
            <p className="text-zinc-300">
              Users possess full rights to view, update, or request complete deletion of their account data. Account deletion can be triggered anytime directly from the Profile Settings tab.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base text-gold font-bold tracking-wide">
              7. Privacy Policy Updates
            </p>
            <p className="text-zinc-300">
              MuluRides reserves the right to update this Privacy Policy. Any changes will be posted on this page with an updated effective date.
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

export default PrivacyPolicyPage;
