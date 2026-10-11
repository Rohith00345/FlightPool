import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MockOtpProvider,
  Fast2SmsOtpProvider,
  TwilioOtpProvider,
  getOtpProvider,
} from "../lib/otp-provider";

describe("Pluggable SMS Provider Adapters", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("MockOtpProvider", () => {
    it("successfully sends mock OTP without network calls", async () => {
      const provider = new MockOtpProvider();
      const res = await provider.sendOtp("+919876543210", "123456");
      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });
  });

  describe("Fast2SmsOtpProvider", () => {
    it("fails cleanly when API key is missing", async () => {
      const provider = new Fast2SmsOtpProvider("");
      const res = await provider.sendOtp("+919876543210", "123456");
      expect(res.success).toBe(false);
      expect(res.error).toContain("FAST2SMS_API_KEY");
    });

    it("rejects phone numbers with fewer than 10 digits", async () => {
      const provider = new Fast2SmsOtpProvider("mock_fast2sms_key");
      const res = await provider.sendOtp("123", "123456");
      expect(res.success).toBe(false);
      expect(res.error).toContain("10-digit");
    });

    it("sends OTP using Fast2SMS API when configured", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ return: true, request_id: "f2s_req_9988", message: ["SMS sent successfully"] }),
      });
      global.fetch = fetchMock;

      const provider = new Fast2SmsOtpProvider("test_fast2sms_key");
      const res = await provider.sendOtp("+919876543210", "654321");

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("f2s_req_9988");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.fast2sms.com/dev/bulkV2",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            authorization: "test_fast2sms_key",
          }),
        })
      );
    });

    it("handles API failure responses gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ return: false, message: ["Invalid authorization key"] }),
      });

      const provider = new Fast2SmsOtpProvider("invalid_key");
      const res = await provider.sendOtp("+919876543210", "654321");

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid authorization key");
    });
  });

  describe("TwilioOtpProvider", () => {
    it("fails cleanly when credentials are missing", async () => {
      const provider = new TwilioOtpProvider("", "", "");
      const res = await provider.sendOtp("+919876543210", "123456");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Twilio credentials");
    });

    it("sends OTP via Twilio REST API when properly configured", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ sid: "SM_mock_twilio_sid_123" }),
      });
      global.fetch = fetchMock;

      const provider = new TwilioOtpProvider("AC12345", "auth_token_987", "+15005550006");
      const res = await provider.sendOtp("+919876543210", "888999");

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("SM_mock_twilio_sid_123");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.twilio.com/2010-04-01/Accounts/AC12345/Messages.json",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic "),
          }),
        })
      );
    });
  });

  describe("Provider Factory Resolution", () => {
    it("returns MockOtpProvider when DEMO_MODE=true", () => {
      process.env.DEMO_MODE = "true";
      const provider = getOtpProvider();
      expect(provider.name).toBe("mock");
    });

    it("returns Fast2SmsOtpProvider when SMS_PROVIDER=fast2sms", () => {
      process.env.DEMO_MODE = "false";
      process.env.SMS_PROVIDER = "fast2sms";
      process.env.FAST2SMS_API_KEY = "dummy_key";
      const provider = getOtpProvider();
      expect(provider.name).toBe("fast2sms");
    });

    it("returns TwilioOtpProvider when SMS_PROVIDER=twilio", () => {
      process.env.DEMO_MODE = "false";
      process.env.SMS_PROVIDER = "twilio";
      process.env.TWILIO_ACCOUNT_SID = "AC_dummy";
      process.env.TWILIO_AUTH_TOKEN = "token_dummy";
      process.env.TWILIO_FROM_PHONE = "+1234567890";
      const provider = getOtpProvider();
      expect(provider.name).toBe("twilio");
    });

    it("falls back to ProductionOtpProviderStub in production when no credentials provided", () => {
      process.env.DEMO_MODE = "false";
      delete process.env.SMS_PROVIDER;
      delete process.env.FAST2SMS_API_KEY;
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      const provider = getOtpProvider();
      expect(provider.name).toBe("production-sms-stub");
    });
  });
});
