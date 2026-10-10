"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className = "", ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={`fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-[380px] ${className}`}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

export const Toast = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & {
    variant?: "default" | "success" | "danger";
  }
>(({ className = "", variant = "default", children, ...props }, ref) => {
  const variantStyles = {
    default: "border-[var(--surface-border)] bg-[var(--surface)] text-[var(--text)]",
    success: "border-emerald-500/40 bg-emerald-950/80 text-emerald-200",
    danger: "border-red-500/40 bg-red-950/80 text-red-200",
  };

  return (
    <ToastPrimitive.Root
      ref={ref}
      className={`relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-2xl border p-4 shadow-xl transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full ${variantStyles[variant]} ${className}`}
      {...props}
    >
      <div className="flex-1 text-xs sm:text-sm">{children}</div>
      <ToastPrimitive.Close className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none">
        <X className="h-4 w-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
});
Toast.displayName = ToastPrimitive.Root.displayName;

export const ToastTitle = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className = "", ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={`font-bold text-xs sm:text-sm ${className}`} {...props} />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className = "", ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={`text-xs text-[var(--text-muted)] ${className}`} {...props} />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;
