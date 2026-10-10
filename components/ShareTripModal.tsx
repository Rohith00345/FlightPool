"use client";

import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, X } from "lucide-react";

interface ShareTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  driverName?: string;
  vehicleNumber?: string;
}

export default function ShareTripModal({
  isOpen,
  onClose,
  tripId,
  driverName,
  vehicleNumber,
}: ShareTripModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const shareUrl = `${origin}/trip/${tripId}/live`;
  const shareText = `I'm sharing a FlightPool cab from Mumbai Airport in ${vehicleNumber || "Cab"} driven by ${driverName || "Driver"}. Track my trip live: ${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 text-teal-700 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Share Live Trip</h3>
            <p className="text-xs text-slate-500 font-medium">Real-Time GPS Tracking Link</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Share this live tracking link with family or friends. They can view real-time location, vehicle license plate, and drop-off updates.
        </p>

        <div className="flex items-center gap-2 p-2.5 bg-slate-100 rounded-xl border border-slate-200 mb-4">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="text-xs bg-transparent text-slate-700 font-mono w-full focus:outline-none select-all"
          />
          <button
            onClick={handleCopy}
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs border border-slate-200 transition-colors shrink-0"
            title="Copy Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleWhatsApp}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </button>

          <button
            onClick={onClose}
            className="w-full text-slate-500 hover:text-slate-800 text-xs py-2 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
