import L from 'leaflet';

// Real top-down car PNG asset (/car_top.png) scaled 2x (48px x 88px) with drop shadow
const createVehicleHtml = (glowColor) => `
  <div style="
    width: 48px;
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  ">
    <img src="/car_top.png" alt="Driver Car" style="
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 4px 10px ${glowColor});
      transform: rotate(180deg);
    " />
  </div>
`;

export const VehicleIcons = {
  ONLINE: L.divIcon({
    html: createVehicleHtml('rgba(37,99,235,0.6)'), // Blue glow for available
    className: 'custom-vehicle-icon',
    iconSize: [48, 88],
    iconAnchor: [24, 44],
  }),
  BUSY: L.divIcon({
    html: createVehicleHtml('rgba(245,158,11,0.6)'), // Amber/Gold glow for busy
    className: 'custom-vehicle-icon',
    iconSize: [48, 88],
    iconAnchor: [24, 44],
  }),
  OFFLINE: L.divIcon({
    html: createVehicleHtml('rgba(156,163,175,0.4)'), // Gray glow for offline
    className: 'custom-vehicle-icon',
    iconSize: [48, 88],
    iconAnchor: [24, 44],
  })
};

// Factory function for dynamic icons in the future (EV, Bike, etc.)
export const getVehicleIcon = (status = 'online') => {
  switch (status.toLowerCase()) {
    case 'busy': return VehicleIcons.BUSY;
    case 'offline': return VehicleIcons.OFFLINE;
    case 'online':
    default:
      return VehicleIcons.ONLINE;
  }
};
