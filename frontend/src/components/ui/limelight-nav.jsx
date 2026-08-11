import React, { useState, useRef, useLayoutEffect, cloneElement, useEffect } from 'react';
import { motion } from 'framer-motion';

export const LimelightNav = ({
  items = [],
  defaultActiveIndex = 0,
  onTabChange,
  className = '',
  limelightClassName = '',
  iconContainerClassName = '',
  iconClassName = '',
}) => {
  const [activeIndex, setActiveIndex] = useState(defaultActiveIndex);
  const [leftPos, setLeftPos] = useState(-999);
  const [isReady, setIsReady] = useState(false);
  const navItemRefs = useRef([]);

  useEffect(() => {
    if (defaultActiveIndex !== undefined && defaultActiveIndex !== null) {
      setActiveIndex(defaultActiveIndex);
    }
  }, [defaultActiveIndex]);

  useLayoutEffect(() => {
    if (!items || items.length === 0) return;

    const activeItem = navItemRefs.current[activeIndex];
    
    if (activeItem) {
      // Position center of 40px (w-10) spotlight over the middle of the active icon button
      const newLeft = activeItem.offsetLeft + activeItem.offsetWidth / 2 - 20;
      setLeftPos(newLeft);

      if (!isReady) {
        setIsReady(true);
      }
    }
  }, [activeIndex, items, isReady]);

  if (!items || items.length === 0) {
    return null; 
  }

  const handleItemClick = (index, itemOnClick) => {
    setActiveIndex(index);
    onTabChange?.(index);
    itemOnClick?.();
  };

  return (
    <nav className={`relative inline-flex items-center h-16 rounded-full bg-zinc-950/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-white/10 px-3 shadow-2xl ${className}`}>
      {items.map(({ id, icon, label, onClick }, index) => (
        <a
          key={id}
          ref={el => (navItemRefs.current[index] = el)}
          className={`relative z-20 flex h-full cursor-pointer items-center justify-center px-4 py-2 ${iconContainerClassName}`}
          onClick={() => handleItemClick(index, onClick)}
          aria-label={label}
        >
          {cloneElement(icon, {
            className: `w-6 h-6 transition-all duration-300 ease-in-out ${
              activeIndex === index ? 'opacity-100 scale-110' : 'opacity-40 text-zinc-400 hover:opacity-70'
            } ${icon.props?.className || ''} ${iconClassName || ''}`,
          })}
        </a>
      ))}

      {isReady && leftPos > -500 && (
        <motion.div 
          initial={false}
          animate={{ x: leftPos }}
          transition={{
            duration: 1.3,
            ease: [0.16, 1, 0.3, 1], // Smooth liquid deceleration curve
          }}
          className={`absolute top-0 left-0 z-10 w-10 h-[4px] rounded-full ${limelightClassName}`}
          style={{
            backgroundColor: 'var(--color-accent, #EAB308)',
            boxShadow: '0 8px 20px var(--color-accent, #EAB308)'
          }}
        >
          <div 
            className="absolute left-[-35%] top-[4px] w-[170%] h-12 [clip-path:polygon(10%_100%,30%_0,70%_0,90%_100%)] pointer-events-none" 
            style={{
              background: 'linear-gradient(to bottom, var(--color-accent, #EAB308) 0%, transparent 100%)',
              opacity: 0.4
            }}
          />
        </motion.div>
      )}
    </nav>
  );
};
