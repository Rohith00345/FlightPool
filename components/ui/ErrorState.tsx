"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message = "We encountered an issue processing your request. Please try again.",
  onRetry,
  retryLabel = "Try Again",
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`p-6 rounded-3xl bg-[var(--surface-2)] border border-[var(--danger)]/30 text-center flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-[var(--danger)]/15 text-[var(--danger)] flex items-center justify-center">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div>
        <h4 className="text-base font-bold text-[var(--text)]">{title}</h4>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mt-1">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          className="mt-2 border-[var(--danger)]/40 hover:bg-[var(--danger)]/10"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
