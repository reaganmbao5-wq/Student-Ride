import React, { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton } from '../common/GlassComponents';

export const SharedRideRequestPanel = ({ requests, onAccept }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState(0); // Track infinite scrolling position
  const direction = useRef(0); // 1 for UP, -1 for DOWN
  const timeoutRef = useRef(null);
  
  const activeIndex = requests && requests.length > 0 
    ? ((position % requests.length) + requests.length) % requests.length 
    : 0;

  const formatAddress = (address) => {
    if (!address) return 'Unknown Location';
    const parts = address.split(',');
    if (parts.length <= 2) return address;
    return `${parts[0].trim()}, ${parts[1].trim()}`;
  };

  const prevLengthRef = useRef(requests.length);

  useEffect(() => {
    if (prevLengthRef.current === 0 && requests.length > 0) {
      setIsMinimized(false);
      resetTimer();
    } else if (!isMinimized && requests.length > 0) {
      resetTimer();
    }
    prevLengthRef.current = requests.length;
  }, [requests.length, isMinimized]);

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
        initial={{ x: -150 }}
        animate={{ x: 0 }}
        exit={{ x: -150 }}
        transition={{ type: 'spring', stiffness: 250, damping: 25 }}
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

  const handlePanEnd = (e, info) => {
    const threshold = 40; 
    
    if (info.offset.x < -threshold) {
      setIsMinimized(true);
      return;
    }

    // Swipe UP or RIGHT -> Next Student (Moves UP)
    if (info.offset.y < -threshold || info.offset.x > threshold) {
      if (requests.length > 1) {
        direction.current = 1;
        setPosition(prev => prev + 1);
      }
      resetTimer();
    } 
    // Swipe DOWN -> Previous Student (Moves DOWN)
    else if (info.offset.y > threshold) {
      if (requests.length > 1) {
        direction.current = -1;
        setPosition(prev => prev - 1);
      }
      resetTimer();
    } else {
      resetTimer();
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ x: -350 }}
        animate={{ x: 0 }}
        exit={{ x: -350 }}
        transition={{ type: 'spring', stiffness: 250, damping: 30 }}
        className="fixed top-24 left-4 z-50 w-full max-w-[280px] pointer-events-auto"
        onMouseEnter={resetTimer}
        onTouchStart={resetTimer}
      >
        <div className="flex flex-col items-center">
          {/* Header / Minimizer */}
          <motion.div 
            className="relative z-20 bg-white/95 backdrop-blur-2xl border border-black/10 rounded-full px-4 py-2 mb-28 flex items-center gap-2 cursor-pointer shadow-2xl transition-all hover:bg-white hover:border-black/20"
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
                  </motion.span>
                </AnimatePresence>
              </div>
              Ride{requests.length > 1 ? 's' : ''} Available
            </span>
          </motion.div>

        {/* Circular Queue Carousel */}
        <div className="relative w-full h-[250px] flex justify-center perspective-[1000px]">
          {requests.length > 0 && (() => {
            const len = requests.length;
            let offsetsToRender = [];
            
            if (len === 1) {
              offsetsToRender = [0]; // Single card
            } else if (len === 2) {
              offsetsToRender = [-1, 0]; // Top and Active
            } else {
              offsetsToRender = [-1, 0, 1]; // Top, Active, Bottom
            }

            return (
              <AnimatePresence mode="popLayout">
                {offsetsToRender.map((offset) => {
                  const virtualIndex = position + offset;
                  const dataIndex = ((virtualIndex % len) + len) % len;
                  const req = requests[dataIndex];
                  
                  if (!req) return null;

                  const isActive = offset === 0;
                  
                  // Position mapping
                  let y = 0, scale = 1, zIndex = 10;
                  if (offset === -1) {
                    y = -90; scale = 0.85; zIndex = 9;
                  } else if (offset === 1) {
                    y = 200; scale = 0.85; zIndex = 9;
                  }

                  // Determine entry/exit animations based on swipe direction
                  const initialY = direction.current === 1 ? 300 : -200;
                  const exitY = direction.current === 1 ? -200 : 300;

                  const permanentKey = ((virtualIndex % 3) + 3) % 3;

                  return (
                    <motion.div
                      key={permanentKey} // Permanent rotating deck of 3 cards, never destroyed!
                      initial={{ y: initialY, scale: 0.8 }} // Plays only on very first mount
                      animate={{ y, scale, opacity: 1, zIndex }}
                      transition={{ type: 'spring', stiffness: 250, damping: 25 }}
                      className="absolute w-full top-0 touch-none will-change-transform"
                      onPanEnd={isActive ? handlePanEnd : undefined}
                      style={{ 
                        pointerEvents: isActive ? 'auto' : 'none',
                        transformOrigin: 'top center'
                      }}
                    >
                      <GlassCard className="p-3.5 shadow-2xl border border-black/5 bg-white/80 backdrop-blur-2xl overflow-hidden relative">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-lg font-heading font-extrabold text-black line-clamp-1 drop-shadow-sm">{req.student_name || 'Student'}</p>
                            <p className="text-[14px] text-zinc-900 mt-0.5 font-extrabold">K{req.fare?.toFixed(2)}</p>
                          </div>
                          <div className="bg-blue-500/10 text-blue-600 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border border-blue-500/20 backdrop-blur-md">
                            {req.ride_mode === 'shared' ? 'Shared' : 'Private'}
                          </div>
                        </div>

                        {/* Collapsible Details */}
                        <AnimatePresence initial={false}>
                          {isActive && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: 'easeOut' }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-3.5 mb-5 relative mt-4">
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
                              <GoldButton className="w-full py-2.5 text-[13px] font-extrabold shadow-none transition-transform active:scale-95" onClick={(e) => { e.stopPropagation(); onAccept(req.id); }}>
                                Accept
                              </GoldButton>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            );
          })()}
        </div>

        {/* Pagination Indicators */}
        {requests.length > 1 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 mt-8 bg-white/90 backdrop-blur-xl px-3 py-1.5 rounded-full border border-black/5 shadow-lg"
          >
            {requests.map((_, i) => (
              <div 
                key={i} 
                className={`transition-all duration-500 rounded-full ${i === activeIndex ? 'w-4 h-1.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'w-1.5 h-1.5 bg-black/20'}`}
              />
            ))}
          </motion.div>
        )}
        
      </div>
      </motion.div>
    </AnimatePresence>
  );
};
