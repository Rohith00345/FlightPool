"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header bar */}
        <Card className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)]">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight font-display text-[var(--foreground)]">
                  Airport Marshal Station
                </h1>
                <Badge variant="glow" className="text-[10px] uppercase font-bold">
                  GROUND OPS
                </Badge>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Chhatrapati Shivaji Maharaj International Airport (BOM) • Bay Dispatch Control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-[var(--surface-2)] p-1 rounded-xl border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSelectedTerminal("T2")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedTerminal === "T2"
                    ? "bg-[var(--primary)] text-black shadow"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Terminal 2 (Sahar)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTerminal("T1")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedTerminal === "T1"
                    ? "bg-[var(--primary)] text-black shadow"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Terminal 1 (Santa Cruz)
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </Card>

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

        {/* Pickup Bays Grid (C6) */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center gap-2">
            <span>Designated Pickup Bays (Bay A - D)</span>
            <span className="font-normal text-[var(--muted)]">
              ({currentTermInfo?.bays.length || 0} active bays)
            </span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {currentTermInfo?.bays.map((bay) => (
              <Card
                key={bay.id}
                className="p-3 border-[var(--border)] bg-[var(--surface)] flex flex-col items-center justify-center text-center shadow"
              >
                <span className="text-[10px] text-[var(--muted)] font-mono">BAY</span>
                <span className="text-sm font-bold text-[var(--primary)] mt-0.5">{bay.label}</span>
                <span className="mt-2 text-[10px] uppercase font-semibold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Ready
                </span>
              </Card>
            ))}
          </div>
        </section>

        {/* Active Boarding Vehicles */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center gap-2">
              <span>Vehicles in Bay & Boarding Queue</span>
              <span className="font-normal text-[var(--muted)]">
                ({activeTrips.length} active pools)
              </span>
            </h2>
          </div>

          {activeTrips.length === 0 ? (
            <Card className="p-8 text-center text-[var(--muted)] border-[var(--border)] bg-[var(--surface)] space-y-2">
              <Car className="w-10 h-10 mx-auto text-[var(--muted)] mb-2" />
              <p className="font-medium text-[var(--foreground)]">No active vehicles currently in pickup bays.</p>
              <p className="text-xs text-[var(--muted)]">
                When passenger pools match and vehicles arrive at {selectedTerminal}, they will appear here automatically.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTrips.map((trip) => (
                <Card
                  key={trip.id}
                  className="p-5 border-[var(--border)] bg-[var(--surface)] shadow-lg space-y-4 hover:border-[var(--muted)] transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[var(--primary)]">
                          {trip.vehicle.licensePlate}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {trip.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        {trip.vehicle.color} {trip.vehicle.make} {trip.vehicle.model} • Driver: {trip.driver.name} (★ {trip.driver.rating})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[var(--muted)] block uppercase font-mono">OTP Code</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm tracking-wider">
                        {trip.otpCode}
                      </span>
                    </div>
                  </div>

                  {/* Riders List */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <p className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Assigned Passengers ({trip.riders.length}/3)</span>
                    </p>

                    <div className="space-y-1.5">
                      {trip.riders.map((rider) => (
                        <div
                          key={rider.id}
                          className="bg-[var(--surface-2)] rounded-xl p-2.5 flex items-center justify-between text-xs border border-[var(--border)]"
                        >
                          <div>
                            <span className="font-medium text-[var(--foreground)]">{rider.name}</span>
                            <span className="text-[var(--muted)] ml-1.5">({rider.destination})</span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--muted)]">
                              <span className="flex items-center gap-1">
                                <Luggage className="w-3 h-3 text-[var(--primary)]" />
                                {rider.bags} bags
                              </span>
                              <span>•</span>
                              <span className="text-[var(--accent)] font-mono">{rider.status}</span>
                            </div>
                          </div>

                          {rider.status !== "PICKED_UP" ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyBoarding(rider.id)}
                              className="px-2.5 py-1 rounded-lg bg-[var(--primary)] hover:opacity-90 text-black font-bold transition text-[11px]"
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
                  <div className="pt-2 flex items-center justify-between border-t border-[var(--border)]">
                    <span className="text-xs text-[var(--muted)]">
                      Cluster: <strong className="text-[var(--foreground)]">{trip.cluster}</strong>
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleDispatchTrip(trip.id)}
                      className="gap-1.5 text-xs font-bold"
                    >
                      <span>Dispatch Bay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
