"use client";

import * as React from "react";

export interface RingProps {
  value: number; // 0 to 100 (or max)
  max?: number;
  size?: number; // px diameter
  strokeWidth?: number;
  color?: string; // CSS color or hex
  trackColor?: string;
  label?: string;
  sublabel?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Ring({
  value,
  max = 100,
  size = 90,
  strokeWidth = 8,
  color = "var(--primary)",
  trackColor = "var(--surface-border)",
  label,
  sublabel,
  className = "",
  children,
}: RingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, value / max));
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        {children ? (
          children
        ) : (
          <>
            {label ? (
              <span className="font-display font-extrabold text-sm sm:text-base text-[var(--text)]">
                {label}
              </span>
            ) : null}
            {sublabel ? (
              <span className="text-[10px] text-[var(--text-muted)] font-medium leading-tight">
                {sublabel}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
