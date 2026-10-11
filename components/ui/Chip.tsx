"use client";

import * as React from "react";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  variant?: "default" | "primary" | "accent";
}

export const Chip: React.FC<ChipProps> = ({
  selected = false,
  variant = "default",
  className = "",
  children,
  ...props
}) => {
  const variantStyles = {
    default: selected
      ? "bg-[var(--surface-3)] text-[var(--text)] border-[var(--primary)] shadow-sm"
      : "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--surface-border)] hover:text-[var(--text)] hover:border-[var(--text-muted)]",
    primary: selected
      ? "bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)] shadow-md shadow-[var(--primary)]/20 font-bold"
      : "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--surface-border)] hover:text-[var(--text)]",
    accent: selected
      ? "bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)] shadow-md shadow-[var(--accent)]/20 font-bold"
      : "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--surface-border)] hover:text-[var(--text)]",
  };

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
