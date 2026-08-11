import React, { useState, useRef, useLayoutEffect, cloneElement, useEffect } from 'react';

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
  const [isReady, setIsReady] = useState(false);
  const navItemRefs = useRef([]);
  const limelightRef = useRef(null);

  useEffect(() => {
    if (defaultActiveIndex !== undefined && defaultActiveIndex !== null) {
      setActiveIndex(defaultActiveIndex);
    }
  }, [defaultActiveIndex]);

  useLayoutEffect(() => {
    if (!items || items.length === 0) return;

    const limelight = limelightRef.current;
    const activeItem = navItemRefs.current[activeIndex];
    
    if (limelight && activeItem) {
      const newLeft = activeItem.offsetLeft + activeItem.offsetWidth / 2 - limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;

      if (!isReady) {
        const timer = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(timer);
      }
    }
  }, [activeIndex, isReady, items]);

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
            className: `w-6 h-6 transition-all duration-200 ease-in-out ${
              activeIndex === index ? 'opacity-100 scale-110' : 'opacity-40 text-zinc-400 hover:opacity-70'
            } ${icon.props?.className || ''} ${iconClassName || ''}`,
          })}
        </a>
      ))}

      <div 
        ref={limelightRef}
        className={`absolute top-0 z-10 w-10 h-[4px] rounded-full ${
          isReady ? 'transition-[left] duration-[780ms] ease-in-out' : ''
        } ${limelightClassName}`}
        style={{
          left: '-999px',
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
      </div>
    </nav>
  );
};
