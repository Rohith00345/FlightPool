"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  fallbackText?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({
  src,
  alt = "",
  name,
  fallbackText,
  size = "md",
  className = "",
}: AvatarProps) {
  const displayFallback = (name ? name.slice(0, 2) : fallbackText ? fallbackText.slice(0, 2) : "FP").toUpperCase();
  const sizeStyles = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <AvatarPrimitive.Root
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--surface-border)] font-bold text-[var(--text)] select-none ${sizeStyles[size]} ${className}`}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center bg-[var(--surface-2)] text-[var(--primary)] uppercase"
      >
        {displayFallback}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
