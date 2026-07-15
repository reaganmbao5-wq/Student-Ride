import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageSquare, MapPin, Navigation, User, ChevronUp, ChevronDown } from 'lucide-react';
import { GlassCard } from '../common/GlassComponents';

export const RotaryActiveRides = ({ activeRides, onUpdateStatus, onCall, onChat }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!activeRides || activeRides.length === 0) return null;

  const currentRide = activeRides[currentIndex];
  
  // Safe bounds check in case activeRides shrinks
  if (currentIndex >= activeRides.length) {
    setCurrentIndex(Math.max(0, activeRides.length - 1));
    return null;
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeRides.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeRides.length) % activeRides.length);
  };

  const variants = {
    enter: (direction) => ({
      y: direction > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, type: 'spring', bounce: 0.2 }
    },
    exit: (direction) => ({
      y: direction < 0 ? 100 : -100,
      opacity: 0,
      scale: 0.9,
      transition: { duration: 0.2 }
    })
  };

  // Determine button state based on ride status
  const getActionConfig = (status) => {
    switch (status) {
      case 'requested':
      case 'accepted':
      case 'driver_accepted':
      case 'driver_en_route_to_pickup':
        return { label: "I've Arrived", nextStatus: 'driver_arrived', color: 'bg-primary text-primary-foreground' };
      case 'driver_arrived':
      case 'passenger_boarding':
        return { label: "Start Ride", nextStatus: 'ride_started', color: 'bg-emerald-500 text-white' };
      case 'ride_started':
      case 'ride_in_progress':
      case 'arriving_destination':
        return { label: "Complete Ride", nextStatus: 'ride_completed', color: 'bg-amber-500 text-white' };
      default:
        return null;
    }
  };

  const action = getActionConfig(currentRide.status);

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden pb-4">
      
      {/* Pagination Controls (Top) */}
      {activeRides.length > 1 && (
        <div className="flex justify-center mb-2 z-10">
          <button 
            onClick={handlePrev}
            className="p-2 rounded-full bg-background/50 backdrop-blur-md border border-white/10 text-white/70 hover:text-white"
          >
            <ChevronUp size={20} />
          </button>
        </div>
      )}

      {/* Rotary Cards */}
      <div className="relative flex-grow flex items-center justify-center min-h-[340px]">
        <AnimatePresence custom={1} mode="popLayout">
          <motion.div
            key={currentRide.id}
            custom={1}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset }) => {
              const swipe = offset.y;
              if (swipe < -50) handleNext();
              else if (swipe > 50) handlePrev();
            }}
            className="w-full h-full absolute inset-0 flex items-center justify-center"
          >
            <GlassCard className="w-full max-w-md mx-auto p-5 border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl rounded-3xl">
              
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="text-primary w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-lg text-white">
                      {currentRide.student?.name || 'Student'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                        {currentRide.ride_mode === 'shared' ? 'Shared' : 'Private'}
                      </span>
                      <span className="text-xs text-white/50">{activeRides.length} Active</span>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => onChat(currentRide.student?.id)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white">
                    <MessageSquare size={18} />
                  </button>
                  <button onClick={() => onCall(currentRide.student?.phone)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-emerald-400">
                    <Phone size={18} />
                  </button>
                </div>
              </div>

              {/* Status & Location Info */}
              <div className="space-y-3 mb-6 bg-white/5 rounded-2xl p-4 border border-white/5">
                
                {/* Status Indicator */}
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-sm text-white/60 uppercase tracking-wider font-semibold">Status</span>
                  <span className="text-sm font-bold text-primary capitalize">
                    {currentRide.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="text-emerald-400 w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Pickup</p>
                    <p className="text-sm text-white/90 truncate">{currentRide.pickup_location?.address || 'Unknown'}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Navigation className="text-amber-400 w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Dropoff</p>
                    <p className="text-sm text-white/90 truncate">{currentRide.dropoff_location?.address || 'Unknown'}</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              {action ? (
                <button
                  onClick={() => onUpdateStatus(currentRide.id, action.nextStatus)}
                  className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition active:scale-95 ${action.color}`}
                >
                  {action.label}
                </button>
              ) : (
                <div className="w-full py-4 rounded-xl font-bold text-lg text-center bg-white/10 text-white/50">
                  Waiting...
                </div>
              )}

            </GlassCard>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination Controls (Bottom) */}
      {activeRides.length > 1 && (
        <div className="flex justify-center mt-2 z-10">
          <button 
            onClick={handleNext}
            className="p-2 rounded-full bg-background/50 backdrop-blur-md border border-white/10 text-white/70 hover:text-white"
          >
            <ChevronDown size={20} />
          </button>
        </div>
      )}

      {/* Pagination Indicators */}
      {activeRides.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {activeRides.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`} 
            />
          ))}
        </div>
      )}
    </div>
  );
};
