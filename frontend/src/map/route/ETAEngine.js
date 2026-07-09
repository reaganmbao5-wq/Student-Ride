/**
 * ETAEngine.js
 * Calculates and smooths dynamic ETA based on distance remaining.
 */

export class ETAEngine {
  constructor(averageSpeedKmh = 30) {
    this.averageSpeedKmh = averageSpeedKmh;
    this.lastCalculatedEtaMins = null;
    this.lastCalculationTime = null;
  }

  /**
   * Calculates the estimated time of arrival (ETA) in minutes
   * given a remaining distance in km.
   * 
   * @param {number} distanceKm 
   * @returns {number} ETA in minutes
   */
  calculateETA(distanceKm) {
    if (distanceKm <= 0) return 0;
    
    // Time = Distance / Speed
    // distance is in km, speed is in km/h -> time is in hours
    const timeHours = distanceKm / this.averageSpeedKmh;
    const timeMins = timeHours * 60;

    return timeMins;
  }

  /**
   * Formats ETA into a human-readable string with smoothing to prevent jitter.
   * 
   * @param {number} distanceKm 
   * @returns {string} e.g. "5 min"
   */
  getFormattedETA(distanceKm) {
    const rawEta = this.calculateETA(distanceKm);
    
    // Smooth the ETA. Don't jump drastically unless significant distance changes
    if (this.lastCalculatedEtaMins === null) {
      this.lastCalculatedEtaMins = rawEta;
    } else {
      // Very basic exponential smoothing (alpha = 0.3)
      this.lastCalculatedEtaMins = (0.3 * rawEta) + (0.7 * this.lastCalculatedEtaMins);
    }

    const roundedEta = Math.ceil(this.lastCalculatedEtaMins);
    
    if (roundedEta <= 0) return "Arriving";
    if (roundedEta === 1) return "1 min";
    return `${roundedEta} min`;
  }
}

// Export a singleton instance for standard usage
export const etaEngine = new ETAEngine();
