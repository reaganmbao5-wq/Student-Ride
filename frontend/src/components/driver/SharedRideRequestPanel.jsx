import React, { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton } from '../common/GlassComponents';

export const SharedRideRequestPanel = ({ requests, onAccept }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState(0); // Track infinite scrolling position
  const timeoutRef = useRef(null);
  
  // Calculate the real array index from the infinite position
  const activeIndex = requests && requests.length > 0 
    ? ((position % requests.length) + requests.length) % requests.length 
    : 0;

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

  // Ensure position gracefully handles if active request is accepted/removed
  useEffect(() => {
    // If the list shrinks such that we have fewer items, React re-renders and the modulo 
    // operator ensures we automatically fall onto a valid item!
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
          <Users className="w-[18px] h-[18px] text-black" />
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

  // Handle Carousel Pan (Swipe detection without moving the card physically)
  const handlePanEnd = (e, info) => {
    const threshold = 40; // Swipe threshold
    
    // Swipe LEFT -> Minimize
    if (info.offset.x < -threshold) {
      setIsMinimized(true);
      return;
    }

    // Swipe UP or RIGHT -> Next Student (Endless)
    if (info.offset.y < -threshold || info.offset.x > threshold) {
      if (requests.length > 1) setPosition(prev => prev + 1);
      resetTimer();
    } 
    // Swipe DOWN -> Previous Student (Endless)
    else if (info.offset.y > threshold) {
      if (requests.length > 1) setPosition(prev => prev - 1);
      resetTimer();
    } else {
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
              <Users className="w-3.5 h-3.5" />
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
    <div className="h-full flex flex-col justify-end p-4 pointer-events-none overflow-hidden pb-[120px]">
      
      {/* Minimized Bubble */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -50 }}
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
            onClick={() => setIsMinimized(false)}
          >
            <div className="bg-black/90 p-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 backdrop-blur-xl">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              <span className="text-white font-extrabold text-sm">{requests.length}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="w-full flex flex-col items-center pointer-events-none"
          >
        
        {/* Infinite Stacked Card View with Swipe Gestures */}
        <div className="relative w-full h-[230px] flex justify-center perspective-[1000px]">
          
          {/* Pending Rides Badge - placed nicely right above the stack */}
          {requests.length > 0 && (
            <div className="absolute -top-16 left-0 right-0 flex justify-center z-50 pointer-events-none">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white px-4 py-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-black/5 flex items-center gap-2 pointer-events-auto"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <Users className="w-4 h-4 text-zinc-600" />
                <span className="text-sm font-bold text-zinc-800">{requests.length} Rides Available</span>
              </motion.div>
            </div>
          )}
          {requests.length > 0 && (() => {
            const len = requests.length;
            const normalizedPos = ((position % len) + len) % len;

            return requests.map((req, i) => {
              // Calculate logical offset for infinite loop
              let offset = (i - normalizedPos) % len;
              if (offset < 0) offset += len;

              // Force the offset to correctly represent Next, Prev, etc.
              // If we have 3 items: offsets are 0, 1, 2. We want 2 to wrap to -1.
              if (offset > 2 || (len === 3 && offset === 2)) {
                offset -= len;
              }

              let y = 0, scale = 1, opacity = 1, zIndex = 10;
              
              if (offset === 0) {
                 // Active
                 y = 0; scale = 1; opacity = 1; zIndex = 10;
              } else if (offset === 1) {
                 // Behind 1
                 y = 25; scale = 0.95; opacity = 1; zIndex = 9;
              } else if (offset === 2) {
                 // Behind 2
                 y = 50; scale = 0.9; opacity = 1; zIndex = 8;
              } else if (offset < 0) {
                 // Previous (Swiped up, hiding at top)
                 y = -80; scale = 0.95; opacity = 0; zIndex = 11;
              } else {
                 // Far behind
                 y = 75; scale = 0.85; opacity = 0; zIndex = 7;
              }

              return (
                <motion.div
                  key={req.id} // Re-use exactly the same DOM node for infinite loop!
                  initial={false}
                  animate={{ y, scale, opacity, zIndex }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  className="absolute w-full top-0 touch-none will-change-transform"
                  onPanEnd={offset === 0 ? handlePanEnd : undefined}
                  style={{ 
                    pointerEvents: offset === 0 ? 'auto' : 'none',
                    transformOrigin: 'top center' // Forces the scale to shrink from the bottom up
                  }}
                >
                  <GlassCard className="p-3.5 shadow-2xl border border-black/5 bg-white/80 backdrop-blur-2xl overflow-hidden relative">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-lg font-heading font-extrabold text-black line-clamp-1 drop-shadow-sm">{req.student_name || 'Student'}</p>
                        <p className="text-[14px] text-zinc-900 mt-0.5 font-extrabold">K{req.fare?.toFixed(2)}</p>
                      </div>
                      <div className="bg-blue-500/10 text-blue-600 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border border-blue-500/20 backdrop-blur-md">
                        {req.ride_mode === 'shared' ? 'Shared' : 'Private'}
                      </div>
                    </div>
                    <div className="space-y-3.5 mb-5 relative">
                      <div className="absolute left-[4.5px] top-3 bottom-3 w-[1px] bg-gradient-to-b from-black/20 to-blue-500/30" />
                      <div className="flex items-start gap-3.5 pointer-events-none">
                        <div className="w-2.5 h-2.5 rounded-full border-[2.5px] border-zinc-700 mt-1 shrink-0 bg-white z-10" />
                        <p className="text-[13px] text-zinc-800 font-bold leading-tight drop-shadow-sm pointer-events-auto">{formatAddress(req.pickup_location?.address)}</p>
                      </div>
                      <div className="flex items-start gap-3.5 pointer-events-none">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)] z-10" />
                        <p className="text-[13px] text-zinc-800 font-bold leading-tight drop-shadow-sm pointer-events-auto">{formatAddress(req.dropoff_location?.address)}</p>
                      </div>
                    </div>
                    <GoldButton className="w-full py-2.5 text-[13px] font-extrabold shadow-[0_4px_15px_rgba(255,215,0,0.25)] transition-transform active:scale-95" onClick={(e) => { e.stopPropagation(); onAccept(req.id); }}>
                      Accept
                    </GoldButton>
                  </GlassCard>
                </motion.div>
              );
            });
          })()}
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
                className={`transition-all duration-500 rounded-full ${i === activeIndex ? 'w-4 h-1.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'w-1.5 h-1.5 bg-black/20'}`}
              />
            ))}
          </motion.div>
        )}
        
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
