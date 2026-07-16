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

  const prevLengthRef = useRef(requests.length);

  useEffect(() => {
    // If we receive our very first request (0 -> 1), expand the panel
    if (prevLengthRef.current === 0 && requests.length > 0) {
      setIsMinimized(false);
      resetTimer();
    } 
    // If the panel is ALREADY expanded, reset the timer to give the driver time to read
    else if (!isMinimized && requests.length > 0) {
      resetTimer();
    }
    // If it is minimized and a new request arrives, DO NOT auto-expand. 
    // Just update the counter (React handles the re-render).
    
    prevLengthRef.current = requests.length;
  }, [requests.length, isMinimized]);

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
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="fixed top-32 left-0 z-50 pointer-events-auto cursor-pointer"
        onClick={() => {
          setIsMinimized(false);
          resetTimer();
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(e, info) => {
          if (info.offset.x > 30) {
            setIsMinimized(false);
            resetTimer();
          }
        }}
      >
        <div className="bg-white/95 backdrop-blur-2xl border-y border-r border-black/10 shadow-2xl rounded-r-2xl py-2.5 px-3.5 flex items-center gap-2 transition-colors hover:bg-white">
          <span className="text-sm">🔔</span>
          <div className="text-black font-black text-sm tracking-wider flex overflow-hidden h-[20px] items-center relative w-[15px] justify-center">
            <AnimatePresence mode="popLayout">
              <motion.span 
                key={requests.length}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute"
              >
                {requests.length}
              </motion.span>
            </AnimatePresence>
          </div>
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
    <AnimatePresence>
      <motion.div 
        initial={{ x: -150, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -150, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
        className="fixed top-24 left-4 z-50 w-full max-w-[280px] pointer-events-auto"
        onMouseEnter={resetTimer}
        onTouchStart={resetTimer}
      >
        <div className="flex flex-col items-center">
          {/* Header / Minimizer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/95 backdrop-blur-2xl border border-black/10 rounded-full px-4 py-2 mb-4 flex items-center gap-2 cursor-pointer shadow-2xl transition-all hover:bg-white hover:border-black/20"
            onClick={() => setIsMinimized(true)}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <span className="text-black text-xs font-bold tracking-wide flex items-center gap-1.5">
              <span>🔔</span>
              <div className="flex overflow-hidden h-[16px] items-center relative w-[10px] justify-center">
                <AnimatePresence mode="popLayout">
                  <motion.span 
                    key={requests.length}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute"
                  >
                    {requests.length}
                  </motion.span>
                </AnimatePresence>
              </div>
              Ride{requests.length > 1 ? 's' : ''} Available
            </span>
          </motion.div>

        {/* Apple-style Wheel Container */}
        <div className="relative w-full h-[230px] flex justify-center perspective-[1200px]">
          <AnimatePresence>
            {requests.map((request, index) => {
              const diff = index - currentIndex;
              
              // Only render the active, previous, and next card to mimic a wheel and save DOM nodes
              if (Math.abs(diff) > 1) return null;

              // Calculate positions for smoother Apple wheel 3D effect
              const yOffset = diff * 115; // Closer spacing
              const scale = diff === 0 ? 1 : 0.88;
              const opacity = diff === 0 ? 1 : 0.35;
              const zIndex = diff === 0 ? 10 : 5;
              const rotateX = diff * -20; // Smoother 3D tilt

              return (
                <motion.div
                  key={request.id}
                  className="absolute w-full top-0"
                  initial={{ opacity: 0, y: diff > 0 ? 120 : -120, scale: 0.85, rotateX: diff > 0 ? -25 : 25 }}
                  animate={{ 
                    y: yOffset, 
                    scale, 
                    opacity, 
                    zIndex,
                    rotateX 
                  }}
                  exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                  drag={diff === 0 ? "y" : false} // Only center card receives swipe gestures
                  dragConstraints={{ top: 0, bottom: 0 }}
                  onDragEnd={handleDragEnd}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <GlassCard className={`p-3.5 shadow-2xl border-black/5 bg-white/95 backdrop-blur-3xl ${diff !== 0 && 'pointer-events-none blur-[0.5px]'}`}>
                    
                    {/* Top Row: User & Fare */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-lg font-heading font-extrabold text-black line-clamp-1 drop-shadow-sm">
                          {request.student_name || 'Student'}
                        </p>
                        <p className="text-[14px] text-zinc-900 mt-0.5 font-extrabold">K{request.fare?.toFixed(2)}</p>
                      </div>
                      <div className="bg-blue-500/10 text-blue-600 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border border-blue-500/20 backdrop-blur-md">
                        {request.ride_mode === 'shared' ? 'Shared' : 'Private'}
                      </div>
                    </div>

                    {/* Formatted Addresses */}
                    <div className="space-y-3.5 mb-5 relative">
                      {/* Connecting Line */}
                      <div className="absolute left-[4.5px] top-3 bottom-3 w-[1px] bg-gradient-to-b from-black/20 to-blue-500/30" />
                      
                      <div className="flex items-start gap-3.5">
                        <div className="w-2.5 h-2.5 rounded-full border-[2.5px] border-zinc-700 mt-1 shrink-0 bg-white z-10" />
                        <p className="text-[13px] text-zinc-800 font-bold leading-tight drop-shadow-sm">{formatAddress(request.pickup_location?.address)}</p>
                      </div>
                      
                      <div className="flex items-start gap-3.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)] z-10" />
                        <p className="text-[13px] text-zinc-800 font-bold leading-tight drop-shadow-sm">{formatAddress(request.dropoff_location?.address)}</p>
                      </div>
                    </div>

                    {/* Accept Button */}
                    <GoldButton
                      className="w-full py-2.5 text-[13px] font-extrabold shadow-[0_4px_15px_rgba(255,215,0,0.25)] transition-transform active:scale-95"
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
            className="flex items-center gap-1.5 mt-6 bg-white/90 backdrop-blur-xl px-3 py-1.5 rounded-full border border-black/5 shadow-lg"
          >
            {requests.map((_, i) => (
              <div 
                key={i} 
                className={`transition-all duration-500 rounded-full ${i === currentIndex ? 'w-4 h-1.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'w-1.5 h-1.5 bg-black/20'}`}
              />
            ))}
          </motion.div>
        )}
        
      </div>
      </motion.div>
    </AnimatePresence>
  );
};
