import React, { useState, useRef, useLayoutEffect, cloneElement, useEffect } from 'react';

/**
 * An adaptive-width navigation bar with a "limelight" effect that highlights the active item.
 * Strictly matching 21st.dev original implementation with Accent Color System integration.
 */
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
    if (items.length === 0) return;

    const limelight = limelightRef.current;
    const activeItem = navItemRefs.current[activeIndex];
    
    if (limelight && activeItem) {
      const newLeft = activeItem.offsetLeft + activeItem.offsetWidth / 2 - limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;

      if (!isReady) {
        setTimeout(() => setIsReady(true), 50);
      }
    }
  }, [activeIndex, isReady, items]);

  if (items.length === 0) {
    return null; 
  }

  const handleItemClick = (index, itemOnClick) => {
    setActiveIndex(index);
    onTabChange?.(index);
    itemOnClick?.();
  };

  return (
    <nav className={`relative inline-flex items-center h-16 rounded-lg bg-card text-foreground border px-2 ${className}`}>
      {items.map(({ id, icon, label, onClick }, index) => (
        <a
          key={id}
          ref={el => (navItemRefs.current[index] = el)}
          className={`relative z-20 flex h-full cursor-pointer items-center justify-center p-5 ${iconContainerClassName}`}
          onClick={() => handleItemClick(index, onClick)}
          aria-label={label}
        >
          {cloneElement(icon, {
            className: `w-6 h-6 transition-opacity duration-100 ease-in-out ${
              activeIndex === index ? 'opacity-100' : 'opacity-40'
            } ${icon.props?.className || ''} ${iconClassName || ''}`,
          })}
        </a>
      ))}

      <div 
        ref={limelightRef}
        className={`absolute top-0 z-10 w-11 h-[5px] rounded-full ${
          isReady ? 'transition-[left] duration-400 ease-in-out' : ''
        } ${limelightClassName}`}
        style={{
          left: '-999px',
          backgroundColor: 'var(--color-accent, #EAB308)',
          boxShadow: '0 50px 15px var(--color-accent, #EAB308)'
        }}
      >
        <div 
          className="absolute left-[-30%] top-[5px] w-[160%] h-14 [clip-path:polygon(5%_100%,25%_0,75%_0,95%_100%)] pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, var(--color-accent, #EAB308) 30%, transparent 100%)'
          }}
        />
      </div>
    </nav>
  );
};
