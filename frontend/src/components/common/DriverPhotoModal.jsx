import React from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, ShieldCheck, Car, User } from '@phosphor-icons/react';
import { haptics } from '../../utils/haptics';

export const DriverPhotoModal = ({ isOpen, photoUrl, driver, onClose }) => {
  if (!isOpen) return null;

  const handleClose = () => {
    haptics.tap();
    onClose();
  };

  const modalContent = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 pointer-events-auto">
          {/* Backdrop overlay with ultra-smooth 120Hz GPU blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-2xl cursor-pointer"
          />

          {/* 4x4 Modal Container with Spring Pop & Dynamic Glow */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0, y: 60, rotateX: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative z-20 w-full max-w-sm sm:max-w-md bg-zinc-950/95 border-2 border-gold/50 rounded-3xl p-5 shadow-[0_0_80px_rgba(234,179,8,0.5)] flex flex-col items-center gap-4 text-center overflow-hidden"
          >
            {/* Top Close Bar */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gold bg-gold/10 px-3 py-1 rounded-full border border-gold/30">
                <ShieldCheck weight="duotone" className="w-4 h-4 text-gold" /> Verified Driver
              </div>
              <button
                onClick={handleClose}
                className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Large 4x4 Square/Round Image with Pulse Halo */}
            <div className="relative group w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden border-2 border-gold shadow-[0_0_40px_rgba(234,179,8,0.4)] bg-zinc-900 flex items-center justify-center">
              {photoUrl ? (
                <motion.img
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.35 }}
                  src={photoUrl}
                  alt={driver?.user?.name || 'Driver Photo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gold/10 flex flex-col items-center justify-center gap-3">
                  <User weight="duotone" className="w-24 h-24 text-gold" />
                  <span className="text-xs text-gold/80 font-medium">Verified Driver</span>
                </div>
              )}
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
                    <Star weight="duotone" className="w-4 h-4 fill-gold text-gold" />
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
      )}
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
