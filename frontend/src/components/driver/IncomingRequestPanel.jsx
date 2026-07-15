import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Clock, User, Check, X, ShieldAlert } from 'lucide-react';
import { GlassCard } from '../common/GlassComponents';

export const IncomingRequestPanel = ({ request, onAccept, onReject, seatsLeft }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse after 10 seconds
  useEffect(() => {
    if (!request) return;
    
    setIsCollapsed(false); // Reset on new request
    
    const timer = setTimeout(() => {
      setIsCollapsed(true);
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [request?.id]);

  if (!request) return null;

  // The collapsed mini-view
  if (isCollapsed) {
    return (
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -100, opacity: 0 }}
        className="fixed left-0 top-1/3 z-50 cursor-pointer"
        onClick={() => setIsCollapsed(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="bg-primary/90 backdrop-blur-md text-primary-foreground p-3 rounded-r-2xl shadow-2xl border border-white/20 flex flex-col items-center gap-2">
          <div className="relative">
            <User size={24} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
          </div>
          <span className="text-xs font-bold tracking-wider uppercase">New<br/>Ride</span>
        </div>
      </motion.div>
    );
  }

  // The expanded full view
  return (
    <AnimatePresence>
      <motion.div
        key="expanded-panel"
        initial={{ x: '-100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '-100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="fixed inset-y-0 left-0 z-50 w-full sm:w-[400px] p-4 flex items-center justify-center pointer-events-none"
      >
        <div className="pointer-events-auto w-full">
          <GlassCard className="p-6 bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl relative overflow-hidden">
            
            {/* Background glowing orb */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-heading font-black text-white">New Request</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                      {request.ride_mode === 'shared' ? 'Shared' : 'Private'}
                    </span>
                    <span className="text-white/50 text-sm">{request.distance_km?.toFixed(1)} km</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-3xl font-heading font-black text-primary">K{request.fare?.toFixed(2)}</p>
                  <p className="text-sm text-white/50">Est. Fare</p>
                </div>
              </div>

              <div className="space-y-4 mb-6 relative">
                {/* Connecting line */}
                <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-white/10" />

                <div className="flex gap-4 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-white/5 border border-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase font-bold tracking-wider">Pickup</p>
                    <p className="text-white font-medium">{request.pickup_location?.address}</p>
                  </div>
                </div>

                <div className="flex gap-4 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-white/5 border border-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase font-bold tracking-wider">Dropoff</p>
                    <p className="text-white font-medium">{request.dropoff_location?.address}</p>
                  </div>
                </div>
              </div>

              {/* Passenger Info */}
              <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{request.passenger_count || 1} Passenger{(request.passenger_count || 1) > 1 ? 's' : ''}</p>
                    <p className="text-xs text-white/50">Requires {request.passenger_count || 1} seat{(request.passenger_count || 1) > 1 ? 's' : ''}</p>
                  </div>
                </div>
                {request.passenger_count > seatsLeft && (
                  <div className="text-red-400 flex items-center gap-1">
                    <ShieldAlert size={16} />
                    <span className="text-xs font-bold">Exceeds Capacity</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onReject()}
                  className="py-4 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => onAccept(request.id)}
                  disabled={request.passenger_count > seatsLeft}
                  className="py-4 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  Accept
                </button>
              </div>

              {/* Swipe/Drag hint */}
              <div className="mt-4 text-center">
                <p className="text-xs text-white/30">Auto-collapsing in 10s</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
