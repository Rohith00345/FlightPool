"use client";

import { useState } from "react";
import { CreditCard, Shield, CheckCircle2, X, Lock, Sparkles, Smartphone } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolFare: number;
  soloFare: number;
  savingsPct: number;
  onConfirmPayment: (method: "UPI" | "CARD" | "NETBANKING") => Promise<void>;
}

export default function PaymentModal({
  isOpen,
  onClose,
  poolFare,
  soloFare,
  savingsPct,
  onConfirmPayment,
}: PaymentModalProps) {
  const [method, setMethod] = useState<"UPI" | "CARD" | "NETBANKING">("UPI");
  const [selectedUpiApp, setSelectedUpiApp] = useState<"GPAY" | "PHONEPE" | "PAYTM" | "CRED">("GPAY");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handlePay = async () => {
    setLoading(true);
    try {
      await onConfirmPayment(method);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const savingsAmount = soloFare - poolFare;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative overflow-hidden">
        {/* Subtle accent gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-indigo-500" />

        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Razorpay Mock Header */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              ₹
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-none">Razorpay Secure</p>
              <p className="text-[10px] text-slate-400">FlightPool Instant Escrow</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> 256-Bit SSL
          </span>
        </div>

        {/* Price & Savings Highlight */}
        <div className="bg-gradient-to-b from-teal-50/80 to-emerald-50/40 border border-teal-200/80 rounded-2xl p-4 mb-4 text-center">
          <p className="text-xs text-teal-800 font-semibold tracking-wide uppercase">Your Pool Share</p>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">₹{poolFare}</div>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-xs font-semibold">
            <span className="text-slate-400 line-through">₹{soloFare}</span>
            <span className="text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" /> Save ₹{savingsAmount} ({savingsPct}%)
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2.5 mb-5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Select Payment Method
          </label>

          {/* UPI Option */}
          <button
            type="button"
            onClick={() => setMethod("UPI")}
            className={`w-full p-3 rounded-2xl border text-left transition-all ${
              method === "UPI"
                ? "border-teal-600 bg-teal-50/60 shadow-xs ring-1 ring-teal-500/30"
                : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Instant UPI Payment</p>
                  <p className="text-[10px] text-slate-500">Google Pay, PhonePe, Paytm, CRED</p>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  method === "UPI" ? "border-teal-600 bg-teal-600" : "border-slate-300"
                }`}
              >
                {method === "UPI" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>

            {/* UPI App Quick Selector */}
            {method === "UPI" && (
              <div className="mt-3 pt-2.5 border-t border-teal-200/50 grid grid-cols-4 gap-1.5">
                {[
                  { id: "GPAY", label: "GPay" },
                  { id: "PHONEPE", label: "PhonePe" },
                  { id: "PAYTM", label: "Paytm" },
                  { id: "CRED", label: "CRED" },
                ].map((app) => (
                  <div
                    key={app.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUpiApp(app.id as "GPAY" | "PHONEPE" | "PAYTM" | "CRED");
                    }}
                    className={`py-1 text-center rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                      selectedUpiApp === app.id
                        ? "bg-teal-700 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-teal-50"
                    }`}
                  >
                    {app.label}
                  </div>
                ))}
              </div>
            )}
          </button>

          {/* Card Option */}
          <button
            type="button"
            onClick={() => setMethod("CARD")}
            className={`w-full p-3 rounded-2xl border text-left transition-all ${
              method === "CARD"
                ? "border-teal-600 bg-teal-50/60 shadow-xs ring-1 ring-teal-500/30"
                : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Credit / Debit Card</p>
                  <p className="text-[10px] text-slate-500">Visa, Mastercard, RuPay, Amex</p>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  method === "CARD" ? "border-teal-600 bg-teal-600" : "border-slate-300"
                }`}
              >
                {method === "CARD" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
          </button>
        </div>

        {/* Trust Notice */}
        <div className="flex items-start gap-2 text-[11px] text-slate-500 mb-5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
          <Shield className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <span>Fare is authorized now in escrow and charged only when you arrive at your destination. 100% refund on cancellation.</span>
        </div>

        {/* Primary CTA */}
        <button
          onClick={handlePay}
          id="confirm-pay-btn"
          disabled={loading}
          className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-3.5 rounded-2xl text-base shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
        >
          {loading ? (
            <span>Authorizing Payment...</span>
          ) : success ? (
            <span className="flex items-center gap-1.5 text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" /> Authorized Successfully!
            </span>
          ) : (
            <span>AUTHORIZE ₹{poolFare}</span>
          )}
        </button>
      </div>
    </div>
  );
}
