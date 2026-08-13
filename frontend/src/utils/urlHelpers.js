/**
 * Helper to construct absolute online website URLs for external navigation.
 * Ensures terms of service and privacy policy links always open external web pages
 * rather than internal SPA routes, preserving app state (e.g., sign-up form data).
 */
export const getOnlineWebUrl = (path = '') => {
  const customWebUrl = process.env.REACT_APP_WEBSITE_URL;
  if (customWebUrl) {
    return `${customWebUrl.replace(/\/$/, '')}${path}`;
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    const isNativeOrLocal =
      origin.includes('localhost') ||
      origin.startsWith('capacitor://') ||
      origin.startsWith('file://') ||
      origin.startsWith('http://10.') ||
      origin.startsWith('http://192.168.');

    if (!isNativeOrLocal) {
      return `${origin}${path}`;
    }
  }

  // Deployed production website fallback URL
  return `https://student-ride-frontend-manual.onrender.com${path}`;
};

export const openExternalUrl = (path = '') => {
  const targetUrl = getOnlineWebUrl(path);
  if (typeof window !== 'undefined') {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
};
