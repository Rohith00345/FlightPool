"use client";

import * as React from "react";
import { Plane } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--text)] ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-[var(--primary)] mb-3">
        {icon || <Plane className="w-6 h-6 transform -rotate-45" />}
      </div>
      <h4 className="font-display font-bold text-base sm:text-lg mb-1">{title}</h4>
      <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm mb-4">
        {description}
      </p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
