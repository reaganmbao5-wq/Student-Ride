import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GoldButton } from '../common/GlassComponents';
import { PlatformMap } from '../../map/components/PlatformMap';
import { CAMERA_MODES } from '../../map/camera/CameraConfig';
import { routeCache } from '../../map/route/RouteCache';
import { useAuth } from '../../context/AuthContext';

export const RideCard = ({
  mode = 'COMPACT', // 'FULL' or 'COMPACT'
  request,
  isActive = false, // specific to COMPACT mode's collapsible behavior
  onAccept,
  driverLocation = null
}) => {
  const { api } = useAuth();
  const [routeGeometry, setRouteGeometry] = useState(null);

  useEffect(() => {
    if (request?.pickup_location && request?.dropoff_location) {
      const cachedGeometry = routeCache.getRoute(request.pickup_location, request.dropoff_location);
      if (cachedGeometry) {
        setRouteGeometry(cachedGeometry);
        return;
      }
      
      api.post('/rides/estimate-fare', {
        pickup: request.pickup_location,
        dropoff: request.dropoff_location
      }).then(res => {
        if (res.data?.geometry) {
          setRouteGeometry(res.data.geometry);
          routeCache.setRoute(request.pickup_location, request.dropoff_location, res.data.geometry);
        }
      }).catch(err => console.error("Error fetching route for mini map:", err));
    }
  }, [request?.pickup_location, request?.dropoff_location, api]);

  if (!request) return null;

  const isShared = request.ride_mode === 'shared';
  const studentName = request.student_name || 'Guest';
  const price = request.fare?.toFixed(2) || '0.00';

  const formatAddress = (address) => {
    if (!address) return 'Unknown Location';
    const parts = address.split(',');
    if (parts.length <= 2) return address;
    return `${parts[0].trim()}, ${parts[1].trim()}`;
  };

  const handleAcceptClick = (e) => {
    e.stopPropagation();
    if (onAccept) onAccept(request.id);
  };

  const mapMarkers = [];
  const mapBounds = [];
  if (request.pickup_location) {
    mapMarkers.push({ lat: request.pickup_location.lat, lng: request.pickup_location.lng, iconType: 'pickup', key: 'pickup' });
    mapBounds.push([request.pickup_location.lat, request.pickup_location.lng]);
  }
  if (request.dropoff_location) {
    mapMarkers.push({ lat: request.dropoff_location.lat, lng: request.dropoff_location.lng, iconType: 'dropoff', key: 'dropoff' });
    mapBounds.push([request.dropoff_location.lat, request.dropoff_location.lng]);
  }
  
  const mapDrivers = driverLocation ? [{
    id: 'driver-self',
    latitude: driverLocation.lat,
    longitude: driverLocation.lng,
    heading: driverLocation.heading || 0
  }] : [];
  
  if (driverLocation) {
    mapBounds.push([driverLocation.lat, driverLocation.lng]);
  }

  return (
    <GlassCard className={`p-4 shadow-2xl border border-black/5 bg-white/80 dark:bg-zinc-900/90 dark:border-white/10 backdrop-blur-2xl relative overflow-hidden ${mode === 'FULL' ? 'w-full mb-3' : ''}`}>
      {mode === 'FULL' ? (
        <div className="flex flex-col">
          {/* Top layout: Information on LEFT, Mini Map on RIGHT */}
          <div className="flex justify-between items-stretch gap-4 mb-4">
            
            {/* LEFT: Information */}
            <div className="flex flex-col justify-between flex-1 overflow-hidden pr-2">
              <div>
                <p className="text-xl font-heading font-extrabold text-black dark:text-white line-clamp-1 drop-shadow-sm mb-3">
                  {studentName}
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">Pickup:</p>
                    <p className="text-[13px] font-bold text-black dark:text-white truncate">{formatAddress(request.pickup_location?.address)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">Destination:</p>
                    <p className="text-[13px] font-bold text-black dark:text-white truncate">{formatAddress(request.dropoff_location?.address)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[18px] text-zinc-900 dark:text-white font-extrabold tracking-tight">K{price}</p>
              </div>
            </div>

            {/* RIGHT: Mini Map & TAG */}
            <div className="w-[120px] flex flex-col items-end shrink-0">
              <div className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border mb-3 ${isShared ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30' : 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400 dark:border-purple-500/30'}`}>
                {isShared ? 'Shared' : 'Private'}
              </div>
              {/* REAL MINI MAP (RideMap as screenshot) */}
              <div className="w-full h-[120px] rounded-xl overflow-hidden pointer-events-none shadow-sm border border-black/10 dark:border-white/10 relative isolate">
                <PlatformMap 
                  className="w-full h-full"
                  interactive={false}
                  markers={mapMarkers}
                  drivers={mapDrivers}
                  bounds={mapBounds.length > 1 ? mapBounds : null}
                  cameraMode={CAMERA_MODES.OVERVIEW}
                  routeGeometry={routeGeometry}
                />
              </div>
            </div>
          </div>

          <GoldButton className="w-full py-3.5 text-[14px] font-extrabold shadow-none transition-transform active:scale-95 mt-1" onClick={handleAcceptClick}>
            Accept
          </GoldButton>
        </div>
      ) : (
        /* COMPACT Mode (Side Panel) */
        <div className="flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 overflow-hidden pr-2">
              <p className="text-xl font-heading font-extrabold text-black dark:text-white line-clamp-1 drop-shadow-sm">{studentName}</p>
              <p className="text-[16px] text-zinc-900 dark:text-white font-extrabold tracking-tight mt-0.5 mb-3">K{price}</p>
              
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">Pickup:</p>
                  <p className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200 truncate">{formatAddress(request.pickup_location?.address)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">Destination:</p>
                  <p className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200 truncate">{formatAddress(request.dropoff_location?.address)}</p>
                </div>
              </div>
            </div>
            
            <div className="w-[100px] flex flex-col items-end shrink-0">
              <div className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border mb-3 ${isShared ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30' : 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400 dark:border-purple-500/30'}`}>
                {isShared ? 'Shared' : 'Private'}
              </div>
              <div className="w-full h-[90px] rounded-xl overflow-hidden pointer-events-none shadow-sm border border-black/10 dark:border-white/10 relative isolate">
                <PlatformMap 
                  className="w-full h-full"
                  interactive={false}
                  markers={mapMarkers}
                  drivers={mapDrivers}
                  bounds={mapBounds.length > 1 ? mapBounds : null}
                  cameraMode={CAMERA_MODES.OVERVIEW}
                  routeGeometry={routeGeometry}
                />
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isActive && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
                  <GoldButton className="w-full py-3 text-[13px] font-extrabold shadow-none transition-transform active:scale-95" onClick={handleAcceptClick}>
                    Accept
                  </GoldButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </GlassCard>
  );
};
