"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { isClientDemoMode } from "@/lib/demo";
import {
  Users,
  Car,
  Clock,
  TrendingUp,
  AlertTriangle,
  Play,
  RefreshCw,
  CheckCircle2,
  Plane,
  ShieldCheck,
  Lock,
  Search,
  Command,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface AdminFlight {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  terminal: string;
  status: string;
}

interface AdminPool {
  id: string;
  destinationCluster: string;
  terminal: string;
  status: string;
  displayLabel?: string;
  isSolo?: boolean;
  poolType?: string;
  membersCount: number;
  driverName: string;
  vehicle: string;
  createdAt: string;
}

interface AdminIncident {
  id: string;
  type: string;
  severity: string;
  status: string;
  description: string;
}

interface AdminData {
  metrics?: {
    matchRate: number;
    fillRate: number;
    fillRateWithoutSolo?: number;
    soloPoolsCount?: number;
    sharedPoolsCount?: number;
    avgWaitMinutes: number | null;
    avgWaitDisplay?: string;
    avgDetourMinutes: number;
    platformRevenue: number;
    capturedRevenueCompletedTrips?: number;
    capturedRevenueLabel?: string;
    activeIncidentsCount?: number;
  };
  flights?: AdminFlight[];
  pools?: AdminPool[];
  incidents?: AdminIncident[];
}

interface SimulationResult {
  message: string;
  terminal: string;
  passengersProcessed: number;
  newPoolsFormed: number;
}

export default function AdminPage() {
  const demoMode = isClientDemoMode();
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [selectedFlightNumber, setSelectedFlightNumber] = useState("6E-204");
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/admin/metrics");
      if (res.status === 401 || res.status === 403) {
        setUnauthorized(true);
        setData(null);
        return;
      }
      setUnauthorized(false);
      const json = await res.json();
      setData(json);
      if (json.flights && json.flights.length > 0 && !selectedFlightNumber) {
        setSelectedFlightNumber(json.flights[0].flightNumber);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    try {
      setLoading(true);
      await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "+919999999999",
          otp: "123456",
          name: "FlightPool Admin",
          role: "ADMIN",
        }),
      });
      setUnauthorized(false);
      await fetchMetrics();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/metrics")
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          setUnauthorized(true);
          setData(null);
          return null;
        }
        setUnauthorized(false);
        return res.json();
      })
      .then((json) => {
        if (ignore || !json) return;
        setData(json);
        if (json.flights && json.flights.length > 0 && !selectedFlightNumber) {
          setSelectedFlightNumber(json.flights[0].flightNumber);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [selectedFlightNumber]);

  // Command palette keyboard listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSimulateFlight = async () => {
    setSimulating(true);
    setSimulationResult(null);
    try {
      const res = await fetch("/api/admin/simulate-flight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flightNumber: selectedFlightNumber }),
      });
      const resJson = await res.json();
      setSimulationResult(resJson);
      await fetchMetrics();
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  const metrics = data?.metrics || {
    matchRate: 95.0,
    fillRate: 2.4,
    avgWaitMinutes: 12.4,
    avgDetourMinutes: 3.8,
    platformRevenue: 1240,
    activeIncidentsCount: 0,
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {unauthorized && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--foreground)]">
                  Admin Authentication Required (RBAC Protected)
                </h4>
                <p className="text-xs text-[var(--muted)]">
                  Only authorized dispatchers and administrators may access Mumbai Airport operations control.
                </p>
              </div>
            </div>
            {demoMode ? (
              <Button
                onClick={handleAdminLogin}
                variant="primary"
                size="sm"
                className="w-full sm:w-auto text-xs font-bold shrink-0"
              >
                Sign In as FlightPool Admin (Demo Persona)
              </Button>
            ) : null}
          </div>
        )}

        {/* Admin Header with Command Palette Trigger */}
        <Card className="p-5 border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-[var(--foreground)]">
                Admin Flight-Deck & Fleet Control
              </h1>
              <Badge variant="glow" className="text-[10px] font-mono">
                BOM HUB
              </Badge>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Real-Time Mumbai Airport Operations, Bounded Wait Metrics & Incident Dispatch
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-2 transition"
              title="Command Palette"
            >
              <Command className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Commands</span>
              <kbd className="text-[10px] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)] font-mono">
                Ctrl+K
              </kbd>
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchMetrics}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </Card>

        {/* Bento Dashboard KPIs Grid (C6) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-4 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-1">
              <Users className="w-4 h-4 text-[var(--accent)]" />
              <span>Match Rate</span>
            </div>
            <p className="text-2xl font-black font-mono text-[var(--foreground)]">{metrics.matchRate}%</p>
            <p className="text-[10px] text-emerald-400 font-semibold">High corridor density</p>
          </Card>

          <Card className="p-4 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-1">
              <Car className="w-4 h-4 text-[var(--primary)]" />
              <span>Fill Rate</span>
            </div>
            <p className="text-2xl font-black font-mono text-[var(--foreground)]">{metrics.fillRate}</p>
            <p className="text-[10px] text-[var(--muted)]">
              w/o solo: {metrics.fillRateWithoutSolo !== undefined ? metrics.fillRateWithoutSolo : "-"}
            </p>
          </Card>

          <Card className="p-4 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Avg Wait Time</span>
            </div>
            <p className="text-2xl font-black font-mono text-[var(--foreground)]">
              {metrics.avgWaitDisplay ||
                (metrics.avgWaitMinutes !== null && metrics.avgWaitMinutes !== undefined
                  ? `${metrics.avgWaitMinutes}m`
                  : "-")}
            </p>
            <p className="text-[10px] text-[var(--muted)]">24h matched (cap: 20m)</p>
          </Card>

          <Card className="p-4 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-1">
              <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
              <span>Avg Detour</span>
            </div>
            <p className="text-2xl font-black font-mono text-[var(--foreground)]">+{metrics.avgDetourMinutes}m</p>
            <p className="text-[10px] text-emerald-400 font-semibold">&lt; 20m max limit</p>
          </Card>

          <Card className="p-4 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-1">
              <span className="font-bold text-[var(--primary)] font-mono">₹</span>
              <span className="truncate">Captured revenue</span>
            </div>
            <p className="text-2xl font-black font-mono text-[var(--primary)]">
              ₹{metrics.capturedRevenueCompletedTrips ?? metrics.platformRevenue}
            </p>
            <p className="text-[10px] text-[var(--muted)]">15% on completed trips</p>
          </Card>

          <Card className="p-4 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Incidents</span>
            </div>
            <p className="text-2xl font-black font-mono text-[var(--foreground)]">
              {metrics.activeIncidentsCount || 0}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Active SOS alerts</p>
          </Card>
        </div>

        {/* Simulator Panel (Demo mode only) */}
        {demoMode && (
          <Card className="p-5 border-[var(--border)] bg-gradient-to-br from-[#0B1424] to-[#141C30] shadow-lg text-white space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[var(--primary)] text-black flex items-center justify-center font-bold">
                <Plane className="w-4 h-4 transform -rotate-45" />
              </div>
              <div>
                <h2 className="text-base font-bold font-display text-white">
                  Simulate Flight Landing & Auto-Match (Demo Mode Only)
                </h2>
                <p className="text-xs text-slate-300">
                  Replays flight arrivals and dispatches multi-rider pools deterministically.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedFlightNumber}
                onChange={(e) => setSelectedFlightNumber(e.target.value)}
                className="flex-1 bg-[var(--surface)] text-[var(--foreground)] text-xs p-3 rounded-xl border border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
              >
                {(data?.flights || []).map((f: AdminFlight) => (
                  <option key={f.id} value={f.flightNumber}>
                    {f.airline} {f.flightNumber} ({f.origin} → BOM {f.terminal}) - {f.status}
                  </option>
                ))}
              </select>

              <Button
                onClick={handleSimulateFlight}
                id="simulate-flight-btn"
                disabled={simulating}
                className="gap-1.5 text-xs font-bold"
                size="md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{simulating ? "Processing Landing..." : "Land Flight & Match Pools"}</span>
              </Button>
            </div>

            {simulationResult && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{simulationResult.message}</span>
                </div>
                <p className="text-slate-300">
                  Terminal: <b>{simulationResult.terminal}</b> • Processed: <b>{simulationResult.passengersProcessed}</b>
                </p>
                <p className="text-emerald-400 font-semibold">
                  ✓ Formed {simulationResult.newPoolsFormed} optimal shared cab pools!
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Live Pools and Incident Board Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Airport Pools */}
          <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent)]" />
                <span>Active Airport Pools ({data?.pools?.length || 0})</span>
              </h2>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(data?.pools || []).length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--muted)]">
                  No active pools forming at this moment.
                </div>
              ) : (
                (data?.pools || []).map((pool: AdminPool) => (
                  <div
                    key={pool.id}
                    className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--foreground)]">{pool.destinationCluster} Corridor</span>
                        <Badge variant="outline" className="text-[10px]">
                          {pool.terminal === "T1" || pool.terminal === "T2" ? pool.terminal : "T2"}
                        </Badge>
                        {pool.displayLabel === "Solo" || (pool.membersCount === 1 && pool.status === "CONFIRMED") ? (
                          <Badge variant="warning" className="text-[10px]">
                            Solo
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] font-mono">{pool.status}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5">
                        Riders: {pool.membersCount} • Driver: {pool.driverName} ({pool.vehicle})
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--muted)]">
                      {new Date(pool.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Safety & Incident Log */}
          <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                <span>Safety & Incident Log</span>
              </h2>
              <span className="text-[10px] text-[var(--muted)] font-mono">BOM Airport Police Feed</span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(data?.incidents || []).length > 0 ? (
                (data?.incidents || []).map((inc: AdminIncident) => (
                  <div
                    key={inc.id}
                    className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-rose-400 flex items-center gap-1">
                        🚨 {inc.type} Incident ({inc.severity})
                      </span>
                      <span className="text-[10px] font-mono text-rose-400">{inc.status}</span>
                    </div>
                    <p className="text-[var(--foreground)] text-[11px]">{inc.description}</p>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-[var(--muted)]">
                  ✓ No active incidents. Mumbai Airport rides operating normally.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Command Palette Modal (Ctrl+K) */}
        {commandPaletteOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
            <Card className="w-full max-w-lg p-4 border-[var(--border)] bg-[var(--surface)] shadow-2xl space-y-3">
              <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                <Search className="w-4 h-4 text-[var(--muted)]" />
                <input
                  type="text"
                  autoFocus
                  value={commandSearch}
                  onChange={(e) => setCommandSearch(e.target.value)}
                  placeholder="Type a command or search action (e.g. simulate, refresh, logs)..."
                  className="flex-1 bg-transparent text-xs text-[var(--foreground)] focus:outline-none"
                />
                <kbd
                  onClick={() => setCommandPaletteOpen(false)}
                  className="cursor-pointer text-[10px] text-[var(--muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded border border-[var(--border)]"
                >
                  ESC
                </kbd>
              </div>

              <div className="space-y-1 text-xs">
                <button
                  onClick={() => {
                    fetchMetrics();
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full p-2.5 rounded-lg text-left hover:bg-[var(--surface-2)] flex items-center justify-between text-[var(--foreground)]"
                >
                  <span>Refresh Fleet KPIs</span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">Action</span>
                </button>

                {demoMode && (
                  <button
                    onClick={() => {
                      handleSimulateFlight();
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full p-2.5 rounded-lg text-left hover:bg-[var(--surface-2)] flex items-center justify-between text-[var(--foreground)]"
                  >
                    <span>Land Flight Replay & Trigger Matching</span>
                    <span className="text-[10px] text-[var(--primary)] font-mono">Simulate</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    router.push("/landing-wave");
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full p-2.5 rounded-lg text-left hover:bg-[var(--surface-2)] flex items-center justify-between text-[var(--foreground)]"
                >
                  <span>Go to Landing Wave Arrivals Board</span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">Navigate</span>
                </button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
