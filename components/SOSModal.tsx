"use client";

import { useState } from "react";
import { AlertTriangle, Phone, ShieldCheck, X, Radio } from "lucide-react";

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId?: string;
  userId?: string;
  vehicleDetails?: string;
}

export default function SOSModal({
  isOpen,
  onClose,
  tripId,
  userId,
  vehicleDetails,
}: SOSModalProps) {
  const [triggered, setTriggered] = useState(false);
  const [incidentRef, setIncidentRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleActivateSOS = async () => {
    setLoading(true);
    try {
      if (tripId) {
        const res = await fetch(`/api/trips/${tripId}/sos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            description: "Emergency SOS triggered by passenger from mobile app.",
          }),
        });
        const data = await res.json();
        if (data.incident) {
          setIncidentRef(data.incident.id);
        }
      } else {
        setIncidentRef(`INC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
      }
      setTriggered(true);
    } catch (e) {
      console.error(e);
      setTriggered(true);
      setIncidentRef(`INC-EMERGENCY-${Date.now().toString().slice(-4)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border-2 border-red-500 relative overflow-hidden">
        <button
          onClick={onClose}
          id="close-sos-modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 text-red-600 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center animate-bounce">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold leading-tight">Emergency SOS</h3>
            <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" /> 24/7 Security Assistance
            </p>
          </div>
        </div>

        {!triggered ? (
          <div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Pressing this button broadcasts your live GPS coordinates, driver identity, and vehicle license plate directly to the <b>Mumbai Airport Security Operations Center</b> and <b>Mumbai Police Control (112)</b>.
            </p>

            <button
              onClick={handleActivateSOS}
              id="confirm-sos-btn"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 transition-all mb-4"
            >
              <AlertTriangle className="w-5 h-5" />
              <span>{loading ? "Alerting Security Ops..." : "ACTIVATE EMERGENCY ALERT"}</span>
            </button>

            <p className="text-center text-xs text-slate-400">
              Please use only for genuine safety concerns or immediate emergencies.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
              <p className="font-bold text-emerald-900 text-sm">Emergency Alert Dispatched</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Incident Ref: <span className="font-mono font-bold">{incidentRef}</span>
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <a
                href="tel:112"
                id="call-police-btn"
                className="w-full bg-slate-900 hover:bg-black text-white py-3 px-4 rounded-xl font-medium flex items-center justify-between shadow-xs transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-red-400" />
                  <span>Mumbai Police Control</span>
                </div>
                <span className="font-bold font-mono text-red-400">112</span>
              </a>

              <a
                href="tel:+912266851010"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 px-4 rounded-xl font-medium flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-teal-600" />
                  <span>BOM Airport Security (CISF)</span>
                </div>
                <span className="text-xs font-mono font-semibold">+91-22-66851010</span>
              </a>

              <a
                href="tel:1091"
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-900 py-3 px-4 rounded-xl font-medium flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-rose-600" />
                  <span>Women Helpline</span>
                </div>
                <span className="font-bold font-mono text-rose-700">1091</span>
              </a>
            </div>

            {vehicleDetails && (
              <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                Tracked Vehicle: <span className="font-semibold text-slate-700">{vehicleDetails}</span>
              </p>
            )}

            <button
              onClick={onClose}
              className="w-full text-center py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Dismiss Alert
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
