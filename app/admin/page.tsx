"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
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
} from "lucide-react";

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [selectedFlightNumber, setSelectedFlightNumber] = useState("6E-204");
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
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
    fetchMetrics();
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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      <Navbar />

      <main className="w-full max-w-2xl mx-auto flex-1 p-4 pb-16 space-y-5">
        {unauthorized && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Admin Authentication Required (RBAC Protected)</h4>
                <p className="text-xs text-slate-500">Only authorized dispatchers and administrators may access Mumbai Airport operations control.</p>
              </div>
            </div>
            {process.env.NEXT_PUBLIC_DEMO_MODE !== "false" ? (
              <button
                onClick={handleAdminLogin}
                className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition"
              >
                Sign In as FlightPool Admin (Demo Persona)
              </button>
            ) : (
              <p className="text-xs text-amber-800 font-semibold">Production Mode Active: Authenticate via Admin SSO.</p>
            )}
          </div>
        )}

        {/* Admin Header */}
        <div className="bg-slate-900 text-white p-5 rounded-3xl flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-lg font-bold">Admin Dispatch & Control</h1>
            <p className="text-xs text-slate-400">Real-Time Mumbai Airport Operations & Fleet Analytics</p>
          </div>
          <button
            onClick={fetchMetrics}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Users className="w-4 h-4 text-teal-600" />
              <span>Match Rate</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{metrics.matchRate}%</p>
            <p className="text-[10px] text-emerald-600 font-semibold">High passenger density</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Car className="w-4 h-4 text-teal-600" />
              <span>Fill Rate</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{metrics.fillRate}</p>
            <p className="text-[10px] text-slate-500">Riders / vehicle average</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Avg Wait Time</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{metrics.avgWaitMinutes}m</p>
            <p className="text-[10px] text-slate-500">Cap: 20 mins max</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              <span>Avg Detour</span>
            </div>
            <p className="text-2xl font-black text-slate-900">+{metrics.avgDetourMinutes}m</p>
            <p className="text-[10px] text-emerald-600 font-semibold">Well within 20m limit</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <span className="font-bold text-teal-600">₹</span>
              <span>Platform Rev</span>
            </div>
            <p className="text-2xl font-black text-teal-800">₹{metrics.platformRevenue}</p>
            <p className="text-[10px] text-slate-500">15% commission share</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span>Incidents</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{metrics.activeIncidentsCount}</p>
            <p className="text-[10px] text-slate-500">Active SOS / alerts</p>
          </div>
        </div>

        {/* Phase 7 Simulation Panel: "Land a Flight" */}
        <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500 text-white flex items-center justify-center">
              <Plane className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Simulate Flight Landing & Auto-Match</h2>
              <p className="text-xs text-slate-300">
                Live BOM Airport Flight Replay • Watch real-time pooling in action
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedFlightNumber}
              onChange={(e) => setSelectedFlightNumber(e.target.value)}
              className="flex-1 bg-slate-800 text-white text-xs p-3 rounded-xl border border-slate-700 focus:outline-none focus:border-teal-400"
            >
              {(data?.flights || []).map((f: any) => (
                <option key={f.id} value={f.flightNumber}>
                  {f.airline} {f.flightNumber} ({f.origin} → BOM {f.terminal}) - {f.status}
                </option>
              ))}
            </select>

            <button
              onClick={handleSimulateFlight}
              id="simulate-flight-btn"
              disabled={simulating}
              className="bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{simulating ? "Processing Landing..." : "Land Flight & Match Pools"}</span>
            </button>
          </div>

          {simulationResult && (
            <div className="bg-teal-950/80 border border-teal-500/50 rounded-2xl p-3.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-teal-300 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{simulationResult.message}</span>
              </div>
              <p className="text-slate-300">
                Terminal: <b>{simulationResult.terminal}</b> • Passengers Processed: <b>{simulationResult.passengersProcessed}</b>
              </p>
              <p className="text-teal-400 font-semibold">
                ✓ Formed {simulationResult.newPoolsFormed} optimal shared cab pools!
              </p>
            </div>
          )}
        </div>

        {/* Active Pools Table */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Active Airport Pools ({data?.pools?.length || 0})
          </h2>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(data?.pools || []).map((pool: any) => (
              <div
                key={pool.id}
                className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{pool.destinationCluster} Cluster</span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-semibold">
                      T{pool.terminal}
                    </span>
                    <span className="text-[10px] text-slate-500">{pool.status}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Riders: {pool.membersCount} • Driver: {pool.driverName} ({pool.vehicle})
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(pool.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Safety & Incident Logs */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Safety & Incident Log</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">BOM Airport Security Feed</span>
          </div>

          <div className="space-y-2">
            {(data?.incidents || []).length > 0 ? (
              data.incidents.map((inc: any) => (
                <div
                  key={inc.id}
                  className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-900 flex items-center gap-1">
                      🚨 {inc.type} Incident ({inc.severity})
                    </span>
                    <span className="text-[10px] font-mono text-red-600">{inc.status}</span>
                  </div>
                  <p className="text-red-800 text-[11px]">{inc.description}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                No active incidents. Mumbai Airport rides operating safely.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
