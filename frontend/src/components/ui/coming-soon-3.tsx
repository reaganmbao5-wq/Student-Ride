"use client";

import React, { Fragment, useEffect, useState } from "react";
import { Rocket as RiRocket2Line, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { toast } from "sonner";

// Target deadline: Friday, September 11, 2026 at 10:00:00 AM local time
export const LAUNCH_DEADLINE = new Date(2026, 8, 11, 10, 0, 0).getTime();

export function isCountdownActive() {
  return Date.now() < LAUNCH_DEADLINE;
}

function getTimeLeft(diffMs) {
  const diff = Math.max(0, diffMs);
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value) {
  return value.toString().padStart(2, "0");
}

const tiles = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

export default function ComingSoonBlock({ showBackToDashboard = true }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() =>
    getTimeLeft(LAUNCH_DEADLINE - Date.now())
  );

  useEffect(() => {
    const update = () => {
      const remaining = LAUNCH_DEADLINE - Date.now();
      setTimeLeft(getTimeLeft(remaining));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitted(true);
    toast.success("You're on the list! We'll notify you the moment rides go live.");
  };

  const isExpired = Date.now() >= LAUNCH_DEADLINE;

  return (
    <section className="relative flex min-h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-8 bg-background px-4 sm:px-6 py-10 sm:py-16 text-center text-foreground transition-colors duration-300">
      {/* Top Controls Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between px-2 mb-2">
        {showBackToDashboard ? (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <span className="flex items-center gap-2 border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          <RiRocket2Line className="size-3.5" aria-hidden="true" />
          Coming Soon
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl text-foreground font-heading">
          {isExpired ? "Launch is Now Live!" : "The countdown to our biggest launch yet"}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          {isExpired
            ? "Rides are now unlocked and ready for booking across all campuses!"
            : "We go live the moment the timer hits zero. Drop your email and we will make sure you are first through the door."}
        </p>
      </div>

      {!isExpired ? (
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {tiles.map((tile, index) => (
            <Fragment key={tile.key}>
              <div className="flex w-16 sm:w-20 flex-col overflow-hidden border border-border">
                <span
                  suppressHydrationWarning
                  className="bg-card py-3 font-mono text-3xl sm:text-4xl font-bold tabular-nums text-card-foreground"
                >
                  {pad(timeLeft[tile.key])}
                </span>
                <span className="border-t border-border bg-muted/40 py-1.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {tile.label}
                </span>
              </div>
              {index < tiles.length - 1 && (
                <span
                  aria-hidden="true"
                  className="font-mono text-2xl sm:text-3xl font-bold text-muted-foreground/30 select-none"
                >
                  :
                </span>
              )}
            </Fragment>
          ))}
        </div>
      ) : (
        <Button
          onClick={() => navigate('/ride')}
          className="px-8 py-3 text-base font-bold shadow-lg"
        >
          Book Your Ride Now
        </Button>
      )}

      {!isExpired && (
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-sm flex-col gap-2 sm:flex-row"
        >
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            disabled={isSubmitted}
            className="bg-background border-input text-foreground"
          />
          <Button type="submit" className="shrink-0" disabled={isSubmitted}>
            {isSubmitted ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Subscribed
              </span>
            ) : (
              "Notify me"
            )}
          </Button>
        </form>
      )}
    </section>
  );
}
