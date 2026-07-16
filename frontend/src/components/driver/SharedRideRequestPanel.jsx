import React, { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton } from '../common/GlassComponents';

export const SharedRideRequestPanel = ({ requests, onAccept }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef(null);

  // Address Truncator Helper
  const formatAddress = (address) => {
    if (!address) return 'Unknown Location';
    const parts = address.split(',');
    if (parts.length <= 2) return address;
    return `${parts[0].trim()}, ${parts[1].trim()}`;
  };

  useEffect(() => {
    if (requests.length > 0) {
      setIsMinimized(false);
      resetTimer();
    }
  }, [requests.length]);

  // Ensure currentIndex stays within bounds when items are removed
  useEffect(() => {
    if (requests.length > 0 && currentIndex >= requests.length) {
      setCurrentIndex(Math.max(0, requests.length - 1));
    }
  }, [requests, currentIndex]);

  const resetTimer = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsMinimized(true);
    }, 10000);
  };

  if (!requests || requests.length === 0) return null;

  if (isMinimized) {
    return (
      <motion.div 
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -50, opacity: 0 }}
        className="fixed top-28 left-0 z-50 pointer-events-auto cursor-pointer"
        onClick={() => {
          setIsMinimized(false);
          resetTimer();
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(e, info) => {
          if (info.offset.x > 20) {
            setIsMinimized(false);
            resetTimer();
          }
        }}
      >
        <div className="bg-black/90 backdrop-blur-2xl border-y border-r border-white/10 shadow-2xl rounded-r-2xl py-3 px-3 flex flex-col items-center gap-1.5 transition-colors hover:bg-black">
          <Users className="w-5 h-5 text-gold drop-shadow-md" />
          <span className="text-white font-black text-xs tracking-wider">
            +{requests.length}
          </span>
        </div>
      </motion.div>
    );
  }

  // Handle Carousel Drag
  const handleDragEnd = (e, info) => {
    const threshold = 30; // Threshold to trigger a swipe
    if (info.offset.y < -threshold) {
      // Swipe UP -> Next Student
      if (currentIndex < requests.length - 1) {
        setCurrentIndex(prev => prev + 1);
        resetTimer();
      }
    } else if (info.offset.y > threshold) {
      // Swipe DOWN -> Previous Student
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        resetTimer();
      }
    } else {
      // If barely dragged, reset timer anyway
      resetTimer();
    }
  };

  return (
    <div 
      className="fixed top-20 left-4 z-50 w-full max-w-[300px] pointer-events-auto"
      onMouseEnter={resetTimer}
      onTouchStart={resetTimer}
    >
      <div className="flex flex-col items-center">
        {/* Header / Minimizer */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-full px-5 py-2.5 mb-6 flex items-center gap-2 cursor-pointer shadow-2xl transition-all hover:bg-black hover:border-white/20"
          onClick={() => setIsMinimized(true)}
        >
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse shadow-[0_0_8px_rgba(255,215,0,0.6)]" />
          <span className="text-white text-sm font-bold tracking-wide">
            {requests.length} Shared Ride{requests.length > 1 ? 's' : ''} Available
          </span>
        </motion.div>

        {/* Apple-style Wheel Container */}
        <div className="relative w-full h-[250px] flex justify-center perspective-[1200px]">
          <AnimatePresence>
            {requests.map((request, index) => {
              const diff = index - currentIndex;
              
              // Only render the active, previous, and next card to mimic a wheel and save DOM nodes
              if (Math.abs(diff) > 1) return null;

              // Calculate positions for Apple wheel 3D effect
              const yOffset = diff * 130; // Spacing between cards
              const scale = diff === 0 ? 1 : 0.85;
              const opacity = diff === 0 ? 1 : 0.3;
              const zIndex = diff === 0 ? 10 : 5;
              const rotateX = diff * -25; // 3D tilt

              return (
                <motion.div
                  key={request.id}
                  className="absolute w-full top-0"
                  initial={{ opacity: 0, y: diff > 0 ? 150 : -150, scale: 0.8, rotateX: diff > 0 ? -30 : 30 }}
                  animate={{ 
                    y: yOffset, 
                    scale, 
                    opacity, 
                    zIndex,
                    rotateX 
                  }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  drag={diff === 0 ? "y" : false} // Only center card receives swipe gestures
                  dragConstraints={{ top: 0, bottom: 0 }}
                  onDragEnd={handleDragEnd}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <GlassCard className={`p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] border-white/10 bg-black/85 backdrop-blur-3xl ${diff !== 0 && 'pointer-events-none blur-[1px]'}`}>
                    
                    {/* Top Row: User & Fare */}
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <p className="text-xl font-heading font-bold text-white line-clamp-1 drop-shadow-md">
                          Student
                        </p>
                        <p className="text-[15px] text-gold mt-1 font-bold">K{request.fare?.toFixed(2)}</p>
                      </div>
                      <div className="bg-gold/10 text-gold text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-full border border-gold/20 backdrop-blur-md">
                        {request.passenger_count || 1} Seat{request.passenger_count > 1 ? 's' : ''}
                      </div>
                    </div>

                    {/* Formatted Addresses */}
                    <div className="space-y-4 mb-6 relative">
                      {/* Connecting Line */}
                      <div className="absolute left-[5px] top-4 bottom-4 w-[1px] bg-gradient-to-b from-white/30 to-gold/30" />
                      
                      <div className="flex items-start gap-4">
                        <div className="w-3 h-3 rounded-full border-[3px] border-white/60 mt-0.5 shrink-0 bg-black z-10" />
                        <p className="text-[14px] text-white font-medium leading-tight drop-shadow-sm">{formatAddress(request.pickup_location?.address)}</p>
                      </div>
                      
                      <div className="flex items-start gap-4">
                        <div className="w-3 h-3 rounded-full bg-gold mt-0.5 shrink-0 shadow-[0_0_10px_rgba(255,215,0,0.6)] z-10" />
                        <p className="text-[14px] text-white font-medium leading-tight drop-shadow-sm">{formatAddress(request.dropoff_location?.address)}</p>
                      </div>
                    </div>

                    {/* Accept Button */}
                    <GoldButton
                      className="w-full py-3 text-[14px] font-bold shadow-[0_4px_20px_rgba(255,215,0,0.3)] transition-transform active:scale-95"
                      onClick={() => onAccept(request.id)}
                    >
                      Accept
                    </GoldButton>

                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Pagination Indicators */}
        {requests.length > 1 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 mt-8 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5 shadow-lg"
          >
            {requests.map((_, i) => (
              <div 
                key={i} 
                className={`transition-all duration-500 rounded-full ${i === currentIndex ? 'w-5 h-1.5 bg-gold shadow-[0_0_8px_rgba(255,215,0,0.8)]' : 'w-1.5 h-1.5 bg-white/20'}`}
              />
            ))}
          </motion.div>
        )}
        
      </div>
    </div>
  );
};
