import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Home, MapPin, Clock, User, Settings, Car, DollarSign, Users, BarChart3, Shield, LogOut, Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Layout = ({ children }) => {
  const { user, isDriver, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const studentNavItems = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/ride', icon: MapPin, label: 'Ride' },
    { to: '/history', icon: Clock, label: 'History' },
    { to: '/profile', icon: User, label: 'Profile' }
  ];

  const driverNavItems = [
    { to: '/driver', icon: Home, label: 'Dashboard' },
    { to: '/driver/earnings', icon: DollarSign, label: 'Earnings' },
    { to: '/driver/history', icon: Clock, label: 'History' },
    { to: '/profile', icon: User, label: 'Profile' }
  ];

  const adminNavItems = [
    { to: '/admin', icon: BarChart3, label: 'Overview' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/drivers', icon: Car, label: 'Drivers' },
    { to: '/admin/rides', icon: MapPin, label: 'Rides' },
    { to: '/admin/destinations', icon: MapPin, label: 'Destinations' },
    { to: '/admin/pricing', icon: DollarSign, label: 'Pricing' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' }
  ];

  const navItems = isAdmin ? adminNavItems : isDriver ? driverNavItems : studentNavItems;

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col bg-[#0B0B0B] border-r border-white/5 z-40">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center">
              <Car className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-white">MuluRides</h1>
              <p className="text-xs text-white/50">Student Transport</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/driver' || item.to === '/admin'}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                isActive
                  ? "bg-gold/10 text-gold"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-5 h-5 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/50 capitalize flex items-center gap-1">
                {user?.role === 'super_admin' && <Shield className="w-3 h-3" />}
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0B0B0B]/80 backdrop-blur-xl border-b border-white/5 z-40 flex items-center justify-between px-4 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
            <Car className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-heading font-bold text-white">MuluRides</h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-white/5"
        >
          {mobileMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute top-16 right-4 w-64 glass-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-white/50 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                  isActive ? "bg-gold/10 text-gold" : "text-white/60"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-400 mt-4"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 mobile-nav z-40 safe-bottom">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/driver' || item.to === '/admin'}
              className={({ isActive }) => cn(
                "flex flex-col items-center py-2 px-4 rounded-xl transition-all",
                isActive ? "text-gold" : "text-white/40"
              )}
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
