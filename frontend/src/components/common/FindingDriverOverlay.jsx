import React from 'react';
import { motion } from 'framer-motion';

const FindingDriverOverlay = ({ pickup, dropoff, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col relative"
      >
        <div className="p-8 flex flex-col items-center text-center space-y-6">
          {/* Radar Animation */}
          <div className="relative w-32 h-32 flex items-center justify-center mt-4">
            <motion.div
              animate={{ scale: [1, 2, 2], opacity: [0.5, 0, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              className="absolute inset-0 bg-gold rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.5, 1.5], opacity: [0.8, 0, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
              className="absolute inset-4 bg-gold rounded-full"
            />
            <div className="w-16 h-16 bg-gold rounded-full z-10 flex items-center justify-center shadow-lg shadow-gold/40">
              <span className="text-2xl">🚗</span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold font-heading">Finding your driver</h2>
            <p className="text-muted-foreground mt-2">Matching you with the best available driver nearby...</p>
          </div>

          {/* Locations */}
          <div className="w-full bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-left space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <p className="text-sm font-medium truncate">{pickup?.address || 'Pickup'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <p className="text-sm font-medium truncate">{dropoff?.address || 'Dropoff'}</p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="w-full py-4 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-2xl font-bold active:scale-95 transition-transform"
          >
            Cancel Request
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FindingDriverOverlay;
