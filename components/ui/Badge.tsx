"use client";

import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "primary"
    | "accent"
    | "rewards"
    | "success"
    | "warning"
    | "danger"
    | "outline"
    | "solo"
    | "glow";
  size?: "sm" | "md";
}

export function Badge({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--surface-border)]",
    primary: "bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30",
    accent: "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30",
    rewards: "bg-[var(--rewards)]/15 text-[var(--rewards)] border border-[var(--rewards)]/30",
    success: "bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30",
    warning: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    danger: "bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/30",
    outline: "bg-transparent text-[var(--text)] border border-[var(--surface-border)]",
    solo: "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold",
    glow: "bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/40 shadow-sm shadow-[var(--primary)]/20 font-bold",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full uppercase tracking-wider transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
