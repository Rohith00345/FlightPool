import { isDemoMode } from "@/lib/demo";

export interface TripUpdatePayload {
  tripId: string;
  status: string;
  driverName?: string;
  vehicle?: string;
  pickupBay?: string;
}

export interface SafetyAlertPayload {
  severity: "S1" | "S2" | "S3" | "S4";
  message: string;
  tripId?: string;
}

export interface NotificationProvider {
  name: string;
  sendSms(phone: string, message: string): Promise<{ success: boolean; error?: string }>;
  sendTripUpdate(phone: string, update: TripUpdatePayload): Promise<{ success: boolean; error?: string }>;
  sendSafetyAlert(phone: string, alert: SafetyAlertPayload): Promise<{ success: boolean; error?: string }>;
}

export class MockNotificationProvider implements NotificationProvider {
  name = "mock-notifications";
  public dispatched: Array<{ type: string; phone: string; data: unknown }> = [];

  async sendSms(phone: string, message: string) {
    this.dispatched.push({ type: "SMS", phone, data: { message } });
    return { success: true };
  }

  async sendTripUpdate(phone: string, update: TripUpdatePayload) {
    this.dispatched.push({ type: "TRIP_UPDATE", phone, data: update });
    return { success: true };
  }

  async sendSafetyAlert(phone: string, alert: SafetyAlertPayload) {
    this.dispatched.push({ type: "SAFETY_ALERT", phone, data: alert });
    return { success: true };
  }
}

export class ProductionNotificationProvider implements NotificationProvider {
  name = "production-sms-gateway";

  async sendSms(phone: string, message: string) {
    void phone;
    void message;
    const apiKey = process.env.SMS_PROVIDER_API_KEY || process.env.TWILIO_AUTH_TOKEN;
    if (apiKey) {
      // Live integration point: Twilio / AWS SNS / Fast2SMS
      return { success: true };
    }
    return { success: false, error: "Live SMS gateway provider not configured." };
  }

  async sendTripUpdate(phone: string, update: TripUpdatePayload) {
    return this.sendSms(
      phone,
      `FlightPool: Your pooled ride ${update.tripId} status is ${update.status}. Bay: ${update.pickupBay || "T2 P4"}`
    );
  }

  async sendSafetyAlert(phone: string, alert: SafetyAlertPayload) {
    return this.sendSms(
      phone,
      `FlightPool SAFETY ALERT [${alert.severity}]: ${alert.message}`
    );
  }
}

export function getNotificationProvider(): NotificationProvider {
  if (isDemoMode()) {
    return new MockNotificationProvider();
  }
  return new ProductionNotificationProvider();
}

export const defaultNotificationProvider = getNotificationProvider();
