"use client";

import React from "react";
import { Rocket as RiRocket2Line } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme, ACCENT_COLORS } from "../../context/ThemeContext";

// Gate flag: Remains active until manually set to false after beta testing finishes
export const IS_BETA_TESTING_GATE_ACTIVE = true;

export function isCountdownActive() {
  return IS_BETA_TESTING_GATE_ACTIVE;
}

export default function ComingSoonBlock() {
  const navigate = useNavigate();
  const { accentColor } = useTheme();
  const activeAccentHex = ACCENT_COLORS?.[accentColor]?.hex || '#3B82F6';

  return (
    <section className="relative flex min-h-[calc(100vh-8rem)] w-full flex-col items-center justify-center gap-8 bg-background px-4 sm:px-6 py-10 sm:py-16 text-center text-foreground transition-colors duration-300">
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
          className="px-7 py-3 rounded-xl font-semibold shadow-lg active:scale-98 transition-all cursor-pointer text-sm text-white"
          style={{
            backgroundColor: activeAccentHex,
            boxShadow: `0 10px 25px -5px ${activeAccentHex}70`
          }}
        >
          Return to Dashboard
        </Button>
      </div>
    </section>
  );
}
