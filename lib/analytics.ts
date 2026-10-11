/**
 * FlightPool Analytics & Telemetry Interface
 * Privacy-first, zero PII instrumentation interface with no-op default.
 */

export type AnalyticsEvent =
  | "hero_view"
  | "flight_selected"
  | "fare_viewed"
  | "pool_confirmed"
  | "ride_completed"
  | "theme_changed"
  | "rewards_opened";

export interface AnalyticsProps {
  [key: string]: string | number | boolean | undefined;
}

export interface AnalyticsTracker {
  track(event: AnalyticsEvent, props?: AnalyticsProps): void;
}

class NoopAnalyticsTracker implements AnalyticsTracker {
  track(event: AnalyticsEvent, props?: AnalyticsProps): void {
    if (process.env.NODE_ENV === "development") {
      // Redact any accidental PII before logging in local development
      const sanitizedProps = { ...props };
      delete sanitizedProps.phone;
      delete sanitizedProps.name;
      delete sanitizedProps.otp;
      delete sanitizedProps.token;
      // In dev mode, optionally log event name
      // console.debug(`[Analytics] ${event}`, sanitizedProps);
    }
  }
}

export const analytics: AnalyticsTracker = new NoopAnalyticsTracker();

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  analytics.track(event, props);
}
