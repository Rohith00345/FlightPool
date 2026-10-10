"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

export interface ProgressProps {
  value: number; // 0 - 100
  color?: "primary" | "accent" | "rewards" | "success";
  className?: string;
}

export function Progress({
  value,
  color = "primary",
  className = "",
}: ProgressProps) {
  const colorStyles = {
    primary: "bg-[var(--primary)]",
    accent: "bg-[var(--accent)]",
    rewards: "bg-gradient-to-r from-[var(--rewards)] to-[var(--accent)]",
    success: "bg-[var(--success)]",
  };

  const clamped = Math.min(100, Math.max(0, value));

  return (
    <ProgressPrimitive.Root
      value={clamped}
      className={`relative h-2 w-full overflow-hidden rounded-full bg-[var(--surface-border)] ${className}`}
    >
      <ProgressPrimitive.Indicator
        className={`h-full w-full flex-1 transition-all duration-300 ease-out ${colorStyles[color]}`}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
