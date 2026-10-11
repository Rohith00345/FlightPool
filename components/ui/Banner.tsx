"use client";

import * as React from "react";
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export interface BannerProps {
  variant?: "info" | "warning" | "success" | "danger";
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({
  variant = "info",
  title,
  children,
  action,
  className = "",
}) => {
  const icons = {
    info: <Info className="w-5 h-5 text-[var(--info)] shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-[var(--warning)] shrink-0" />,
    success: <CheckCircle className="w-5 h-5 text-[var(--success)] shrink-0" />,
    danger: <XCircle className="w-5 h-5 text-[var(--danger)] shrink-0" />,
  };

  const borders = {
    info: "border-[var(--info)]/30 bg-[var(--surface-2)]",
    warning: "border-[var(--warning)]/30 bg-[var(--surface-2)]",
    success: "border-[var(--success)]/30 bg-[var(--surface-2)]",
    danger: "border-[var(--danger)]/30 bg-[var(--surface-2)]",
  };

  return (
    <div
      role="region"
      className={`p-4 rounded-2xl border flex items-start gap-3.5 ${borders[variant]} ${className}`}
    >
      <div className="mt-0.5">{icons[variant]}</div>
      <div className="flex-1 text-sm text-[var(--text)]">
        {title && <h5 className="font-bold text-sm text-[var(--text)] mb-0.5">{title}</h5>}
        <div className="text-[var(--text-muted)] leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
