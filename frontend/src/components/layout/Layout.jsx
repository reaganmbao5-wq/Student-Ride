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
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-20 hover:w-64 flex-col bg-[#0B0B0B] border-r border-white/5 z-50 sidebar-transition group">
        {/* Logo */}
        <div className="p-4 border-b border-white/5 h-20 flex items-center">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-12 h-12 min-w-[48px] rounded-xl bg-gold flex items-center justify-center">
              <Car className="w-7 h-7 text-black" />
            </div>
            <div className="sidebar-label-transition opacity-0 group-hover:opacity-100 whitespace-nowrap">
              <h1 className="font-heading font-bold text-white text-lg">MuluRides</h1>
              <p className="text-[10px] text-white/50">Student Transport</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-3 space-y-2 overflow-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/driver' || item.to === '/admin'}
              className={({ isActive }) => cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all",
                isActive
                  ? "bg-gold/10 text-gold"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <div className="w-6 flex justify-center">
                <item.icon className="w-5 h-5 min-w-[20px]" />
              </div>
              <span className="font-medium sidebar-label-transition opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4 overflow-hidden">
            <div className="w-10 h-10 min-w-[40px] rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-5 h-5 text-white/60" />
            </div>
            <div className="sidebar-label-transition opacity-0 group-hover:opacity-100 flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/50 capitalize flex items-center gap-1">
                {user?.role === 'super_admin' && <Shield className="w-3 h-3" />}
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 w-full rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all overflow-hidden"
          >
            <div className="w-6 flex justify-center">
              <LogOut className="w-5 h-5 min-w-[20px]" />
            </div>
            <span className="font-medium sidebar-label-transition opacity-0 group-hover:opacity-100 whitespace-nowrap">
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Header (Hidden as per modern PWA designs, but keeping it minimal or removing as sidebar is hidden) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0B0B0B]/80 backdrop-blur-xl border-b border-white/5 z-40 flex items-center justify-between px-4 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
            <Car className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-heading font-bold text-white">MuluRides</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <User className="w-4 h-4 text-white/60" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:ml-20 pt-16 md:pt-8 pb-32">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          {children}
        </div>
      </main>

      {/* Liquid Glass Navigation Bar */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg safe-bottom">
        <div className="liquid-glass rounded-[2rem] p-2 flex items-center justify-around gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/driver' || item.to === '/admin'}
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300 relative",
                isActive ? "liquid-item-active text-gold scale-105" : "text-white/40 hover:text-white/70"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
                  {isActive && (
                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-gold" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
