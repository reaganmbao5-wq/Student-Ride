import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, ShieldCheck, Car } from 'lucide-react';
import { haptics } from '../../utils/haptics';

export const DriverPhotoModal = ({ isOpen, photoUrl, driver, onClose }) => {
  if (!isOpen || !photoUrl) return null;

  const handleClose = () => {
    haptics.tap();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        {/* Backdrop overlay with ultra-smooth 120Hz GPU blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-2xl cursor-pointer"
        />

        {/* 4x4 Modal Container with Spring Pop & Dynamic Glow */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50, rotateX: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
          exit={{ scale: 0.6, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="relative z-10 w-full max-w-sm sm:max-w-md bg-zinc-950/90 border border-gold/40 rounded-3xl p-5 shadow-[0_0_60px_rgba(234,179,8,0.3)] flex flex-col items-center gap-4 text-center overflow-hidden"
        >
          {/* Top Close Bar */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gold bg-gold/10 px-3 py-1 rounded-full border border-gold/30">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Driver
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Large 4x4 Square/Round Image with Pulse Halo */}
          <div className="relative group w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden border-2 border-gold/60 shadow-[0_0_35px_rgba(234,179,8,0.4)]">
            <motion.img
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              src={photoUrl}
              alt={driver?.user?.name || 'Driver Photo'}
              className="w-full h-full object-cover"
            />
            {/* Ambient Radial Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Driver Info Briefing */}
          <div className="w-full space-y-1 mt-1">
            <h3 className="font-heading text-2xl font-bold text-white tracking-wide">
              {driver?.user?.name || 'Driver'}
            </h3>
            
            {driver && (
              <div className="flex flex-col items-center gap-1.5 text-sm text-zinc-300">
                <div className="flex items-center gap-1.5 text-gold font-semibold">
                  <Star className="w-4 h-4 fill-gold text-gold" />
                  <span>{driver.rating?.toFixed(1) || '5.0'} Rating</span>
                </div>

                <p className="text-xs text-zinc-400 font-medium">
                  {driver.vehicle_color} {driver.vehicle_model} • <span className="text-gold font-bold uppercase bg-gold/10 px-2 py-0.5 rounded border border-gold/20">{driver.plate_number}</span>
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
