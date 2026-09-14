import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const LaunchSplashTransition = ({ onFinish }) => {
  const [phase, setPhase] = useState('center'); // 'center' -> 'flying' -> 'done'
  const [shouldRender, setShouldRender] = useState(true);
  const [destCoords, setDestCoords] = useState(null);

  useEffect(() => {
    // Only run on fresh cold start (once per session)
    if (sessionStorage.getItem('jride_splash_seen')) {
      setShouldRender(false);
      if (onFinish) onFinish();
      return;
    }

    const measureDestination = () => {
      const headerLogo = document.getElementById('header-jride-logo');
      if (headerLogo) {
        const rect = headerLogo.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDestCoords({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          });
        }
      }
    };

    measureDestination();
    const raf = requestAnimationFrame(measureDestination);

    // Step 1: Hold in dead center with subtle monochrome gradient shimmer
    const flyTimer = setTimeout(() => {
      measureDestination();
      setPhase('flying');
    }, 450);

    // Step 2: Complete flight and hand-off to page header
    const doneTimer = setTimeout(() => {
      setPhase('done');
      sessionStorage.setItem('jride_splash_seen', 'true');
      if (onFinish) onFinish();
    }, 950);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(flyTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  if (!shouldRender || phase === 'done') return null;

  return (
    <AnimatePresence>
      <motion.div
        key="splash-overlay"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        className="fixed inset-0 z-[99999] bg-[#000000] pointer-events-none overflow-hidden select-none"
      >
        {/* Animated Flying Logo Container */}
        <motion.div
          initial={{
            top: '50%',
            left: '50%',
            x: '-50%',
            y: '-50%',
            scale: 1,
            opacity: 1
          }}
          animate={
            phase === 'flying'
              ? (destCoords
                  ? {
                      top: destCoords.top,
                      left: destCoords.left,
                      x: 0,
                      y: 0,
                      scale: 1,
                      opacity: 1
                    }
                  : {
                      top: '1rem',
                      left: '1.25rem',
                      x: 0,
                      y: 0,
                      scale: 1,
                      opacity: 1
                    }
                )
              : {
                  top: '50%',
                  left: '50%',
                  x: '-50%',
                  y: '-50%',
                  scale: 1,
                  opacity: 1
                }
          }
          transition={{
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1] // Apple-grade cubic-bezier fluid curve
          }}
          className="absolute flex items-center justify-center"
        >
          {/* Logo with Monochrome Silver/White Gradient Shine */}
          <div className="relative inline-block">
            <img
              src="/assets/images/jride_text_white.png"
              alt="JRide"
              className="h-8 sm:h-11 md:h-13 lg:h-15 w-auto object-contain select-none block"
            />
            {/* Subtle monochrome light sweep across the logo */}
            <motion.div
              initial={{ x: '-120%', opacity: 0 }}
              animate={{ x: '160%', opacity: [0, 0.65, 0] }}
              transition={{ duration: 0.65, delay: 0.08, ease: 'easeInOut' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LaunchSplashTransition;
