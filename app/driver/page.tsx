"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Car, MapPin, CheckCircle, Navigation, Phone, IndianRupee, RefreshCw, Lock } from "lucide-react";

export default function DriverViewPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activeTrip, setActiveTrip] = useState<any>(null);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/metrics");
      if (res.status === 401 || res.status === 403) {
        setUnauthorized(true);
        setTrips([]);
        return;
      }
      setUnauthorized(false);
      const data = await res.json();
      if (data.trips && data.trips.length > 0) {
        setTrips(data.trips);
        // Load details of first trip
        loadTripDetails(data.trips[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDriverLogin = async () => {
    try {
      setLoading(true);
      await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "+919820011223",
          otp: "123456",
          name: "Ramesh Shinde",
          role: "DRIVER",
        }),
      });
      setUnauthorized(false);
      await fetchTrips();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTripDetails = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      const data = await res.json();
      if (data.trip) {
        setActiveTrip(data.trip);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleUpdateTrip = async (action: "START_PICKUP" | "START_TRIP" | "COMPLETE_TRIP") => {
    if (!activeTrip) return;
    try {
      const res = await fetch(`/api/trips/${activeTrip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        await loadTripDetails(activeTrip.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      <Navbar />

      <main className="w-full max-w-md mx-auto flex-1 p-4 pb-16 space-y-4">
        {unauthorized && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex flex-col items-center justify-between gap-3 shadow-sm text-center">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Driver Sign-In Required (RBAC)</h4>
              <p className="text-xs text-slate-500 mt-1">Access to airport queue assignments and trip manifests requires active driver authorization.</p>
            </div>
            <button
              onClick={handleDriverLogin}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition mt-1"
            >
              Sign In as Ramesh Shinde (+919820011223)
            </button>
          </div>
        )}

        {/* Driver Header Card */}
        <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-500 rounded-2xl flex items-center justify-center text-white">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-base">Driver Operations Portal</h1>
                <p className="text-xs text-slate-400">Mumbai Airport Hub (BOM)</p>
              </div>
            </div>
            <button
              onClick={fetchTrips}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeTrip ? (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            {/* Status and Payout Overview */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full">
                  Status: {activeTrip.status}
                </span>
                <p className="font-bold text-base text-slate-900 mt-1">
                  Trip #{activeTrip.id.slice(-6)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Your Payout (85%)</span>
                <span className="text-xl font-black text-emerald-600">
                  ₹{activeTrip.driverPayout}
                </span>
              </div>
            </div>

            {/* OTP Code Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between text-xs text-amber-900">
              <span>Required Rider OTP at Terminal:</span>
              <span className="font-mono font-bold text-base bg-amber-200 px-2.5 py-0.5 rounded-lg text-amber-950">
                {activeTrip.otpCode}
              </span>
            </div>

            {/* Ordered Route Stops */}
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Optimized Route Stops:
              </p>
              <div className="space-y-2">
                {activeTrip.stops.map((stop: any) => (
                  <div
                    key={stop.memberId}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0">
                        {stop.dropoffOrder}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{stop.riderName}</p>
                        <p className="text-[11px] text-slate-500">{stop.destinationAddress}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                      ₹{stop.poolFare}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payout Breakdown */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Total Passenger Fares</span>
                <span>₹{activeTrip.totalFare}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform Commission (15%)</span>
                <span>-₹{activeTrip.platformFee}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5 text-sm">
                <span>Net Driver Payout</span>
                <span className="text-emerald-700">₹{activeTrip.driverPayout}</span>
              </div>
            </div>

            {/* Driver Progression CTAs */}
            <div className="pt-1">
              {activeTrip.status === "ASSIGNED" && (
                <button
                  onClick={() => handleUpdateTrip("START_PICKUP")}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  <span>En Route to Terminal Pickup (P4)</span>
                </button>
              )}

              {activeTrip.status === "EN_ROUTE_PICKUP" && (
                <button
                  onClick={() => handleUpdateTrip("START_TRIP")}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>All Passengers Boarded • Start Trip</span>
                </button>
              )}

              {activeTrip.status === "IN_TRANSIT" && (
                <button
                  onClick={() => handleUpdateTrip("COMPLETE_TRIP")}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete All Drop-offs & Capture Payment</span>
                </button>
              )}

              {activeTrip.status === "COMPLETED" && (
                <div className="text-center py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                  ✓ Trip Completed • Payout ₹{activeTrip.driverPayout} Credited
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-200">
            {loading ? "Loading active driver trips..." : "No active trip assigned yet."}
          </div>
        )}
      </main>
    </div>
  );
}
