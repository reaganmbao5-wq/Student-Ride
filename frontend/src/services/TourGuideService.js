import { driver } from 'driver.js';
import '../styles/driver-theme.css';

export const getPlatformInfo = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isDesktop = !isIOS && !isAndroid;
  return { isIOS, isAndroid, isDesktop };
};

class TourGuideService {
  constructor() {
    this.activeDriver = null;
  }

  applyThemeVariables(accentHex = '#3B82F6', theme = 'dark') {
    const root = document.documentElement;
    root.style.setProperty('--driver-accent', accentHex);
    root.style.setProperty('--driver-accent-light', `${accentHex}20`);

    if (theme === 'light') {
      root.style.setProperty('--driver-bg', '#ffffff');
      root.style.setProperty('--driver-text', '#09090b');
      root.style.setProperty('--driver-subtext', '#52525b');
      root.style.setProperty('--driver-border', 'rgba(0, 0, 0, 0.10)');
    } else {
      root.style.setProperty('--driver-bg', '#121214');
      root.style.setProperty('--driver-text', '#f4f4f5');
      root.style.setProperty('--driver-subtext', '#a1a1aa');
      root.style.setProperty('--driver-border', 'rgba(255, 255, 255, 0.12)');
    }
  }

  createDriverInstance(steps, onComplete) {
    if (this.activeDriver) {
      try {
        this.activeDriver.destroy();
      } catch (e) {}
    }

    const availableSteps = steps.filter(s => {
      if (!s.element) return true;
      const el = document.querySelector(s.element);
      return Boolean(el);
    });

    if (availableSteps.length === 0) return null;

    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      stagePadding: 6,
      stageRadius: 12,
      overlayColor: '#000000',
      overlayOpacity: 0.75,
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Done',
      onDestroyed: () => {
        this.activeDriver = null;
        if (onComplete) onComplete();
        try {
          window.dispatchEvent(new Event('jride_tour_completed'));
        } catch (e) {}
      },
      steps: availableSteps
    });

    this.activeDriver = d;
    return d;
  }

  // 1. Landing Page Tour
  startLandingTour(accentHex = '#3B82F6', theme = 'dark') {
    this.applyThemeVariables(accentHex, theme);
    const { isIOS, isAndroid } = getPlatformInfo();

    const apkTitle = isAndroid 
      ? 'Official Android App' 
      : isIOS 
      ? 'Official Mobile App' 
      : 'Campus Web App';

    const apkDesc = isAndroid
      ? 'Download the APK for native lockscreen notifications, background trip alerts, and instant emergency SOS access.'
      : isIOS
      ? 'Add JRide to your Home Screen for fast one-tap campus ride access and full-screen experience.'
      : 'Request fast, safe campus rides directly from your browser across all university zones.';

    const steps = [
      {
        element: '#tour-landing-headline',
        popover: {
          title: 'Welcome to JRide',
          description: 'The smart, affordable, and safe way for students and staff to move around campus.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-landing-cta',
        popover: {
          title: 'One-Tap Get Started',
          description: 'Tap here to sign up or log in with your university student email and start requesting rides.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#tour-landing-apk',
        popover: {
          title: apkTitle,
          description: apkDesc,
          side: 'top',
          align: 'center'
        }
      }
    ];

    const d = this.createDriverInstance(steps, () => {
      localStorage.setItem('jride_tour_landing_seen', 'true');
      localStorage.setItem('jride_landing_tour_seen', 'true');
    });

    if (d) d.drive();
  }

  // 2. Onboarding Steps Tour
  startOnboardingTour(step, accentHex = '#3B82F6', theme = 'dark') {
    this.applyThemeVariables(accentHex, theme);

    let steps = [];
    if (step === 2) {
      steps = [
        {
          element: '#tour-onboarding-details',
          popover: {
            title: 'Your Name',
            description: 'Enter your first and last name so drivers and campus dispatch can identify you.',
            side: 'bottom',
            align: 'center'
          }
        }
      ];
    } else if (step === 3) {
      steps = [
        {
          element: '#tour-onboarding-role',
          popover: {
            title: 'Profile Identification',
            description: 'Select your gender for profile identification and campus ride safety.',
            side: 'bottom',
            align: 'center'
          }
        }
      ];
    } else if (step === 4) {
      steps = [
        {
          element: '#tour-onboarding-theme',
          popover: {
            title: 'Personalize Your Experience',
            description: 'Choose high-contrast Daylight or Midnight Vector dark mode, and pick your favorite accent color.',
            side: 'bottom',
            align: 'center'
          }
        }
      ];
    } else if (step === 5) {
      steps = [
        {
          element: '#tour-onboarding-auth',
          popover: {
            title: 'University Sign In',
            description: 'Sign in securely with your student Google account or email to enter your dashboard.',
            side: 'bottom',
            align: 'center'
          }
        }
      ];
    }

    if (steps.length === 0) return;

    const d = this.createDriverInstance(steps, () => {
      localStorage.setItem(`jride_tour_onboarding_step_${step}_seen`, 'true');
    });

    if (d) d.drive();
  }

  // 3. Student Dashboard Tour (Home)
  startStudentDashboardTour(accentHex = '#3B82F6', theme = 'dark') {
    this.applyThemeVariables(accentHex, theme);

    const steps = [
      {
        element: '#tour-student-request-btn',
        popover: {
          title: 'Request a Ride',
          description: 'Tap to select your pickup point and campus destination. You can choose a private ride or join a shared pool.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#tour-student-stats',
        popover: {
          title: 'Campus Wait Time & Stats',
          description: 'See live average driver wait times and your overall ride history at a glance.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-student-recent',
        popover: {
          title: 'Recent Rides & Receipts',
          description: 'Review previous trips, check fare receipts, and rate your drivers for quality service.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#tour-bottom-nav',
        popover: {
          title: 'Quick Navigation',
          description: 'Switch between the Home dashboard, Active Ride, Trip History, and Your Account Settings.',
          side: 'top',
          align: 'center'
        }
      }
    ];

    const d = this.createDriverInstance(steps, () => {
      localStorage.setItem('jride_student_tour_seen', 'true');
    });

    if (d) d.drive();
  }

  // 4. Ride Request Page Tour
  startRideRequestTour(requestStep = 'pickup', accentHex = '#3B82F6', theme = 'dark') {
    this.applyThemeVariables(accentHex, theme);

    let steps = [];
    if (requestStep === 'pickup') {
      steps = [
        {
          element: '#tour-pickup-search',
          popover: {
            title: 'Search Pickup Point',
            description: 'Type your hostel, campus building, or gate here to search campus pickup places instantly.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-map-pin',
          popover: {
            title: 'Manual Pin Placement',
            description: 'You can also drag the map directly to drop your pickup pin at your exact doorway or landmark.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#tour-gps-button',
          popover: {
            title: 'Instant GPS Centering',
            description: 'Tap this button anytime to center the map marker directly on your current GPS location.',
            side: 'left',
            align: 'center'
          }
        },
        {
          element: '#tour-confirm-pickup-btn',
          popover: {
            title: 'Confirm Pickup Point',
            description: 'Tap here once your pickup pin is positioned where you want the driver to meet you.',
            side: 'top',
            align: 'center'
          }
        }
      ];
    } else if (requestStep === 'dropoff') {
      steps = [
        {
          element: '#tour-destination-search',
          popover: {
            title: 'Search Destination',
            description: 'Type your destination hostel, library, or campus gate, or drag the map to set the dropoff pin.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-confirm-destination-btn',
          popover: {
            title: 'Confirm Destination',
            description: 'Tap here to lock in your destination and view pricing and ride mode options.',
            side: 'top',
            align: 'center'
          }
        }
      ];
    } else if (requestStep === 'confirm') {
      steps = [
        {
          element: '#tour-ride-mode-toggle',
          popover: {
            title: 'Shared vs Private Ride',
            description: 'Tap or swipe this card to toggle between Shared Pooling (discounted fare, save up to 30%) and Private Ride (exclusive vehicle).',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#tour-ride-pricing',
          popover: {
            title: 'Transparent Pricing & ETA',
            description: 'See your estimated travel time, distance, and locked-in ride fare before sending the request.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#tour-request-ride-btn',
          popover: {
            title: 'Dispatch Ride Request',
            description: 'Tap here to send your ride request out to all available nearby campus drivers.',
            side: 'top',
            align: 'center'
          }
        }
      ];
    }

    if (steps.length === 0) return;

    const d = this.createDriverInstance(steps, () => {
      localStorage.setItem(`jride_tour_request_${requestStep}_seen`, 'true');
    });

    if (d) d.drive();
  }

  // 5. Finding a Driver Tour
  startFindingDriverTour(accentHex = '#3B82F6', theme = 'dark') {
    this.applyThemeVariables(accentHex, theme);

    const steps = [
      {
        element: '#tour-student-active-map',
        popover: {
          title: 'Pairing With Driver',
          description: 'Please wait a couple of minutes as our intelligent dispatch system pairs you with the closest available nearby driver.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#tour-student-bottom-sheet',
        popover: {
          title: 'Ride Request Status',
          description: 'You can view the active dispatch radar here or cancel the request if your plans change.',
          side: 'top',
          align: 'center'
        }
      }
    ];

    const d = this.createDriverInstance(steps, () => {
      localStorage.setItem('jride_tour_finding_seen', 'true');
    });

    if (d) d.drive();
  }

  // 6. Active Ride Tour
  startActiveRideTour(isShared = false, accentHex = '#3B82F6', theme = 'dark') {
    this.applyThemeVariables(accentHex, theme);

    const mapDesc = isShared
      ? 'Your pickup and dropoff points are marked on the map. For shared pooled rides, other students along the route will also appear with distinct colored pins.'
      : 'Your pickup and destination route is tracked live on the map. Watch your assigned driver vehicle approach in real-time.';

    const steps = [
      {
        element: '#tour-student-active-map',
        popover: {
          title: 'Live Trip Map',
          description: mapDesc,
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#tour-student-bottom-sheet',
        popover: {
          title: 'Driver & Safety Controls',
          description: 'Swipe up this bottom sheet anytime to view your driver’s photo, car plate, live ETA, call your driver, or trigger Emergency SOS.',
          side: 'top',
          align: 'center'
        }
      }
    ];

    const d = this.createDriverInstance(steps, () => {
      localStorage.setItem('jride_tour_active_seen', 'true');
    });

    if (d) d.drive();
  }

  // 7. Driver Dashboard Tour
  startDriverDashboardTour(accentHex = '#3B82F6', theme = 'dark') {
    this.applyThemeVariables(accentHex, theme);

    const steps = [
      {
        element: '#tour-driver-slide-btn',
        popover: {
          title: 'Go Online / Offline',
          description: 'Swipe right on this slider to start your shift and begin receiving student ride dispatches.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#tour-driver-route-queue',
        popover: {
          title: 'Multi-Passenger Queue',
          description: 'When pooled rides are active, your pickup and dropoff stops are automatically ordered here.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#tour-driver-earnings',
        popover: {
          title: 'Earnings & Driver Wallet',
          description: 'Track your daily fares, completed rides, and student passenger review ratings.',
          side: 'bottom',
          align: 'center'
        }
      }
    ];

    const d = this.createDriverInstance(steps, () => {
      localStorage.setItem('jride_driver_tour_seen', 'true');
    });

    if (d) d.drive();
  }

  // 8. Driver Incoming Request Tour
  startDriverIncomingRequestTour(accentHex = '#3B82F6', theme = 'dark') {
    this.applyThemeVariables(accentHex, theme);

    const steps = [
      {
        element: '#tour-driver-incoming-card',
        popover: {
          title: 'Incoming Ride Request',
          description: 'Review the student’s pickup location, destination, trip distance, and calculated fare, then tap Accept to claim the ride.',
          side: 'bottom',
          align: 'center'
        }
      }
    ];

    const d = this.createDriverInstance(steps, () => {
      localStorage.setItem('jride_tour_driver_request_seen', 'true');
    });

    if (d) d.drive();
  }
}

export const tourGuide = new TourGuideService();
