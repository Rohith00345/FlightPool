"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Car, CheckCircle, Navigation, RefreshCw, Lock } from "lucide-react";
import { isClientDemoMode } from "@/lib/demo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface DriverStop {
  memberId: string;
  dropoffOrder: number;
  riderName: string;
  destinationAddress: string;
  poolFare: number;
}

interface DriverTripItem {
  id: string;
  status: string;
  driverPayout?: number;
  pickupBay?: string;
}

interface DriverActiveTrip {
  id: string;
  status: string;
  driverPayout: number;
  pickupBay?: string;
  otpCode?: string;
  stops: DriverStop[];
  totalFare?: number;
  platformFee?: number;
}

export default function DriverViewPage() {
  const [trips, setTrips] = useState<DriverTripItem[]>([]);
  void trips;
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activeTrip, setActiveTrip] = useState<DriverActiveTrip | null>(null);

  const fetchTrips = async () => {
    try {
      const res = await fetch("/api/driver/trips");
      if (res.status === 401 || res.status === 403) {
        setUnauthorized(true);
        setTrips([]);
        return;
      }
      setUnauthorized(false);
      const data = await res.json();
      if (data.trips && data.trips.length > 0) {
        setTrips(data.trips);
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
    let ignore = false;
    fetch("/api/driver/trips")
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          setUnauthorized(true);
          setTrips([]);
          return null;
        }
        setUnauthorized(false);
        return res.json();
      })
      .then((data) => {
        if (ignore || !data) return;
        if (data.trips && data.trips.length > 0) {
          setTrips(data.trips);
          loadTripDetails(data.trips[0].id);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col justify-between font-sans">
      <Navbar />

      <main className="w-full max-w-lg mx-auto flex-1 p-4 pb-16 space-y-4">
        {unauthorized && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col items-center justify-between gap-3 shadow-sm text-center">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--foreground)]">Driver Sign-In Required (RBAC)</h4>
              <p className="text-xs text-[var(--muted)] mt-1">
                Access to airport queue assignments and trip manifests requires active driver authorization.
              </p>
            </div>
            {isClientDemoMode() ? (
              <Button
                onClick={handleDriverLogin}
                variant="primary"
                size="sm"
                className="w-full text-xs font-bold"
              >
                Sign In as Ramesh Shinde (Demo Persona)
              </Button>
            ) : (
              <p className="text-xs text-amber-400 font-semibold mt-1">
                Production Mode Active: Driver hardware/token auth required.
              </p>
            )}
          </div>
        )}

        {/* Driver Header Card */}
        <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[var(--primary)] text-black rounded-2xl flex items-center justify-center font-bold">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-base font-display text-[var(--foreground)]">
                  Driver Flight-Deck Portal
                </h1>
                <p className="text-xs text-[var(--muted)] font-mono">BOM Terminal Hub • Assigned Bay P4</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTrips}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </Card>

        {activeTrip ? (
          <div className="space-y-4">
            {/* Earnings Card (C6) */}
            <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <Badge variant="primary" className="text-[10px] font-mono">
                    Status: {activeTrip.status}
                  </Badge>
                  <p className="font-bold text-base text-[var(--foreground)] mt-1 font-mono">
                    Trip #{activeTrip.id.slice(-6)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--muted)] uppercase block font-semibold">
                    Net Driver Payout (85%)
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    ₹{activeTrip.driverPayout}
                  </span>
                </div>
              </div>

              {/* Payout Breakdown */}
              <div className="bg-[var(--surface-2)] p-3.5 rounded-xl border border-[var(--border)] text-xs space-y-1.5">
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Gross Passenger Fares:</span>
                  <span className="font-mono text-[var(--foreground)]">₹{activeTrip.totalFare || 740}</span>
                </div>
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Platform Fee (15%):</span>
                  <span className="font-mono text-[var(--danger)]">-₹{activeTrip.platformFee || 111}</span>
                </div>
                <div className="flex justify-between font-bold text-[var(--foreground)] border-t border-[var(--border)] pt-1.5 text-xs">
                  <span>Net Ledger Deposit:</span>
                  <span className="font-mono text-emerald-400">₹{activeTrip.driverPayout} (Pending Confirmation)</span>
                </div>
              </div>
            </Card>

            {/* OTP Entry Card (C6) */}
            <Card className="p-4 border-[var(--border)] bg-[var(--surface)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                  Airport Bay Pickup OTP
                </span>
                <span className="text-[10px] text-[var(--accent)] font-semibold">Verify Rider at P4</span>
              </div>
              <div className="flex items-center justify-center gap-2 py-1">
                {(activeTrip.otpCode || "1429").split("").map((digit, i) => (
                  <span
                    key={i}
                    className="w-10 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--primary)] font-mono font-bold text-xl flex items-center justify-center shadow-inner"
                  >
                    {digit}
                  </span>
                ))}
              </div>
            </Card>

            {/* Route Sequence Steps (C6) */}
            <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-3">
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Drop-off Sequence ({activeTrip.stops.length} Stops):
              </p>
              <div className="space-y-2">
                <div className="p-3 bg-[var(--surface-2)] rounded-xl text-xs flex items-center gap-3 border border-[var(--border)]">
                  <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-black font-bold flex items-center justify-center text-xs">
                    P
                  </div>
                  <div>
                    <p className="font-bold text-[var(--foreground)]">BOM Terminal Bay P4</p>
                    <p className="text-[11px] text-[var(--muted)]">Passenger Boarding & Luggage Stowing</p>
                  </div>
                </div>

                {activeTrip.stops.map((stop: DriverStop) => (
                  <div
                    key={stop.memberId}
                    className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-black font-bold flex items-center justify-center text-xs">
                        {stop.dropoffOrder}
                      </div>
                      <div>
                        <p className="font-bold text-[var(--foreground)]">{stop.riderName}</p>
                        <p className="text-[11px] text-[var(--muted)]">{stop.destinationAddress}</p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 bg-[var(--surface)] px-2 py-1 rounded-lg border border-[var(--border)]">
                      ₹{stop.poolFare}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Driver Progression CTAs */}
            <div className="pt-2">
              {activeTrip.status === "ASSIGNED" && (
                <Button
                  onClick={() => handleUpdateTrip("START_PICKUP")}
                  className="w-full py-4 text-sm font-bold gap-2 shadow-lg"
                  size="lg"
                >
                  <Navigation className="w-4 h-4" />
                  <span>En Route to Terminal Bay (P4)</span>
                </Button>
              )}

              {activeTrip.status === "EN_ROUTE_PICKUP" && (
                <Button
                  onClick={() => handleUpdateTrip("START_TRIP")}
                  variant="primary"
                  className="w-full py-4 text-sm font-bold gap-2 shadow-lg"
                  size="lg"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Passengers Boarded • Start Trip</span>
                </Button>
              )}

              {activeTrip.status === "IN_TRANSIT" && (
                <Button
                  onClick={() => handleUpdateTrip("COMPLETE_TRIP")}
                  variant="success"
                  className="w-full py-4 text-sm font-bold gap-2 shadow-lg"
                  size="lg"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Drop-offs & Finalize Trip</span>
                </Button>
              )}

              {activeTrip.status === "COMPLETED" && (
                <div className="text-center py-3 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  ✓ Trip Completed • Payout ₹{activeTrip.driverPayout} Logged to Driver Wallet
                </div>
              )}
            </div>
          </div>
        ) : (
          <Card className="p-8 text-center text-[var(--muted)] border-[var(--border)] bg-[var(--surface)]">
            {loading ? "Loading active driver trip manifest..." : "No active trip currently dispatched."}
          </Card>
        )}
      </main>
    </div>
  );
}
