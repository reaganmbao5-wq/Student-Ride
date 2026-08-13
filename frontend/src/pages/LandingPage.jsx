import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, MapPin, ShieldCheck, Clock, Wallet, CaretRight, UsersThree, Sun, Moon } from '@phosphor-icons/react';
import { GlassCard, GoldButton } from '../components/common/GlassComponents';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isDriver, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
      icon: ShieldCheck,
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
    <div className="min-h-screen bg-background overflow-hidden transition-colors duration-300">
      {/* Theme Toggle Floating Button */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-foreground transition-all backdrop-blur-sm"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun weight="duotone" className="w-5 h-5" /> : <Moon weight="duotone" className="w-5 h-5" />}
        </button>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <Car weight="duotone" className="w-20 h-20 text-gold" />
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground mb-6 tracking-tight">
            Your Campus Ride,
            <br />
            <span className="text-gold-gradient">One Tap Away</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-body">
            The premium ride-hailing platform designed exclusively for Mulungushi University students.
            Safe, affordable, and always available.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <GoldButton
              onClick={handleGetStarted}
              className="w-full sm:w-auto text-lg flex items-center justify-center"
              data-testid="get-started-btn"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
              <CaretRight weight="bold" className="w-5 h-5 ml-2 inline" />
            </GoldButton>
            <GoldButton
              variant="secondary"
              onClick={() => navigate('/auth?mode=driver')}
              className="w-full sm:w-auto flex items-center justify-center"
              data-testid="become-driver-btn"
            >
              <Car weight="duotone" className="w-5 h-5 mr-2 inline" />
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
                <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>


      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Why Choose Jaey Ride?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built for students, by students. Experience transportation like never before.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <GlassCard key={idx} className="p-6 group" data-testid={`feature-card-${idx}`}>
                <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                  <feature.icon weight="duotone" className="w-6 h-6 text-gold" />
                </div>
                <h3 className="font-heading font-semibold text-foreground text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
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
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-4">
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
                <h3 className="font-heading font-semibold text-foreground text-xl mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground">{item.desc}</p>
                {idx < 2 && (
                  <CaretRight weight="bold" className="hidden sm:block absolute top-1/2 -right-4 w-8 h-8 text-gold/30 -translate-y-1/2" />
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
                <UsersThree weight="duotone" className="w-8 h-8 text-gold" />
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Want to Earn as a Driver?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Join our growing network of drivers. Set your own schedule, earn great commissions,
                and become part of the Jaey Ride family.
              </p>
              <GoldButton onClick={() => navigate('/auth?mode=driver')} className="flex items-center justify-center mx-auto" data-testid="driver-signup-cta">
                Start Earning Today
                <CaretRight weight="bold" className="w-5 h-5 ml-2 inline" />
              </GoldButton>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 bg-[#0B0B0B] text-center text-muted-foreground relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center">
                <Car weight="duotone" className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground">JRide</h3>
                <p className="text-xs text-muted-foreground">Mulungushi University</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>© {new Date().getFullYear()} Jaey Ride</span>
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
