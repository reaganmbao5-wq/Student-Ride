import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, MapPin, Shield, Star, Smartphone, Clock, ChevronRight, Users, Wallet } from 'lucide-react';
import { GlassCard, GoldButton } from '../components/common/GlassComponents';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isDriver, isAdmin } = useAuth();
  const [showInstallBanner, setShowInstallBanner] = useState(true);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (isAdmin) {
        navigate('/admin');
      } else if (isDriver) {
        navigate('/driver');
      } else {
        navigate('/dashboard');
      }
    } else {
      navigate('/auth');
    }
  };

  const features = [
    {
      icon: MapPin,
      title: 'Live Tracking',
      description: 'Track your ride in real-time with GPS precision'
    },
    {
      icon: Shield,
      title: 'Safe & Secure',
      description: 'Verified drivers and secure payment system'
    },
    {
      icon: Clock,
      title: 'Quick Pickup',
      description: 'Average pickup time under 5 minutes on campus'
    },
    {
      icon: Wallet,
      title: 'Affordable',
      description: 'Student-friendly pricing with transparent fares'
    }
  ];

  const stats = [
    { value: '500+', label: 'Students' },
    { value: '50+', label: 'Drivers' },
    { value: '10K+', label: 'Rides' },
    { value: '4.8', label: 'Rating' }
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0B] overflow-hidden">
      {/* Install PWA Banner */}
      {showInstallBanner && (
        <div className="bg-gold/10 border-b border-gold/20 py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-gold" />
            <span className="text-sm text-white/80">Install MuluRides for the best experience</span>
          </div>
          <button 
            onClick={() => setShowInstallBanner(false)}
            className="text-white/40 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8 animate-float">
            <div className="w-16 h-16 rounded-2xl bg-gold flex items-center justify-center shadow-gold">
              <Car className="w-8 h-8 text-black" />
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
            Your Campus Ride,
            <br />
            <span className="text-gold-gradient">One Tap Away</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 font-body">
            The premium ride-hailing platform designed exclusively for Mulungushi University students. 
            Safe, affordable, and always available.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <GoldButton 
              onClick={handleGetStarted}
              className="w-full sm:w-auto text-lg"
              data-testid="get-started-btn"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
              <ChevronRight className="w-5 h-5 ml-2 inline" />
            </GoldButton>
            <GoldButton 
              variant="secondary"
              onClick={() => navigate('/auth?mode=driver')}
              className="w-full sm:w-auto"
              data-testid="become-driver-btn"
            >
              <Car className="w-5 h-5 mr-2 inline" />
              Become a Driver
            </GoldButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {stats.map((stat, idx) => (
              <GlassCard key={idx} hover={false} className="p-4 text-center">
                <div className="text-2xl sm:text-3xl font-heading font-bold text-gold mb-1">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-white/50">{stat.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Choose MuluRides?
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Built for students, by students. Experience transportation like never before.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <GlassCard key={idx} className="p-6 group" data-testid={`feature-card-${idx}`}>
                <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-gold" />
                </div>
                <h3 className="font-heading font-semibold text-white text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Set Location', desc: 'Choose your pickup and destination on the map' },
              { step: '02', title: 'Get Matched', desc: 'We match you with the nearest available driver' },
              { step: '03', title: 'Enjoy Ride', desc: 'Track your driver and enjoy a safe ride' }
            ].map((item, idx) => (
              <div key={idx} className="text-center relative">
                <div className="text-6xl font-heading font-bold text-gold/10 mb-4">
                  {item.step}
                </div>
                <h3 className="font-heading font-semibold text-white text-xl mb-2">
                  {item.title}
                </h3>
                <p className="text-white/50">{item.desc}</p>
                {idx < 2 && (
                  <ChevronRight className="hidden sm:block absolute top-1/2 -right-4 w-8 h-8 text-gold/30 -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Driver CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <GlassCard className="p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-[100px]" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-gold" />
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-4">
                Want to Earn as a Driver?
              </h2>
              <p className="text-white/50 mb-8 max-w-xl mx-auto">
                Join our growing network of drivers. Set your own schedule, earn great commissions, 
                and become part of the MuluRides family.
              </p>
              <GoldButton onClick={() => navigate('/auth?mode=driver')} data-testid="driver-signup-cta">
                Start Earning Today
                <ChevronRight className="w-5 h-5 ml-2 inline" />
              </GoldButton>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center">
                <Car className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-white">MuluRides</h3>
                <p className="text-xs text-white/40">Mulungushi University</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <span>© 2024 MuluRides</span>
              <span>•</span>
              <span>Kabwe, Zambia</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
