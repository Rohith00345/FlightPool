"use client";

import * as React from "react";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-[var(--surface-2)]/80 ${className}`}
      {...props}
    />
  );
}
