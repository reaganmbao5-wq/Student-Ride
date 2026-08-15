import React from 'react';
import VehicleRenderer from './VehicleRenderer';

/**
 * VehicleEngine.jsx
 * Native Mapbox GL JS 3D Vehicle Pool Manager.
 * Renders high-performance Mapbox vehicle markers for all active drivers.
 */
const VehicleEngine = ({ map, drivers = [] }) => {
  if (!map) return null;

  return (
    <>
      {drivers.map((driver) => (
        <VehicleRenderer key={driver.id || driver._id} map={map} driver={driver} />
      ))}
    </>
  );
};

export default React.memo(VehicleEngine);
