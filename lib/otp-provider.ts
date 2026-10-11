import { isDemoMode } from "./demo";

/**
 * OTP Delivery Provider Interface
 */
export interface OtpProvider {
  name: string;
  sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string; messageId?: string }>;
}

/**
 * MockOtpProvider: Used exclusively in demo mode (DEMO_MODE=true).
 * Simulates instant dispatch without external network calls.
 */
export class MockOtpProvider implements OtpProvider {
  name = "mock";

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    void phone;
    void code;
    return { success: true, messageId: `mock_msg_${Date.now()}` };
  }
}

/**
 * Fast2SmsOtpProvider: Indian domestic SMS gateway via Fast2SMS DLT/OTP API.
 */
export class Fast2SmsOtpProvider implements OtpProvider {
  name = "fast2sms";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAST2SMS_API_KEY || "";
  }

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!this.apiKey) {
      return { success: false, error: "FAST2SMS_API_KEY is not configured." };
    }

    // Clean phone number (extract 10-digit Indian mobile number)
    const cleanNumber = phone.replace(/\D/g, "").slice(-10);
    if (cleanNumber.length !== 10) {
      return { success: false, error: "Invalid Indian 10-digit phone number." };
    }

    try {
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variables_values: code,
          route: "otp",
          numbers: cleanNumber,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || (data && data.return === false)) {
        return {
          success: false,
          error: data?.message?.[0] || `Fast2SMS request failed with status ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.request_id || `f2s_${Date.now()}`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown Fast2SMS dispatch error",
      };
    }
  }
}

/**
 * TwilioOtpProvider: International and fallback SMS gateway via Twilio Messages REST API.
 */
export class TwilioOtpProvider implements OtpProvider {
  name = "twilio";
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid?: string, authToken?: string, fromNumber?: string) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = fromNumber || process.env.TWILIO_FROM_PHONE || process.env.TWILIO_PHONE_NUMBER || "";
  }

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      return { success: false, error: "Twilio credentials (SID, Token, or From number) are missing." };
    }

    // Ensure E.164 format (+91...)
    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "").slice(-10)}`;

    try {
      const authHeader = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
      const bodyParams = new URLSearchParams({
        To: formattedPhone,
        From: this.fromNumber,
        Body: `Your FlightPool verification code is: ${code}. Valid for 10 minutes.`,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          error: data?.message || `Twilio dispatch failed with status ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.sid || `tw_${Date.now()}`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown Twilio dispatch error",
      };
    }
  }
}

/**
 * ProductionOtpProviderStub: Production fallback when no third-party gateway is active.
 * Fails safely without printing secrets or OTPs.
 */
export class ProductionOtpProviderStub implements OtpProvider {
  name = "production-sms-stub";

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    void phone;
    void code;
    return {
      success: false,
      error: "Live SMS gateway provider not configured.",
    };
  }
}

/**
 * Resolves appropriate OTP provider depending on system mode and configuration.
 */
export function getOtpProvider(): OtpProvider {
  if (isDemoMode()) {
    return new MockOtpProvider();
  }

  const providerType = (process.env.SMS_PROVIDER || "").toLowerCase();

  if (providerType === "fast2sms" || process.env.FAST2SMS_API_KEY) {
    return new Fast2SmsOtpProvider();
  }

  if (providerType === "twilio" || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)) {
    return new TwilioOtpProvider();
  }

  return new ProductionOtpProviderStub();
}
