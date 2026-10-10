"use client";

import { use, useEffect, useState } from "react";
import { ShieldCheck, Car, MapPin, Navigation, Clock } from "lucide-react";

interface SharedTripData {
  active: boolean;
  tripId: string;
  status: string;
  terminal: string;
  destinationZone: string;
  driver: {
    name: string;
    rating: number;
    lat: number;
    lng: number;
  };
  vehicle: {
    make: string;
    model: string;
    color: string;
    maskedPlate: string;
  };
  expiresAt: string;
}

export default function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [trip, setTrip] = useState<SharedTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchTrip() {
      try {
        const res = await fetch(`/api/trips/share/${token}`);
        if (!res.ok) {
          throw new Error("This trip sharing link is invalid or has expired.");
        }
        const data = await res.json();
        if (isMounted) setTrip(data);
      } catch (err: unknown) {
        if (isMounted) setError((err as Error).message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchTrip();
    const interval = setInterval(fetchTrip, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading live trip tracker...</p>
        </div>
      </main>
    );
  }

  if (error || !trip) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center">
          <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Trip Link Expired</h1>
          <p className="text-slate-400 text-sm">{error || "Unable to find trip"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-lg space-y-4">
        <header className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Live Trip Status
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {trip.status}
                </span>
              </h1>
              <p className="text-xs text-slate-400">FlightPool Verified Safety Share</p>
            </div>
          </div>
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
        </header>

        {/* Vehicle & Driver Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold text-indigo-400">
                {trip.driver.name.charAt(0)}
              </div>
              <div>
                <h2 className="font-semibold text-slate-100">{trip.driver.name}</h2>
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <span>★ {trip.driver.rating.toFixed(1)}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">Verified Driver</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Car className="w-4 h-4 text-indigo-400" />
                <span>Vehicle</span>
              </div>
              <p className="font-medium text-sm text-slate-200">
                {trip.vehicle.color} {trip.vehicle.make} {trip.vehicle.model}
              </p>
              <p className="text-xs text-indigo-400 font-mono mt-0.5">{trip.vehicle.maskedPlate}</p>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span>Destination</span>
              </div>
              <p className="font-medium text-sm text-slate-200">{trip.destinationZone}</p>
              <p className="text-xs text-slate-400 mt-0.5">Pickup: {trip.terminal}</p>
            </div>
          </div>

          <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl p-3.5 flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300">
              <p className="font-medium text-indigo-300 mb-0.5">Live Telemetry Active</p>
              <p className="text-slate-400">
                Vehicle GPS is actively updating every few seconds. Link expires at{" "}
                {new Date(trip.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
