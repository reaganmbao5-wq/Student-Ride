import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Home, MapPin, Clock, User, Settings, Car, DollarSign, Users, BarChart3, Shield, LogOut, Menu, X, Sun, Moon, Bug } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { haptics } from '../../utils/haptics';
import { Dock, DockIcon, DockItem, DockLabel } from '../ui/dock';
import { LimelightNav } from '../ui/limelight-nav';

export const Layout = ({ children }) => {
  const { user, isDriver, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
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
    { to: '/admin/bug-reports', icon: Bug, label: 'Bug Reports' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' }
  ];

  const navItems = isAdmin ? adminNavItems : isDriver ? driverNavItems : studentNavItems;

  const limelightNavItems = navItems.map((item) => ({
    id: item.to,
    icon: <item.icon />,
    label: item.label,
    to: item.to,
  }));

  const activeLimelightIndex = limelightNavItems.findIndex((item) => {
    if (item.to === '/dashboard' || item.to === '/driver' || item.to === '/admin') {
      return location.pathname === item.to;
    }
    return location.pathname.startsWith(item.to);
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-20 hover:w-64 flex-col bg-background border-r border-border z-50 sidebar-transition group">
        {/* Logo */}
        <div className="p-4 border-b border-border h-20 flex items-center">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-12 h-12 min-w-[48px] rounded-xl bg-gold flex items-center justify-center">
              <Car className="w-7 h-7 text-black" />
            </div>
            <div className="sidebar-label-transition opacity-0 group-hover:opacity-100 whitespace-nowrap">
              <h1 className="font-heading font-bold text-foreground text-lg">MuluRides</h1>
              <p className="text-[10px] text-muted-foreground">Student Transport</p>
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
                  ? "bg-gold/10 text-gold shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 mb-4 overflow-hidden">
            <div className="w-10 h-10 min-w-[40px] rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="sidebar-label-transition opacity-0 group-hover:opacity-100 flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                {user?.role === 'super_admin' && <Shield className="w-3 h-3 text-gold" />}
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 p-3 w-full rounded-xl text-muted-foreground/60 hover:text-gold hover:bg-gold/10 transition-all overflow-hidden"
            >
              <div className="w-6 flex justify-center">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </div>
              <span className="font-medium sidebar-label-transition opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-3 w-full rounded-xl text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-all overflow-hidden"
            >
              <div className="w-6 flex justify-center">
                <LogOut className="w-5 h-5 min-w-[20px]" />
              </div>
              <span className="font-medium sidebar-label-transition opacity-0 group-hover:opacity-100 whitespace-nowrap">
                Logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-b border-border z-40 flex items-center justify-between px-4 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
            <Car className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-heading font-bold text-foreground">MuluRides</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-gold transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="relative group">
            <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
              <User className="w-4 h-4" />
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl py-2 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all z-[100]">
              <div className="px-4 py-2 border-b border-border mb-1">
                <p className="text-xs font-bold text-foreground truncate">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <NavLink to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                <Settings className="w-4 h-4" />
                Profile
              </NavLink>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:ml-20 pt-16 md:pt-8 pb-32">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          {children}
        </div>
      </main>

      {/* Desktop Apple Dock (Large screens with mouse hover: md:flex) */}
      <nav className="hidden md:block fixed bottom-2 left-1/2 -translate-x-1/2 z-50 max-w-full safe-bottom">
        <Dock className="items-end pb-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/driver' || item.to === '/admin'}
              onClick={() => haptics.tap()}
              className="outline-none"
            >
              {({ isActive }) => (
                <DockItem className={cn(
                  "aspect-square rounded-full transition-colors",
                  isActive ? "bg-gray-300 dark:bg-neutral-700" : "bg-gray-200 dark:bg-neutral-800"
                )}>
                  <DockLabel>{item.label}</DockLabel>
                  <DockIcon>
                    <item.icon className={cn(
                      "h-full w-full",
                      isActive ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-300"
                    )} />
                  </DockIcon>
                </DockItem>
              )}
            </NavLink>
          ))}
        </Dock>
      </nav>

      {/* Mobile & APK Limelight Nav (Mobile & Touch screens: block md:hidden) */}
      <nav className="block md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-50 max-w-full w-fit safe-bottom">
        <LimelightNav
          items={limelightNavItems}
          defaultActiveIndex={activeLimelightIndex >= 0 ? activeLimelightIndex : 0}
          onTabChange={(index) => {
            const target = limelightNavItems[index];
            if (target && target.to) {
              haptics.tap();
              navigate(target.to);
            }
          }}
        />
      </nav>
    </div>
  );
};

export default Layout;
