"use client";

import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "outline" | "ghost" | "danger" | "success" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  haptic?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      haptic = true,
      onClick,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (haptic && typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(12);
        } catch {
          // ignore
        }
      }
      onClick?.(e);
    };

    const baseStyles =
      "relative inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

    const variantStyles = {
      primary:
        "bg-[var(--primary)] text-[var(--primary-text)] hover:bg-[var(--primary-hover)] shadow-md shadow-[var(--primary)]/20 focus-visible:ring-[var(--primary)]",
      secondary:
        "bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-border)] border border-[var(--surface-border)] focus-visible:ring-[var(--accent)]",
      accent:
        "bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 shadow-md shadow-[var(--accent)]/20 focus-visible:ring-[var(--accent)]",
      outline:
        "bg-transparent text-[var(--text)] border-2 border-[var(--surface-border)] hover:bg-[var(--surface)] hover:border-[var(--primary)]",
      ghost:
        "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]",
      danger:
        "bg-[var(--danger)] text-white hover:opacity-90 shadow-md shadow-[var(--danger)]/20",
      success:
        "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20",
      destructive:
        "bg-[var(--danger)] text-white hover:opacity-90 shadow-md shadow-[var(--danger)]/20",
    };

    const sizeStyles = {
      sm: "h-9 px-3 text-xs gap-1.5",
      md: "h-11 px-4 text-sm gap-2",
      lg: "h-14 px-6 text-base gap-2.5 rounded-3xl",
      icon: "h-11 w-11 p-0 rounded-2xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        onClick={handleClick}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
