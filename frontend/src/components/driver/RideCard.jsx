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
  const [routeGeometry, setRouteGeometry] = useState(request?.verified_geometry || null);

  useEffect(() => {
    if (request?.verified_geometry && Array.isArray(request.verified_geometry) && request.verified_geometry.length > 2) {
      setRouteGeometry(request.verified_geometry);
      return;
    }
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
  }, [request?.pickup_location, request?.dropoff_location, request?.verified_geometry, api]);

  if (!request) return null;

  const isShared = !request.ride_mode || String(request.ride_mode).toLowerCase() === 'shared';
  const studentName = request.student?.name || request.student_name || request.user_name || request.student?.full_name || request.user?.name || request.name || 'Student';
  const rawFare = request.fare ?? request.calculated_fare ?? request.price ?? request.amount ?? 0;
  const price = Number(rawFare).toFixed(2);

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
  
  const mapCenter = request.pickup_location || request.dropoff_location || { lat: -14.2976, lng: 28.5564 };

  return (
    <GlassCard className={`shadow-2xl border border-border bg-card/95 backdrop-blur-2xl relative overflow-hidden ${mode === 'FULL' ? 'w-full mb-3 p-4' : 'p-3.5'}`}>
      {mode === 'FULL' ? (
        <div className="flex flex-col">
          {/* Top layout: Information on LEFT, Mini Map on RIGHT */}
          <div className="flex justify-between items-stretch gap-4 mb-4">
            
            {/* LEFT: Information */}
            <div className="flex flex-col justify-between flex-1 overflow-hidden pr-2">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xl font-heading font-extrabold text-foreground line-clamp-1 drop-shadow-sm">
                    {studentName}
                  </p>
                  {(request.student?.role === 'lecturer' || request.passenger_role === 'lecturer' || request.role === 'lecturer') && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30">
                      Lecturer
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pickup:</p>
                    <p className="text-[13px] font-bold text-foreground truncate">{formatAddress(request.pickup_location?.address)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Destination:</p>
                    <p className="text-[13px] font-bold text-foreground truncate">{formatAddress(request.dropoff_location?.address)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[18px] text-foreground font-extrabold tracking-tight">K{price}</p>
              </div>
            </div>

            {/* RIGHT: Mini Map & TAG */}
            <div className="w-[120px] flex flex-col items-end shrink-0">
              <div className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border mb-3 ${isShared ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30' : 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400 dark:border-purple-500/30'}`}>
                {isShared ? 'Shared' : 'Private'}
              </div>
              {/* REAL MINI MAP */}
              <div className="w-full h-[120px] rounded-xl overflow-hidden pointer-events-none shadow-sm border border-border relative isolate">
                <PlatformMap 
                  className="w-full h-full"
                  interactive={false}
                  center={mapCenter}
                  markers={mapMarkers}
                  drivers={[]}
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
        /* COMPACT Mode (Side Panel) - 10-15% More Compact Footprint */
        <div className="flex flex-col">
          <div className="flex justify-between items-start mb-2.5">
            <div className="flex-1 overflow-hidden pr-2">
              <div className="flex items-center gap-1.5">
                <p className="text-lg font-heading font-extrabold text-foreground line-clamp-1 drop-shadow-sm">{studentName}</p>
                {(request.student?.role === 'lecturer' || request.passenger_role === 'lecturer' || request.role === 'lecturer') && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30 shrink-0">
                    Lecturer
                  </span>
                )}
              </div>
              <p className="text-[15px] text-foreground font-extrabold tracking-tight mt-0.5 mb-2">K{price}</p>
              
              <div className="flex flex-col gap-1.5">
                <div>
                  <p className="text-[9.5px] uppercase font-bold text-muted-foreground tracking-wider">Pickup:</p>
                  <p className="text-[11.5px] font-bold text-foreground truncate">{formatAddress(request.pickup_location?.address)}</p>
                </div>
                <div>
                  <p className="text-[9.5px] uppercase font-bold text-muted-foreground tracking-wider">Destination:</p>
                  <p className="text-[11.5px] font-bold text-foreground truncate">{formatAddress(request.dropoff_location?.address)}</p>
                </div>
              </div>
            </div>
            
            <div className="w-[92px] flex flex-col items-end shrink-0">
              <div className={`text-[9.5px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border mb-2 ${isShared ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30' : 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400 dark:border-purple-500/30'}`}>
                {isShared ? 'Shared' : 'Private'}
              </div>
              <div className="w-full h-[82px] rounded-xl overflow-hidden pointer-events-none shadow-sm border border-border relative isolate">
                <PlatformMap 
                  className="w-full h-full"
                  interactive={false}
                  center={mapCenter}
                  markers={mapMarkers}
                  drivers={[]}
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
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 pt-2.5 border-t border-border">
                  <GoldButton className="w-full py-2.5 text-[12.5px] font-extrabold shadow-none transition-transform active:scale-95" onClick={handleAcceptClick}>
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
