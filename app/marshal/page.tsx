"use client";

import { useEffect, useState } from "react";
import {
  Compass,
  CheckCircle2,
  Users,
  Car,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Luggage,
} from "lucide-react";

interface PickupBay {
  id: string;
  label: string;
  active: boolean;
}

interface TerminalInfo {
  code: string;
  name: string;
  bays: PickupBay[];
}

interface RiderInfo {
  id: string;
  name: string;
  phone: string;
  destination: string;
  status: string;
  bags: number;
}

interface ActiveTrip {
  id: string;
  status: string;
  otpCode: string;
  cluster: string;
  driver: {
    name: string;
    phone: string;
    rating: number;
  };
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
    color: string;
  };
  riders: RiderInfo[];
}

export default function MarshalDashboardPage() {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string>("T2");
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const res = await fetch(`/api/marshal/station?terminal=${selectedTerminal}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("Access restricted to Marshals and Airport Admins.");
          }
          throw new Error("Failed to load marshal station operations.");
        }
        const data = await res.json();
        if (isMounted) {
          setTerminals(data.terminals || []);
          setActiveTrips(data.activeTrips || []);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) setError((err as Error).message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedTerminal, refreshKey]);

  async function handleVerifyBoarding(memberId: string) {
    try {
      const res = await fetch("/api/marshal/station", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY_BOARDING", memberId }),
      });
      if (res.ok) {
        setActionSuccess("Passenger verified and boarded.");
        setTimeout(() => setActionSuccess(null), 3000);
        setRefreshKey((k) => k + 1);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDispatchTrip(tripId: string) {
    try {
      const res = await fetch("/api/marshal/station", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DISPATCH_TRIP", tripId }),
      });
      if (res.ok) {
        setActionSuccess("Trip dispatched from bay!");
        setTimeout(() => setActionSuccess(null), 3000);
        setRefreshKey((k) => k + 1);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const currentTermInfo = terminals.find((t) => t.code === selectedTerminal);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header bar */}
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Airport Marshal Station</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  GROUND OPS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Chhatrapati Shivaji Maharaj International Airport (BOM) • Bay Dispatch Control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTerminal("T2")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedTerminal === "T2"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Terminal 2 (Sahar)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTerminal("T1")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedTerminal === "T1"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Terminal 1 (Santa Cruz)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {actionSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Pickup Bays Grid */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>Designated Pickup Bays</span>
            <span className="text-xs font-normal text-slate-500">
              ({currentTermInfo?.bays.length || 0} active bays)
            </span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {currentTermInfo?.bays.map((bay) => (
              <div
                key={bay.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow"
              >
                <span className="text-xs text-slate-400 font-mono">BAY</span>
                <span className="text-sm font-bold text-amber-400 mt-0.5">{bay.label}</span>
                <span className="mt-2 text-[10px] uppercase font-semibold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Ready
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Active Boarding Vehicles */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>Vehicles in Bay & Boarding Queue</span>
              <span className="text-xs font-normal text-slate-500">
                ({activeTrips.length} active pools)
              </span>
            </h2>
          </div>

          {activeTrips.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 text-center text-slate-400 space-y-2">
              <Car className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="font-medium text-slate-300">No active vehicles currently in pickup bays.</p>
              <p className="text-xs text-slate-500">
                When passenger pools match and vehicles arrive at {selectedTerminal}, they will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-amber-400">
                          {trip.vehicle.licensePlate}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {trip.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {trip.vehicle.color} {trip.vehicle.make} {trip.vehicle.model} • Driver: {trip.driver.name} (★ {trip.driver.rating})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">OTP Code</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm tracking-wider">
                        {trip.otpCode}
                      </span>
                    </div>
                  </div>

                  {/* Riders List */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Assigned Passengers ({trip.riders.length}/3)</span>
                    </p>

                    <div className="space-y-1.5">
                      {trip.riders.map((rider) => (
                        <div
                          key={rider.id}
                          className="bg-slate-950/70 rounded-xl p-2.5 flex items-center justify-between text-xs border border-slate-800/60"
                        >
                          <div>
                            <span className="font-medium text-slate-200">{rider.name}</span>
                            <span className="text-slate-500 ml-1.5">({rider.destination})</span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Luggage className="w-3 h-3 text-amber-400" />
                                {rider.bags} bags
                              </span>
                              <span>•</span>
                              <span className="text-indigo-400 font-mono">{rider.status}</span>
                            </div>
                          </div>

                          {rider.status !== "PICKED_UP" ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyBoarding(rider.id)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition text-[11px]"
                            >
                              Verify Board
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Boarded
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trip dispatch action */}
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Destination Cluster: <strong className="text-slate-200">{trip.cluster}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDispatchTrip(trip.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow"
                    >
                      <span>Dispatch Bay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
