import L from 'leaflet';

// Base styling for the vehicle to look like a modern ride-hailing car
const createVehicleHtml = (color) => `
  <div style="
    width: 20px;
    height: 40px;
    background-color: ${color};
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    position: relative;
    border: 2px solid white;
  ">
    <!-- Windshield -->
    <div style="
      position: absolute;
      top: 10px;
      left: 2px;
      right: 2px;
      height: 8px;
      background-color: #333;
      border-radius: 2px;
    "></div>
    <!-- Rear Window -->
    <div style="
      position: absolute;
      bottom: 8px;
      left: 2px;
      right: 2px;
      height: 4px;
      background-color: #333;
      border-radius: 1px;
    "></div>
  </div>
`;

export const VehicleIcons = {
  ONLINE: L.divIcon({
    html: createVehicleHtml('#2563EB'), // Blue for online/available
    className: 'custom-vehicle-icon',
    iconSize: [24, 44],
    iconAnchor: [12, 22],
  }),
  BUSY: L.divIcon({
    html: createVehicleHtml('#F59E0B'), // Amber/Yellow for busy
    className: 'custom-vehicle-icon',
    iconSize: [24, 44],
    iconAnchor: [12, 22],
  }),
  OFFLINE: L.divIcon({
    html: createVehicleHtml('#9CA3AF'), // Gray for offline
    className: 'custom-vehicle-icon',
    iconSize: [24, 44],
    iconAnchor: [12, 22],
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
