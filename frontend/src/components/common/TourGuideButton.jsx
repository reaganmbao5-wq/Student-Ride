import React, { useState, useEffect, useCallback } from 'react';
import { Compass } from '@phosphor-icons/react';
import { useTheme } from '../../context/ThemeContext';
import { tourGuide } from '../../services/TourGuideService';

export const TourGuideButton = ({ tourType = 'student', requestStep = 'pickup', isShared = false, className = '' }) => {
  const { theme, accentColor, ACCENT_COLORS } = useTheme();
  const activeAccentHex = ACCENT_COLORS?.[accentColor]?.hex || '#3B82F6';
  const [isVisible, setIsVisible] = useState(false);

  const getStorageKey = useCallback(() => {
    switch (tourType) {
      case 'landing':
        return 'jride_tour_landing_seen';
      case 'driver':
        return 'jride_driver_tour_seen';
      case 'request':
        return `jride_tour_request_${requestStep}_seen`;
      case 'finding':
        return 'jride_tour_finding_seen';
      case 'activeRide':
        return 'jride_tour_active_seen';
      case 'student':
      default:
        return 'jride_student_tour_seen';
    }
  }, [tourType, requestStep]);

  useEffect(() => {
    const key = getStorageKey();
    const checkVisibility = () => {
      // If returning visitor or tour already seen, hide the button completely
      const isSeen = localStorage.getItem(key) === 'true' || 
                     (tourType === 'landing' && localStorage.getItem('jride_landing_tour_seen') === 'true');
      setIsVisible(!isSeen);
    };

    checkVisibility();

    // Listen for storage changes or tour completion events across the window
    window.addEventListener('storage', checkVisibility);
    window.addEventListener('jride_tour_completed', checkVisibility);
    return () => {
      window.removeEventListener('storage', checkVisibility);
      window.removeEventListener('jride_tour_completed', checkVisibility);
    };
  }, [getStorageKey, tourType]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (tourType === 'landing') {
      tourGuide.startLandingTour(activeAccentHex, theme);
    } else if (tourType === 'driver') {
      tourGuide.startDriverDashboardTour(activeAccentHex, theme);
    } else if (tourType === 'request') {
      tourGuide.startRideRequestTour(requestStep, activeAccentHex, theme);
    } else if (tourType === 'finding') {
      tourGuide.startFindingDriverTour(activeAccentHex, theme);
    } else if (tourType === 'activeRide') {
      tourGuide.startActiveRideTour(isShared, activeAccentHex, theme);
    } else {
      tourGuide.startStudentDashboardTour(activeAccentHex, theme);
    }
  };

  // If user is a returning visitor who has already experienced the tour, do not show the Tour button
  if (!isVisible) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all active:scale-95 shadow-sm cursor-pointer border ${className}`}
      style={{
        backgroundColor: `${activeAccentHex}18`,
        color: activeAccentHex,
        borderColor: `${activeAccentHex}40`
      }}
      title="Start Interactive Tour"
      aria-label="Start Interactive Tour"
    >
      <Compass size={16} weight="bold" />
      <span>Tour</span>
    </button>
  );
};

export default TourGuideButton;
