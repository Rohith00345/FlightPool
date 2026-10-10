"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

export interface SliderProps {
  value: number[];
  onValueChange: (val: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = "",
  ariaLabel = "Slider control",
}: SliderProps) {
  const lastValRef = React.useRef(value[0]);

  const handleChange = (newVal: number[]) => {
    if (newVal[0] !== lastValRef.current) {
      lastValRef.current = newVal[0];
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(8);
        } catch {
          // ignore
        }
      }
    }
    onValueChange(newVal);
  };

  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={handleChange}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      className={`relative flex w-full touch-none select-none items-center py-2 ${className}`}
    >
      <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-[var(--surface-border)]">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-6 w-6 rounded-full border-2 border-[var(--primary)] bg-[var(--surface)] shadow-md shadow-black/40 transition-transform active:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        aria-label={ariaLabel}
      />
    </SliderPrimitive.Root>
  );
}
