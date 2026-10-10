"use client";

import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "boarding-pass" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  variant = "default",
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  const variantStyles = {
    default:
      "bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text)] shadow-sm",
    glass: "glass-surface text-[var(--text)]",
    "boarding-pass":
      "bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text)] boarding-pass-cut shadow-md",
    elevated:
      "bg-[var(--surface-2)] border border-[var(--surface-border)] text-[var(--text)] shadow-lg shadow-black/20",
  };

  const paddingStyles = {
    none: "p-0",
    sm: "p-3",
    md: "p-4 sm:p-5",
    lg: "p-6 sm:p-7",
  };

  return (
    <div
      className={`rounded-3xl transition-all duration-200 ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col space-y-1.5 pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`font-display text-base sm:text-lg font-bold tracking-tight text-[var(--text)] ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs sm:text-sm text-[var(--text-muted)] ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props}>{children}</div>;
}

export function CardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center pt-3 ${className}`} {...props}>
      {children}
    </div>
  );
}
