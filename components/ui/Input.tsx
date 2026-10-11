"use client";

import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, className = "", id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={`w-full rounded-2xl bg-[var(--surface-2)] border ${
              error ? "border-[var(--danger)]" : "border-[var(--surface-border)]"
            } px-4 py-3 text-sm font-medium text-[var(--text)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 ${
              leftIcon ? "pl-11" : ""
            } ${rightIcon ? "pr-11" : ""}` + (className ? ` ${className}` : "")}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[var(--text-muted)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
