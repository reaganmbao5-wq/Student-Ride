import React, { useState, useMemo } from 'react';
import { 
  Clock, Star, Car, CaretDown, CaretUp, Trash, ArrowRight 
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBadge } from './GlassComponents';
import { haptics } from '../../utils/haptics';

export const SwipableRideCard = ({ 
  ride, 
  isExpanded, 
  onToggleExpand, 
  onDeleteClick, 
  onRateClick, 
  isDriver 
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const formattedDate = useMemo(() => {
    return new Date(ride.created_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [ride.created_at]);

  const fareAmount = isDriver ? ride.driver_earning : ride.fare;

  // Dynamically calculate opacity of red delete panel (0 when resting, 1 when swiped)
  const deleteOpacity = Math.min(1, Math.abs(swipeOffset) / 35);

  return (
    <div 
      className="relative overflow-hidden border-b border-white/10 w-full transition-colors last:border-b-0" 
      data-testid={`history-ride-${ride.id}`}
    >
      {/* Background Action: Revealed ONLY when sliding left */}
      <motion.div 
        animate={{ opacity: deleteOpacity }}
        transition={{ duration: 0.15 }}
        className={`absolute inset-y-0 right-0 w-24 bg-red-600 flex items-center justify-center z-0 ${
          swipeOffset < -5 ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.deleteThreshold();
            if (onDeleteClick) onDeleteClick(ride);
          }}
          className="flex flex-col items-center justify-center gap-1 w-full h-full text-white font-medium hover:bg-red-700 transition-colors cursor-pointer"
          title="Delete Ride"
        >
          <Trash weight="duotone" className="w-5 h-5 text-white" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
        </button>
      </motion.div>

      {/* Foreground Draggable & Flat Collapsible Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -90, right: 0 }}
        dragElastic={0.05}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(e, info) => {
          setTimeout(() => setIsDragging(false), 150);
          if (info.offset.x < -30) {
            setSwipeOffset(-90);
            haptics.deleteThreshold();
          } else {
            setSwipeOffset(0);
          }
        }}
        animate={{ x: swipeOffset }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`relative z-10 w-full bg-neutral-950/80 hover:bg-neutral-900/60 transition-colors ${
          isExpanded ? 'bg-neutral-900/90' : ''
        }`}
      >
        {/* Collapsed Item Summary View */}
        <div
          onClick={(e) => {
            if (isDragging) return;
            if (swipeOffset < 0) {
              setSwipeOffset(0);
            } else if (onToggleExpand) {
              onToggleExpand(ride.id);
            }
          }}
          className="py-4 px-4 md:px-6 cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Clock weight="duotone" className="w-4 h-4 text-gold" />
              <span className="text-xs md:text-sm font-medium text-neutral-300">
                {formattedDate}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Hide StatusBadge if status is 'requested' */}
              {ride.status && ride.status !== 'requested' && (
                <StatusBadge status={ride.status} />
              )}

              {/* Chevron Collapse Indicator */}
              <div className="p-0.5 text-neutral-400">
                {isExpanded ? (
                  <CaretUp weight="bold" className="w-5 h-5 text-gold" />
                ) : (
                  <CaretDown weight="bold" className="w-5 h-5 text-neutral-400" />
                )}
              </div>
            </div>
          </div>

          {/* Quick Route Preview */}
          <div className="flex items-center gap-3 mb-2.5 text-sm">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-2 h-2 rounded-full bg-gold shrink-0" />
              <span className="text-white font-medium truncate">
                {ride.pickup_location?.address || 'Pickup Location'}
              </span>
            </div>
            <ArrowRight weight="bold" className="w-4 h-4 text-neutral-500 shrink-0" />
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-white font-medium truncate">
                {ride.dropoff_location?.address || 'Dropoff Location'}
              </span>
            </div>
          </div>

          {/* Collapsed Footer (Fare & Driver/Passenger Info) */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                <Car weight="duotone" className="w-4 h-4" />
              </div>
              <span className="text-xs text-neutral-300 font-medium truncate max-w-[150px] md:max-w-[220px]">
                {isDriver ? ride.student?.name || 'Passenger' : ride.driver?.user?.name || 'Driver'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                ride.ride_mode === 'shared' 
                  ? 'bg-blue-500/10 text-blue-400' 
                  : 'bg-amber-500/10 text-amber-400'
              }`}>
                {ride.ride_mode === 'shared' ? 'Shared' : 'Private'}
              </span>
              <span className="text-gold font-heading font-bold text-base">
                K{fareAmount ? fareAmount.toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Expanded Details Section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden bg-black/40 border-t border-white/5"
            >
              <div className="py-4 px-4 md:px-6 space-y-4">
                {/* Complete Route Timeline */}
                <div className="bg-white/5 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                    Full Trip Details
                  </h4>
                  <div className="space-y-3 relative pl-4 border-l border-dashed border-white/20">
                    <div className="relative">
                      <div className="absolute -left-[20px] top-1 w-3 h-3 rounded-full bg-gold" />
                      <p className="text-[11px] text-neutral-400 font-medium">Pickup Location</p>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {ride.pickup_location?.address || 'N/A'}
                      </p>
                    </div>
                    <div className="relative pt-1">
                      <div className="absolute -left-[20px] top-2 w-3 h-3 rounded-full bg-emerald-500" />
                      <p className="text-[11px] text-neutral-400 font-medium">Dropoff Location</p>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {ride.dropoff_location?.address || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Driver / Ride Specs Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/5 p-3.5 rounded-2xl">
                    <p className="text-neutral-400 mb-1 text-[11px]">{isDriver ? 'Passenger' : 'Driver'}</p>
                    <p className="font-semibold text-white text-sm truncate">
                      {isDriver ? ride.student?.name || 'Passenger' : ride.driver?.user?.name || 'N/A'}
                    </p>
                    {!isDriver && ride.driver?.plate_number && (
                      <p className="text-gold text-[11px] font-mono mt-0.5">
                        Plate: {ride.driver.plate_number}
                      </p>
                    )}
                  </div>

                  <div className="bg-white/5 p-3.5 rounded-2xl">
                    <p className="text-neutral-400 mb-1 text-[11px]">Distance & Fare</p>
                    <p className="font-semibold text-white text-sm">
                      {ride.distance ? ride.distance.toFixed(1) : '0'} km
                    </p>
                    <p className="text-gold font-bold text-[11px] mt-0.5">
                      K{fareAmount ? fareAmount.toFixed(2) : '0.00'} ({ride.ride_mode || 'standard'})
                    </p>
                  </div>
                </div>

                {/* Rating & Actions Bar */}
                <div className="flex items-center justify-between pt-1">
                  {ride.status === 'completed' ? (
                    <div className="flex items-center gap-2">
                      {ride.rating ? (
                        <div className="flex items-center gap-1.5 bg-gold/10 px-3 py-1.5 rounded-xl">
                          <Star weight="duotone" className="w-4 h-4 text-gold fill-gold" />
                          <span className="text-xs font-bold text-gold">{ride.rating}.0 Rated</span>
                        </div>
                      ) : !isDriver && onRateClick ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRateClick(ride);
                          }}
                          className="px-4 py-2 rounded-xl bg-gold text-black font-semibold text-xs hover:bg-gold-dark transition-all cursor-pointer shadow-md"
                        >
                          ★ Rate Driver
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Red Delete Button in Expanded View */}
                  {onDeleteClick && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClick(ride);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer ml-auto"
                    >
                      <Trash weight="duotone" className="w-3.5 h-3.5" />
                      Delete Record
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default SwipableRideCard;
