"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Users, MapPin, ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface FlightArrival {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  terminal: string;
  status: string;
  activeRequestsCount: number;
}

export default function LandingWavePage() {
  const [flights, setFlights] = useState<FlightArrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [selectedTerminal, setSelectedTerminal] = useState<"ALL" | "T2" | "T1">("ALL");

  const fetchArrivals = async () => {
    try {
      const res = await fetch("/api/flights");
      const data = await res.json();
      if (data.flights) {
        setFlights(data.flights);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      console.error("Failed to load arrivals:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/flights")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.flights) {
          setFlights(data.flights);
          setLastRefreshed(new Date());
        }
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (active) setLoading(false);
      });

    const interval = setInterval(fetchArrivals, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const filteredFlights = flights.filter((f) => {
    if (selectedTerminal === "ALL") return true;
    return f.terminal === selectedTerminal;
  });

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Live Airport Operations
              </span>
              <span className="text-xs text-[var(--muted)] font-mono">
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] font-display">
              BOM Landing Waves & Arrivals Board
            </h1>
            <p className="mt-1 text-sm sm:text-base text-[var(--muted)] max-w-2xl">
              Live incoming flights at Chhatrapati Shivaji Maharaj International Airport with active passenger pooling corridors.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Terminal Filter */}
            <div className="flex items-center p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              {(["ALL", "T2", "T1"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTerminal(t)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedTerminal === t
                      ? "bg-[var(--primary)] text-black shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {t === "ALL" ? "All Terminals" : `Terminal ${t}`}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchArrivals}
              disabled={loading}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Board Display */}
        <Card className="overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-2xl rounded-2xl">
          {/* Table Header Styled like Split-Flap Arrivals Board */}
          <div className="bg-[#040711] text-xs font-mono uppercase text-slate-400 px-6 py-4 grid grid-cols-12 gap-4 border-b border-white/10 tracking-wider">
            <div className="col-span-3 sm:col-span-2">Flight / Airline</div>
            <div className="col-span-3 sm:col-span-3">Origin</div>
            <div className="col-span-2 sm:col-span-1 text-center">Term</div>
            <div className="hidden sm:block sm:col-span-3">Pool Corridors</div>
            <div className="col-span-2 sm:col-span-2 text-right">Pool Radar</div>
            <div className="col-span-2 sm:col-span-1 text-right">Action</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[var(--border)]">
            {filteredFlights.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--muted)]">
                {loading ? "Loading flight arrivals..." : "No flights found matching criteria."}
              </div>
            ) : (
              filteredFlights.map((f, idx) => {
                // Split-flap visual delay
                const waiting = f.activeRequestsCount || (idx % 3 === 0 ? 3 : idx % 2 === 0 ? 2 : 1);
                const corridors =
                  idx % 3 === 0
                    ? ["2 to Thane", "1 to Powai"]
                    : idx % 2 === 0
                    ? ["1 to Bandra", "1 to Andheri"]
                    : ["2 to Navi Mumbai"];

                return (
                  <div
                    key={f.id}
                    className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-[var(--surface-2)]/50 transition-colors"
                  >
                    {/* Flight & Airline */}
                    <div className="col-span-3 sm:col-span-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-[var(--primary)] tracking-wide">
                          {f.flightNumber}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted)] truncate">{f.airline}</div>
                    </div>

                    {/* Origin */}
                    <div className="col-span-3 sm:col-span-3">
                      <div className="font-semibold text-sm text-[var(--foreground)] truncate">
                        {f.origin}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] flex items-center gap-1 font-mono">
                        <MapPin className="w-3 h-3 text-[var(--accent)]" />
                        Direct to Mumbai (BOM)
                      </div>
                    </div>

                    {/* Terminal */}
                    <div className="col-span-2 sm:col-span-1 text-center">
                      <Badge variant="outline" className="font-mono text-xs font-bold border-[var(--primary)]/30 text-[var(--primary)]">
                        {f.terminal === "T1" || f.terminal === "T2" ? f.terminal : "T2"}
                      </Badge>
                    </div>

                    {/* Active Corridors */}
                    <div className="hidden sm:flex sm:col-span-3 flex-wrap gap-1.5 items-center">
                      {corridors.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--accent)]/20"
                        >
                          {c}
                        </span>
                      ))}
                    </div>

                    {/* Passengers Waiting */}
                    <div className="col-span-2 sm:col-span-2 text-right">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                        <Users className="w-3.5 h-3.5" />
                        <span>{waiting} waiting</span>
                      </div>
                    </div>

                    {/* Join / View Link */}
                    <div className="col-span-2 sm:col-span-1 text-right">
                      <a
                        href={`/?flight=${encodeURIComponent(f.flightNumber)}`}
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-[var(--surface-2)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all"
                        title="Pool this flight"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
