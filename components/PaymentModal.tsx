"use client";

import { useState } from "react";
import { CreditCard, QrCode, Shield, CheckCircle2, X } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Razorpay Mock Header */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              ₹
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-none">Razorpay Mock</p>
              <p className="text-[10px] text-slate-400">FlightPool Secure Checkout</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Sandbox
          </span>
        </div>

        {/* Price & Savings Highlight */}
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 mb-4 text-center">
          <p className="text-xs text-teal-800 font-medium">Your Pool Share / आपका किराया</p>
          <div className="text-3xl font-extrabold text-teal-950 mt-0.5">₹{poolFare}</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs font-semibold">
            <span className="text-slate-400 line-through">₹{soloFare}</span>
            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              Save ₹{savingsAmount} ({savingsPct}%)
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2 mb-6">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Select Payment Method
          </label>

          <button
            type="button"
            onClick={() => setMethod("UPI")}
            className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
              method === "UPI"
                ? "border-teal-600 bg-teal-50/50 shadow-xs"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <QrCode className="w-5 h-5 text-teal-600" />
              <div className="text-left">
                <p className="text-sm font-bold text-slate-800">UPI (GPay / PhonePe / Paytm)</p>
                <p className="text-[11px] text-slate-500">Instant authorization</p>
              </div>
            </div>
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                method === "UPI" ? "border-teal-600 bg-teal-600" : "border-slate-300"
              }`}
            >
              {method === "UPI" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMethod("CARD")}
            className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
              method === "CARD"
                ? "border-teal-600 bg-teal-50/50 shadow-xs"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-teal-600" />
              <div className="text-left">
                <p className="text-sm font-bold text-slate-800">Credit / Debit Card</p>
                <p className="text-[11px] text-slate-500">Visa, Mastercard, RuPay</p>
              </div>
            </div>
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                method === "CARD" ? "border-teal-600 bg-teal-600" : "border-slate-300"
              }`}
            >
              {method === "CARD" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          </button>
        </div>

        {/* Trust Notice */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <Shield className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Payment authorized now; captured only after successful trip drop-off. 100% refund if cancelled.</span>
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
            <span className="flex items-center gap-1.5 text-emerald-200">
              <CheckCircle2 className="w-5 h-5" /> Authorized!
            </span>
          ) : (
            <span>AUTHORIZE ₹{poolFare} • भुगतान करें</span>
          )}
        </button>
      </div>
    </div>
  );
}
