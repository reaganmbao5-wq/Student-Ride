import React, { useState, useEffect, useRef } from 'react';
import { Users, ChevronLeft } from 'lucide-react';
import { GlassCard, GoldButton } from '../common/GlassComponents';

export const SharedRideRequestPanel = ({ requests, onAccept, onDecline }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Expand when new requests arrive and start timer
    if (requests.length > 0) {
      setIsMinimized(false);
      resetTimer();
    }
    return () => clearTimeout(timeoutRef.current);
  }, [requests.length]);

  const resetTimer = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsMinimized(true);
    }, 10000);
  };

  if (!requests || requests.length === 0) return null;

  if (isMinimized) {
    return (
      <div 
        className="fixed top-20 left-4 z-50 animate-in slide-in-from-left-4 duration-300 pointer-events-auto cursor-pointer"
        onClick={() => {
          setIsMinimized(false);
          resetTimer();
        }}
      >
        <div className="bg-black/80 backdrop-blur-md border border-gold/30 shadow-lg shadow-gold/10 rounded-full px-4 py-2 flex items-center gap-3">
          <div className="bg-gold/20 p-1.5 rounded-full">
            <Users className="w-4 h-4 text-gold" />
          </div>
          <span className="text-white font-medium text-sm">
            {requests.length} Shared Ride{requests.length > 1 ? 's' : ''} Available
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed top-20 left-4 z-50 w-full max-w-[320px] pointer-events-auto"
      onMouseEnter={resetTimer}
      onTouchStart={resetTimer}
    >
      <GlassCard className="p-4 shadow-2xl border-white/10 animate-in slide-in-from-left-8 duration-300 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-black/60 backdrop-blur-xl p-2 -mx-2 -mt-2 rounded-lg z-10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gold" />
            <h3 className="font-heading font-semibold text-white">Shared Rides ({requests.length})</h3>
          </div>
          <button 
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70"
            title="Minimize"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {requests.map(request => (
            <div key={request.id} className="bg-white/5 border border-white/5 rounded-xl p-3">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-medium text-white line-clamp-1">
                    New Passenger
                  </p>
                  <p className="text-xs text-gold mt-0.5 font-semibold">K{request.fare?.toFixed(2)}</p>
                </div>
                <div className="bg-blue-500/20 text-blue-400 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                  {request.passenger_count || 1} Seat{request.passenger_count > 1 ? 's' : ''}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-gold mt-1.5 shrink-0" />
                  <p className="text-xs text-white/70 line-clamp-1">{request.pickup_location?.address}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-white/70 line-clamp-1">{request.dropoff_location?.address}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onDecline(request.id)}
                  className="flex-1 py-1.5 rounded-lg border border-white/10 text-white/70 text-xs font-medium hover:bg-white/5 transition-colors"
                >
                  Ignore
                </button>
                <GoldButton
                  className="flex-1 py-1.5 text-xs"
                  onClick={() => onAccept(request.id)}
                >
                  Accept
                </GoldButton>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};
