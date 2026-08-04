import React, { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RideCard } from './RideCard';

export const SharedRideRequestPanel = ({ requests, onAccept, driverLocation }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState(0); // Track infinite scrolling position
  const direction = useRef(0); // 1 for UP, -1 for DOWN
  const timeoutRef = useRef(null);
  
  const activeIndex = requests && requests.length > 0 
    ? ((position % requests.length) + requests.length) % requests.length 
    : 0;

  const prevLengthRef = useRef(requests ? requests.length : 0);

  useEffect(() => {
    if (prevLengthRef.current === 0 && requests.length > 0) {
      setIsMinimized(false);
      resetTimer();
    } else if (!isMinimized && requests.length > 0) {
      resetTimer();
    }
    prevLengthRef.current = requests.length;
  }, [requests ? requests.length : 0, isMinimized]);

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
        className="fixed top-24 left-4 z-50 w-full max-w-[305px] pointer-events-auto"
        onMouseEnter={resetTimer}
        onTouchStart={resetTimer}
      >
        <div className="flex flex-col items-center">
          {/* Header / Minimizer Banner - Elevated z-50 and mb-12 margin to float cleanly ABOVE top card */}
          <motion.div 
            className="relative z-50 bg-white/95 backdrop-blur-2xl border border-black/10 rounded-full px-4 py-2 mb-12 flex items-center gap-2 cursor-pointer shadow-2xl transition-all hover:bg-white hover:border-black/20"
            onClick={() => setIsMinimized(true)}
          >
            <span className="text-black text-xs font-bold tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-black" />
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

        {/* Circular Queue Carousel Stack - Container sized h-[290px] to encapsulate full bottom card extent */}
        <div className="relative w-full h-[290px] flex justify-center perspective-[1000px]">
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
                  
                  // Position mapping - Compact vertical offsets
                  let y = 0, scale = 1, zIndex = 10;
                  if (offset === -1) {
                    y = -65; scale = 0.85; 
                    zIndex = direction.current === -1 ? 8 : 9;
                  } else if (offset === 1) {
                    y = 150; scale = 0.85; 
                    zIndex = direction.current === 1 ? 8 : 9;
                  }

                  // Determine entry/exit animations based on swipe direction
                  const initialY = direction.current === 1 ? 260 : -160;

                  const permanentKey = ((virtualIndex % 3) + 3) % 3;

                  return (
                    <motion.div
                      key={permanentKey}
                      initial={{ y: initialY, scale: 0.8 }}
                      animate={{ y, scale, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      className="absolute w-full top-0 touch-none will-change-transform"
                      onPanEnd={isActive ? handlePanEnd : undefined}
                      style={{ 
                        zIndex,
                        pointerEvents: isActive ? 'auto' : 'none',
                        transformOrigin: 'top center'
                      }}
                    >
                      <RideCard 
                        mode="COMPACT"
                        request={req}
                        isActive={isActive}
                        driverLocation={driverLocation}
                        onAccept={(id) => {
                          onAccept(id);
                        }}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            );
          })()}
        </div>

        {/* Pagination Indicators - Elevated z-50 and mt-4 margin anchored 100% BELOW the lowest card edge */}
        {requests.length > 1 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-50 flex items-center gap-1.5 mt-4 bg-white/95 backdrop-blur-2xl px-3.5 py-1.5 rounded-full border border-black/10 shadow-xl"
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



