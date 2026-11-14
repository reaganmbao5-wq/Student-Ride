/**
 * Operating hours utility for Jaey Ride (Zambia Time - Africa/Lusaka / CAT / UTC+2).
 * Operating hours: 06:00 AM to 07:30 PM (19:30).
 * Closed hours: 19:30 (7:30 PM) to 06:00 (6:00 AM).
 */

export const OPERATING_HOURS_COPY = {
  title: "Rides Closed for the Evening (19:30 – 06:00)",
  description:
    "Jaey Ride operates daily from 06:00 AM to 07:30 PM (19:30). Ride bookings are paused overnight so our drivers can rest and recharge safely. Please return during our working hours starting at 06:00 AM — we look forward to riding with you!",
  primaryLabel: "Back to Home",
  secondaryLabel: "View Ride History",
};

export function getLusakaTimeParts(now = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lusaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour")?.value;
    const minutePart = parts.find((p) => p.type === "minute")?.value;
    const hour = Number(hourPart) % 24;
    const minute = Number(minutePart);
    if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
      return { hour, minute };
    }
  } catch (e) {
    // Fallback to UTC+2 arithmetic
  }
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const lusakaDate = new Date(utcMs + 2 * 3600000);
  return {
    hour: lusakaDate.getHours(),
    minute: lusakaDate.getMinutes(),
  };
}

export function isOutsideOperatingHours(now = new Date()) {
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("after_hours") === "1") return true;
      if (params.get("after_hours") === "0") return false;
      if (window.localStorage?.getItem("JAEY_FORCE_AFTER_HOURS") === "true") {
        return true;
      }
    } catch (e) {
      // ignore storage/search access errors
    }
  }

  const { hour, minute } = getLusakaTimeParts(now);
  const totalMinutes = hour * 60 + minute;
  const openMinutes = 6 * 60; // 06:00 AM (360)
  const closeMinutes = 19 * 60 + 30; // 07:30 PM / 19:30 (1170)

  return totalMinutes >= closeMinutes || totalMinutes < openMinutes;
}
