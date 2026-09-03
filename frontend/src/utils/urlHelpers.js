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
  return `https://jaeyride.site${path}`;
};

export const getBackendUrl = (path = '') => {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl && envUrl !== 'undefined' && envUrl.trim() !== '') {
    return `${envUrl.replace(/\/$/, '')}${path}`;
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:8000${path}`;
    }
  }

  // Deployed production backend fallback URL
  return `https://jaey-ride-backend.onrender.com${path}`;
};

export const openExternalUrl = (path = '') => {
  const targetUrl = getOnlineWebUrl(path);
  if (typeof window !== 'undefined') {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Normalizes media, document, and avatar URLs so that legacy domains,
 * relative API paths, or misconfigured backend hosts always resolve
 * to the correct, working live backend instance.
 */
export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  // Replace legacy manual backend URL if present in legacy records
  if (url.includes('student-ride-backend-manual.onrender.com')) {
    url = url.replace('student-ride-backend-manual.onrender.com', 'student-ride-backend-dev.onrender.com');
  }

  // If URL is relative
  if (url.startsWith('/api')) {
    const base = getBackendUrl();
    return `${base}${url}`;
  }
  if (url.startsWith('/documents/')) {
    const base = getBackendUrl();
    return `${base}/api${url}`;
  }

  return url;
};
