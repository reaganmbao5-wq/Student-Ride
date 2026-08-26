"use client"

import React, {
  forwardRef,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react"
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion"
import { Loader2, SendHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, ButtonProps } from "@/components/ui/button"

const DRAG_CONSTRAINTS_LTR = { left: 0, right: 120 }
const DRAG_CONSTRAINTS_RTL = { left: -120, right: 0 }
const DRAG_THRESHOLD = 0.65

const BUTTON_STATES = {
  expanded: { width: "10.5rem" },
  compact: { width: "6.5rem" },
}

const ANIMATION_CONFIG = {
  spring: {
    type: "spring",
    stiffness: 400,
    damping: 40,
    mass: 0.8,
  },
}

export interface SlideButtonProps extends Omit<ButtonProps, "onToggle"> {
  isOnline?: boolean | null
  onToggle?: () => void
  onSlideComplete?: () => void
  resolveTo?: "success" | "error"
}

export const SlideButton = forwardRef<HTMLButtonElement, SlideButtonProps>(
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
    const isControlledDriverMode = typeof isOnline === "boolean"

    const [isSliderExpanded, setIsSliderExpanded] = useState(false)
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
    const isSubmittingRef = useRef(false)

    // Standalone fallback
    const [standaloneCompleted, setStandaloneCompleted] = useState(false)

    // Independent motion values
    const dragX_LTR = useMotionValue(0)
    const springX_LTR = useSpring(dragX_LTR, ANIMATION_CONFIG.spring)
    const dragProgressLTR = useTransform(springX_LTR, [0, 120], [0, 1])
    const adjustedWidthLTR = useTransform(springX_LTR, (x) => Math.max(0, x + 16))

    const dragX_RTL = useMotionValue(0)
    const springX_RTL = useSpring(dragX_RTL, ANIMATION_CONFIG.spring)
    const dragProgressRTL = useTransform(springX_RTL, [0, -120], [0, 1])
    const adjustedWidthRTL = useTransform(springX_RTL, (x) => Math.max(0, -x + 16))

    // Reset coordinates and collapse slider when online state updates
    useEffect(() => {
      dragX_LTR.set(0)
      dragX_RTL.set(0)
      setIsSliderExpanded(false)
      setStatus("idle")
      isSubmittingRef.current = false
    }, [isOnline, dragX_LTR, dragX_RTL])

    const isCurrentOnline = isControlledDriverMode ? isOnline : standaloneCompleted
    const showPill = isControlledDriverMode ? !isSliderExpanded : standaloneCompleted
    const showLTRSlider = !showPill && !isCurrentOnline
    const showRTLSlider = !showPill && isCurrentOnline

    // --- LTR Handlers (Go Online: Left -> Right) ---
    const handleDragStartLTR = useCallback(() => {
      if (disabled || isSubmittingRef.current) return
    }, [disabled])

    const handleDragLTR = (_event: any, info: any) => {
      if (disabled || isSubmittingRef.current) return
      const newX = Math.max(0, Math.min(info.offset.x, 120))
      dragX_LTR.set(newX)
    }

    const handleDragEndLTR = (_event: any, info: any) => {
      if (disabled || isSubmittingRef.current) return
      const offset = info?.offset?.x ?? dragX_LTR.get()
      const progress = dragProgressLTR.get()

      if (progress >= DRAG_THRESHOLD || offset >= 65 || dragX_LTR.get() >= 65) {
        isSubmittingRef.current = true
        setStatus("loading")
        setTimeout(() => {
          if (onToggle) onToggle()
          if (onSlideComplete) onSlideComplete()
          dragX_LTR.set(0)
          setIsSliderExpanded(false)
          setStatus("idle")
          isSubmittingRef.current = false
          if (!isControlledDriverMode) {
            setStandaloneCompleted(true)
          }
        }, 250)
      } else {
        dragX_LTR.set(0)
      }
    }

    // --- RTL Handlers (Go Offline: Right -> Left - Flipped UI) ---
    const handleDragStartRTL = useCallback(() => {
      if (disabled || isSubmittingRef.current) return
    }, [disabled])

    const handleDragRTL = (_event: any, info: any) => {
      if (disabled || isSubmittingRef.current) return
      const newX = Math.min(0, Math.max(info.offset.x, -120))
      dragX_RTL.set(newX)
    }

    const handleDragEndRTL = (_event: any, info: any) => {
      if (disabled || isSubmittingRef.current) return
      const offset = info?.offset?.x ?? dragX_RTL.get()
      const progress = dragProgressRTL.get()

      if (progress >= DRAG_THRESHOLD || offset <= -65 || dragX_RTL.get() <= -65) {
        isSubmittingRef.current = true
        setStatus("loading")
        setTimeout(() => {
          if (onToggle) onToggle()
          if (onSlideComplete) onSlideComplete()
          dragX_RTL.set(0)
          setIsSliderExpanded(false)
          setStatus("idle")
          isSubmittingRef.current = false
        }, 250)
      } else {
        dragX_RTL.set(0)
      }
    }

    const handlePillClick = () => {
      if (isSubmittingRef.current) return
      if (isControlledDriverMode) {
        dragX_LTR.set(0)
        dragX_RTL.set(0)
        setIsSliderExpanded(true)
      } else {
        setStandaloneCompleted(false)
        dragX_LTR.set(0)
      }
    }

    return (
      <motion.div
        animate={showPill ? BUTTON_STATES.compact : BUTTON_STATES.expanded}
        transition={ANIMATION_CONFIG.spring}
        className={cn(
          "relative flex h-10 items-center justify-center rounded-full bg-zinc-200/90 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700/60 select-none overflow-hidden shadow-inner",
          className
        )}
      >
        {/* Fill Highlight Progress (LTR: Go Online) */}
        {showLTRSlider && (
          <motion.div
            style={{ width: adjustedWidthLTR }}
            className="absolute inset-y-0 left-0 z-0 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30"
          />
        )}

        {/* Fill Highlight Progress (RTL: Go Offline) */}
        {showRTLSlider && (
          <motion.div
            style={{ width: adjustedWidthRTL }}
            className="absolute inset-y-0 right-0 z-0 rounded-full bg-zinc-500/20 dark:bg-zinc-500/30"
          />
        )}

        {/* 1. LTR SLIDER (Go Online: Left -> Right) */}
        {showLTRSlider && (
          <>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 pl-6 pointer-events-none select-none tracking-tight">
              Slide online →
            </span>
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
                className="rounded-full shadow-md h-8 w-8 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-transform"
              >
                {status === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizontal className="size-4" />
                )}
              </Button>
            </motion.div>
          </>
        )}

        {/* 2. RTL SLIDER (Go Offline: Right -> Left - Flipped UI) */}
        {showRTLSlider && (
          <>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 pr-6 pointer-events-none select-none tracking-tight">
              ← Slide offline
            </span>
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
                className="rounded-full shadow-md h-8 w-8 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-transform"
              >
                {status === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizontal className="size-4 rotate-180" />
                )}
              </Button>
            </motion.div>
          </>
        )}

        {/* 3. COMPACT PILL */}
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
                className="size-full rounded-full transition-colors bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 h-10 flex items-center justify-center gap-1.5 px-3 shadow-none border-none"
              >
                {status === "loading" ? (
                  <Loader2 className="size-4 animate-spin text-zinc-900 dark:text-white" />
                ) : (
                  <>
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        isCurrentOnline
                          ? "bg-emerald-500 ring-2 ring-emerald-500/30 animate-pulse"
                          : "bg-zinc-400 dark:bg-zinc-500"
                      )}
                    />
                    <span
                      className={cn(
                        "font-bold text-[11px] uppercase tracking-wider select-none",
                        isCurrentOnline
                          ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                          : "text-zinc-700 dark:text-zinc-300 font-semibold"
                      )}
                    >
                      {isCurrentOnline ? "ONLINE" : "OFFLINE"}
                    </span>
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }
)

SlideButton.displayName = "SlideButton"
export default SlideButton
