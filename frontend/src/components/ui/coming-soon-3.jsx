"use client";

import React from "react";
import { Rocket as RiRocket2Line, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Gate flag: Remains active until manually set to false after beta testing finishes
export const IS_BETA_TESTING_GATE_ACTIVE = true;

export function isCountdownActive() {
  return IS_BETA_TESTING_GATE_ACTIVE;
}

export default function ComingSoonBlock({ showBackToDashboard = true }) {
  const navigate = useNavigate();

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

      <div className="flex flex-col items-center gap-4 max-w-xl mx-auto">
        <span className="flex items-center gap-2 border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          <RiRocket2Line className="size-3.5" aria-hidden="true" />
          Coming Soon
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl text-foreground font-heading">
          You're Early to Jaey Ride!
        </h1>
        <p className="max-w-lg text-sm text-muted-foreground sm:text-base leading-relaxed">
          The application is actively in its testing phase with a select group of campus users. We are fine-tuning driver response and ride reliability before opening ride requests to everyone. Full rollout is on the way!
        </p>
      </div>

      <div className="pt-2">
        <Button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 rounded-xl font-semibold shadow-md cursor-pointer text-sm"
        >
          Return to Dashboard
        </Button>
      </div>
    </section>
  );
}
