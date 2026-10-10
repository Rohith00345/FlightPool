import { isDemoMode } from "@/lib/demo";

/**
 * OTP Delivery Provider Interface
 */
export interface OtpProvider {
  name: string;
  sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }>;
}

/**
 * MockOtpProvider: Used exclusively in demo mode (DEMO_MODE=true).
 * Simulates instant dispatch without external network calls.
 */
export class MockOtpProvider implements OtpProvider {
  name = "mock";

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
    void phone;
    void code;
    return { success: true };
  }
}

/**
 * ProductionOtpProviderStub: Production implementation that fails safely
 * without logging OTP codes to stdout/console. Ready for real SMS gateway integration.
 */
export class ProductionOtpProviderStub implements OtpProvider {
  name = "production-sms-stub";

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
    void phone;
    void code;
    const apiKey = process.env.SMS_PROVIDER_API_KEY || process.env.TWILIO_AUTH_TOKEN;
    if (apiKey) {
      // Integration point for live SMS delivery (Twilio, AWS SNS, MSG91)
      // Raw OTP is strictly not logged to console
      return { success: true };
    }

    // Fails safely when external provider credentials are not yet configured
    return {
      success: false,
      error: "Live SMS gateway provider not configured.",
    };
  }
}

/**
 * Resolves appropriate OTP provider depending on system mode.
 */
export function getOtpProvider(): OtpProvider {
  if (isDemoMode()) {
    return new MockOtpProvider();
  }
  return new ProductionOtpProviderStub();
}
