import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, User, Users, CheckCircle, Clock } from 'lucide-react';
import { GlassCard, GoldButton } from '../common/GlassComponents';

const StopItem = ({ stop, isNext, onComplete }) => {
  const isPickup = stop.stop_type === 'pickup';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={`relative pl-8 pb-6 last:pb-0 ${!isNext && 'opacity-60 grayscale-[30%]'}`}
    >
      {/* Timeline Line */}
      <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-white/10" />
      
      {/* Timeline Node */}
      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 
        ${isNext ? (isPickup ? 'border-emerald-400 bg-emerald-400/20' : 'border-gold bg-gold/20') : 'border-white/30 bg-black'}`}
      >
        <div className={`w-2 h-2 rounded-full ${isNext ? (isPickup ? 'bg-emerald-400' : 'bg-gold') : 'bg-white/30'}`} />
      </div>

      <GlassCard className={`p-4 border ${isNext ? 'border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'border-white/5'}`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isPickup ? 'text-emerald-400' : 'text-gold'}`}>
              {isPickup ? 'Pickup' : 'Dropoff'}
            </span>
            <span className="text-muted-foreground text-xs font-mono">
              Student #{stop.student_id.substring(0, 4)}
            </span>
          </div>
          {isNext && stop.eta_seconds && (
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-md">
              <Clock className="w-3 h-3 text-gold" />
              <span className="text-xs text-gold font-mono font-bold">
                {Math.ceil(stop.eta_seconds / 60)} min
              </span>
            </div>
          )}
        </div>

        <h3 className="text-foreground font-heading font-medium text-lg mb-4 truncate">
          {stop.coordinates?.address || "Destination"}
        </h3>

        {isNext && (
          <GoldButton 
            className="w-full flex items-center justify-center gap-2" 
            onClick={() => onComplete(stop.stop_id)}
          >
            {isPickup ? (
              <>
                <User className="w-4 h-4" />
                Passenger Picked Up
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Complete Dropoff
              </>
            )}
          </GoldButton>
        )}
      </GlassCard>
    </motion.div>
  );
};

export const ActiveTripQueue = ({ trip, onCompleteStop }) => {
  if (!trip || !trip.route_queue || trip.route_queue.length === 0) return null;

  const pendingStops = trip.route_queue.filter(s => s.status === 'pending');
  if (pendingStops.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Trip Header Status */}
      <GlassCard className="p-4 border-gold/30 bg-gold/5 flex justify-between items-center">
        <div>
          <h2 className="font-heading font-bold text-gold text-lg">Active Trip</h2>
          <p className="text-xs text-muted-foreground">Follow the queue sequence</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase">Capacity</p>
            <div className="flex items-center gap-1 text-foreground font-bold">
              <Users className="w-4 h-4 text-emerald-400" />
              {trip.capacity?.total - trip.capacity?.occupied - trip.capacity?.reserved} / {trip.capacity?.total} Left
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Stop Queue Timeline */}
      <div className="pt-2">
        <AnimatePresence>
          {pendingStops.map((stop, index) => (
            <StopItem 
              key={stop.stop_id} 
              stop={stop} 
              isNext={index === 0}
              onComplete={onCompleteStop}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
