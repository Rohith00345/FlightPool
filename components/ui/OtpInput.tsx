"use client";

import * as React from "react";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  id?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
  error,
  id = "otp-input",
}) => {
  const inputsRef = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return;

    const chars = value.split("");
    chars[index] = val.slice(-1);
    const newValue = chars.join("").slice(0, length);
    onChange(newValue);

    if (val && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    const targetIdx = Math.min(pasted.length, length - 1);
    inputsRef.current[targetIdx]?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2" id={id}>
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={value[index] || ""}
            disabled={disabled}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${index + 1} of ${length}`}
            className={`w-11 h-13 text-center text-xl font-bold font-mono rounded-2xl bg-[var(--surface-2)] border ${
              error ? "border-[var(--danger)]" : "border-[var(--surface-border)]"
            } text-[var(--text)] transition-all focus:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50`}
          />
        ))}
      </div>
      {error && <p className="text-xs text-[var(--danger)] text-center">{error}</p>}
    </div>
  );
};
