import React from 'react';
import VehicleAnimator from './VehicleAnimator';

/**
 * VehicleEngine.jsx
 * The top-level manager for all vehicles on the map.
 * Receives the array of drivers from WebSockets/API and renders an Animator for each.
 */
const VehicleEngine = ({ drivers = [] }) => {
  return (
    <>
      {drivers.map((driver) => (
        <VehicleAnimator key={driver.id} driver={driver} />
      ))}
    </>
  );
};

export default React.memo(VehicleEngine);
