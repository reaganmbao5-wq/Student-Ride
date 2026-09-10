"use client";

import React, {
  forwardRef,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Loader2, SendHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DRAG_CONSTRAINTS_LTR = { left: 0, right: 155 };
const DRAG_CONSTRAINTS_RTL = { left: -155, right: 0 };
const DRAG_THRESHOLD = 0.75;

const BUTTON_STATES = {
  expanded: { width: "12rem" },
  compact: { width: "7rem" },
};

const ANIMATION_CONFIG = {
  spring: {
    type: "spring",
    stiffness: 400,
    damping: 40,
    mass: 0.8,
  },
};

export const SlideButton = forwardRef(
  (
    {
      className,
      isOnline = null,
      onToggle,
      onSlideComplete,
      disabled = false,
      resolveTo = "success",
      ...props
    },
    ref
  ) => {
    const isControlledDriverMode = typeof isOnline === "boolean";

    const [isSliderExpanded, setIsSliderExpanded] = useState(false);
    const [status, setStatus] = useState("idle");
    const isSubmittingRef = useRef(false);

    // Standalone fallback
    const [standaloneCompleted, setStandaloneCompleted] = useState(false);

    // Independent motion values
    const dragX_LTR = useMotionValue(0);
    const springX_LTR = useSpring(dragX_LTR, ANIMATION_CONFIG.spring);
    const dragProgressLTR = useTransform(springX_LTR, [0, 155], [0, 1]);
    const adjustedWidthLTR = useTransform(springX_LTR, (x) => Math.max(0, x + 10));

    const dragX_RTL = useMotionValue(0);
    const springX_RTL = useSpring(dragX_RTL, ANIMATION_CONFIG.spring);
    const dragProgressRTL = useTransform(springX_RTL, [0, -155], [0, 1]);
    const adjustedWidthRTL = useTransform(springX_RTL, (x) => Math.max(0, -x + 10));

    const watchdogTimerRef = useRef(null);

    const resetState = useCallback(() => {
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      dragX_LTR.set(0);
      dragX_RTL.set(0);
      setIsSliderExpanded(false);
      setStatus("idle");
      isSubmittingRef.current = false;
    }, [dragX_LTR, dragX_RTL]);

    // Reset coordinates and collapse slider when online state updates
    useEffect(() => {
      resetState();
    }, [isOnline, resetState]);

    useEffect(() => {
      return () => {
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      };
    }, []);

    const isCurrentOnline = isControlledDriverMode ? isOnline : standaloneCompleted;
    const showPill = isControlledDriverMode ? !isSliderExpanded : standaloneCompleted;
    const showLTRSlider = !showPill && !isCurrentOnline;
    const showRTLSlider = !showPill && isCurrentOnline;

    // --- LTR Handlers (Go Online: Left -> Right) ---
    const handleDragStartLTR = useCallback(() => {
      if (disabled || isSubmittingRef.current) return;
    }, [disabled]);

    const handleDragLTR = (_event, info) => {
      if (disabled || isSubmittingRef.current) return;
      const newX = Math.max(0, Math.min(info.offset.x, 155));
      dragX_LTR.set(newX);
    };

    const handleDragEndLTR = (_event, info) => {
      if (disabled || isSubmittingRef.current) {
        dragX_LTR.set(0);
        return;
      }
      const offset = info?.offset?.x ?? dragX_LTR.get();
      const progress = dragProgressLTR.get();

      if (progress >= DRAG_THRESHOLD || offset >= 90 || dragX_LTR.get() >= 90) {
        isSubmittingRef.current = true;
        setStatus("loading");

        // Safety watchdog: ensures button auto-unlocks after 1.2s under any network/lifecycle stalls
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = setTimeout(() => {
          resetState();
        }, 1200);

        setTimeout(() => {
          try {
            if (onToggle) onToggle();
            if (onSlideComplete) onSlideComplete();
          } finally {
            resetState();
            if (!isControlledDriverMode) {
              setStandaloneCompleted(true);
            }
          }
        }, 250);
      } else {
        dragX_LTR.set(0);
      }
    };

    // --- RTL Handlers (Go Offline: Right -> Left) ---
    const handleDragStartRTL = useCallback(() => {
      if (disabled || isSubmittingRef.current) return;
    }, [disabled]);

    const handleDragRTL = (_event, info) => {
      if (disabled || isSubmittingRef.current) return;
      const newX = Math.min(0, Math.max(info.offset.x, -155));
      dragX_RTL.set(newX);
    };

    const handleDragEndRTL = (_event, info) => {
      if (disabled || isSubmittingRef.current) {
        dragX_RTL.set(0);
        return;
      }
      const offset = info?.offset?.x ?? dragX_RTL.get();
      const progress = dragProgressRTL.get();

      if (progress >= DRAG_THRESHOLD || offset <= -90 || dragX_RTL.get() <= -90) {
        isSubmittingRef.current = true;
        setStatus("loading");

        // Safety watchdog: ensures button auto-unlocks after 1.2s under any network/lifecycle stalls
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = setTimeout(() => {
          resetState();
        }, 1200);

        setTimeout(() => {
          try {
            if (onToggle) onToggle();
            if (onSlideComplete) onSlideComplete();
          } finally {
            resetState();
            if (!isControlledDriverMode) {
              setStandaloneCompleted(true);
            }
          }
        }, 250);
      } else {
        dragX_RTL.set(0);
      }
    };

    const handlePillClick = () => {
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      isSubmittingRef.current = false;
      setStatus("idle");
      dragX_LTR.set(0);
      dragX_RTL.set(0);
      if (isControlledDriverMode) {
        setIsSliderExpanded(true);
      } else {
        setStandaloneCompleted(false);
      }
    };

    return (
      <motion.div
        animate={showPill ? BUTTON_STATES.compact : BUTTON_STATES.expanded}
        transition={ANIMATION_CONFIG.spring}
        className={cn(
          "shadow-button-inset dark:shadow-button-inset-dark relative flex h-9 items-center justify-center rounded-full bg-[#E5E7EB] dark:bg-zinc-800/90 border border-zinc-300 dark:border-white/10 select-none overflow-hidden",
          className
        )}
      >
        {/* Fill Highlight Progress (LTR: Monochrome Contrast) */}
        {showLTRSlider && (
          <motion.div
            style={{ width: adjustedWidthLTR }}
            className="absolute inset-y-0 left-0 z-0 rounded-full bg-black/15 dark:bg-white/20"
          />
        )}

        {/* Fill Highlight Progress (RTL: Monochrome Contrast) */}
        {showRTLSlider && (
          <motion.div
            style={{ width: adjustedWidthRTL }}
            className="absolute inset-y-0 right-0 z-0 rounded-full bg-black/15 dark:bg-white/20"
          />
        )}

        {/* 1. LTR SLIDER (Go Online: Left -> Right) */}
        {showLTRSlider && (
          <motion.div
            key="slider-ltr-knob"
            drag="x"
            dragConstraints={DRAG_CONSTRAINTS_LTR}
            dragElastic={0}
            dragMomentum={false}
            onDragStart={handleDragStartLTR}
            onDragEnd={handleDragEndLTR}
            onDrag={handleDragLTR}
            style={{ x: springX_LTR }}
            className="absolute left-1 z-10 flex cursor-grab items-center justify-start active:cursor-grabbing"
          >
            <Button
              ref={ref}
              disabled={status === "loading"}
              {...props}
              size="icon"
              className="shadow-button rounded-full drop-shadow-xl h-8 w-8 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-transform"
            >
              {status === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          </motion.div>
        )}

        {/* 2. RTL SLIDER (Go Offline: Right -> Left - Flipped UI) */}
        {showRTLSlider && (
          <motion.div
            key="slider-rtl-knob"
            drag="x"
            dragConstraints={DRAG_CONSTRAINTS_RTL}
            dragElastic={0}
            dragMomentum={false}
            onDragStart={handleDragStartRTL}
            onDragEnd={handleDragEndRTL}
            onDrag={handleDragRTL}
            style={{ x: springX_RTL }}
            className="absolute right-1 z-10 flex cursor-grab items-center justify-end active:cursor-grabbing"
          >
            <Button
              ref={ref}
              disabled={status === "loading"}
              {...props}
              size="icon"
              className="shadow-button rounded-full drop-shadow-xl h-8 w-8 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-transform"
            >
              {status === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4 rotate-180" />
              )}
            </Button>
          </motion.div>
        )}

        {/* 3. COMPACT PILL (Shows "ONLINE" or "OFFLINE" in bold black/white with distinguishable gray track) */}
        <AnimatePresence mode="wait">
          {showPill && (
            <motion.div
              key={isCurrentOnline ? "pill-online" : "pill-offline"}
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={handlePillClick}
              title={isCurrentOnline ? "Tap to Go Offline" : "Tap to Go Online"}
            >
              <Button
                ref={ref}
                disabled={false}
                {...props}
                className="size-full rounded-full transition-colors bg-[#E5E7EB] hover:bg-[#D1D5DB] dark:bg-zinc-800 dark:hover:bg-zinc-700 h-9 flex items-center justify-center shadow-none border-none"
              >
                {status === "loading" ? (
                  <Loader2 className="size-4 animate-spin text-zinc-900 dark:text-white" />
                ) : (
                  <span className="font-bold text-xs uppercase tracking-wider text-black dark:text-white select-none">
                    {isCurrentOnline ? "ONLINE" : "OFFLINE"}
                  </span>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);

SlideButton.displayName = "SlideButton";
export default SlideButton;
