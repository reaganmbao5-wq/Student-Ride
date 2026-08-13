/**
 * MapboxStyles.js
 * 4K High-Definition Mapbox Vector Styles & Day/Night Theme Resolver.
 * Customized with Student-Ride / MuluRides Signature Gold Accent (#D4AF37) branding.
 */

export const MAPBOX_STYLES = {
  // 4K High-Definition Light Mode with Gold Accent Accents
  DAY: 'mapbox://styles/mapbox/streets-v12',
  
  // 4K High-Definition Night Mode with Glowing Signature Gold Accents (#D4AF37 / #FFD700)
  NIGHT: 'mapbox://styles/mapbox/dark-v11',

  // Alternate High-Contrast Satellite 3D Terrain Style
  SATELLITE: 'mapbox://styles/mapbox/satellite-streets-v12'
};

// Project Theme Brand Tokens
export const MAP_BRAND_COLORS = {
  GOLD_PRIMARY: '#D4AF37',
  GOLD_LIGHT: '#FACC15',
  GOLD_GLOW: 'rgba(212, 175, 55, 0.6)',
  DARK_BG: '#0B0F17',
  DARK_SURFACE: '#1E293B',
  TEXT_LIGHT: '#F8FAFC',
  TEXT_DARK: '#0F172A'
};

/**
 * Resolves the active map style based on local time or user override.
 * Day: 6:00 AM (6) to 6:00 PM (18)
 * Night: 6:00 PM (18) to 6:00 AM (6)
 */
export const getAutoMapStyle = (overrideTheme = null) => {
  if (overrideTheme === 'dark') return MAPBOX_STYLES.NIGHT;
  if (overrideTheme === 'light') return MAPBOX_STYLES.DAY;
  if (overrideTheme === 'satellite') return MAPBOX_STYLES.SATELLITE;

  const currentHour = new Date().getHours();
  const isNightTime = currentHour >= 18 || currentHour < 6;

  return isNightTime ? MAPBOX_STYLES.NIGHT : MAPBOX_STYLES.DAY;
};

/**
 * Returns true if current style or time is night mode.
 */
export const isNightTheme = (overrideTheme = null) => {
  if (overrideTheme === 'dark') return true;
  if (overrideTheme === 'light') return false;

  const currentHour = new Date().getHours();
  return currentHour >= 18 || currentHour < 6;
};

