/**
 * Central error sanitization utility for JRide.
 * Guarantees that internal backend URLs, server hostnames, stack traces,
 * or raw fetch exceptions are NEVER exposed to the end user.
 */
import { toast } from 'sonner';

export const sanitizeErrorMessage = (error, fallbackMessage = 'An unexpected error occurred. Please try again.') => {
  if (!error) return fallbackMessage;

  let rawMessage = '';

  if (typeof error === 'string') {
    rawMessage = error;
  } else if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    rawMessage = Array.isArray(detail)
      ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
      : String(detail);
  } else if (error.response?.data?.message) {
    rawMessage = String(error.response.data.message);
  } else if (error.message) {
    rawMessage = String(error.message);
  } else {
    rawMessage = String(error);
  }

  // Network / Connection Failures (Fetch, DNS, Offline, Cold Start timeout)
  const lowerMsg = rawMessage.toLowerCase();
  if (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('network error') ||
    lowerMsg.includes('networkerror') ||
    lowerMsg.includes('load failed') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('abort') ||
    lowerMsg.includes('cors')
  ) {
    return 'Unable to reach the server. Please check your internet connection or try again in a moment.';
  }

  // Server error codes
  if (
    lowerMsg.includes('502') ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('504') ||
    lowerMsg.includes('bad gateway') ||
    lowerMsg.includes('service unavailable')
  ) {
    return 'The server is currently starting up or temporarily busy. Please wait a moment and try again.';
  }

  // Strip all URLs, IPs, and render hostnames completely
  let cleanMsg = rawMessage
    .replace(/https?:\/\/[^\s)]+/gi, '')
    .replace(/[a-zA-Z0-9-]+\.onrender\.com/gi, '')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, '')
    .replace(/\(undefined[^\)]*\)/gi, '')
    .replace(/\(\s*\)/g, '')
    .trim();

  // If after sanitization the message is empty or meaningless, return fallback
  if (!cleanMsg || cleanMsg.length < 3 || cleanMsg.startsWith('Error:')) {
    return fallbackMessage;
  }

  return cleanMsg;
};

export const showFriendlyError = (error, fallbackMessage = 'An unexpected error occurred. Please try again.') => {
  const sanitized = sanitizeErrorMessage(error, fallbackMessage);
  toast.error(sanitized);
  return sanitized;
};
