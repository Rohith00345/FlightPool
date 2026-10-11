"use client";

import * as React from "react";

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, className = "" }) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-[var(--text)] bg-[var(--surface-3)] border border-[var(--surface-border)] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          {content}
        </div>
      )}
    </div>
  );
};
