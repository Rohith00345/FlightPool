"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className = "", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={`inline-flex items-center justify-center rounded-2xl bg-[var(--surface-2)] p-1 text-[var(--text-muted)] border border-[var(--surface-border)] ${className}`}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className = "", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--text)] data-[state=active]:shadow-sm ${className}`}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className = "", ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={`mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${className}`}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
