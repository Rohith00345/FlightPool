"use client";

import * as React from "react";
import { Plane } from "lucide-react";

export interface StepItem {
  id?: string;
  label: string;
  description?: string;
  sublabel?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStepIndex?: number;
  currentStep?: number;
  className?: string;
}

export function Stepper({
  steps,
  currentStepIndex,
  currentStep,
  className = "",
}: StepperProps) {
  const activeIdx = currentStepIndex !== undefined ? currentStepIndex : (currentStep !== undefined ? currentStep - 1 : 0);
  const progressPct =
    steps.length > 1
      ? (activeIdx / (steps.length - 1)) * 100
      : 100;

  return (
    <div className={`w-full py-2 select-none ${className}`}>
      {/* Flight Path Track */}
      <div className="relative flex items-center justify-between">
        {/* Track Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-[var(--surface-border)] rounded-full z-0">
          <div
            className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step Nodes */}
        {steps.map((step, idx) => {
          const isCompleted = idx < activeIdx;
          const isCurrent = idx === activeIdx;

          return (
            <div key={step.id || step.label || idx} className="relative z-10 flex flex-col items-center">
              <div
                className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                  isCurrent
                    ? "w-7 h-7 bg-[var(--primary)] text-[var(--primary-text)] shadow-md shadow-[var(--primary)]/30 scale-110"
                    : isCompleted
                    ? "w-6 h-6 bg-[var(--accent)] text-[var(--accent-text)]"
                    : "w-5 h-5 bg-[var(--surface-2)] border-2 border-[var(--surface-border)] text-[var(--text-muted)]"
                }`}
              >
                {isCurrent ? (
                  <Plane className="w-3.5 h-3.5 transform -rotate-45" />
                ) : isCompleted ? (
                  <span className="text-[10px] font-bold">✓</span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                )}
              </div>
              <span
                className={`mt-1 text-[10px] sm:text-xs font-semibold whitespace-nowrap hidden sm:block ${
                  isCurrent
                    ? "text-[var(--primary)]"
                    : isCompleted
                    ? "text-[var(--text)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
