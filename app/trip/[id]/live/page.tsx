"use client";

import { use, useEffect, useState, Suspense } from "react";
import Navbar from "@/components/Navbar";
import { ShieldCheck, Phone, CheckCircle } from "lucide-react";


function LiveTripContent({ id }: { id: string }) {
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.trip) setTrip(data.trip);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full">
            FlightPool Live Share
          </span>
          <h1 className="text-base font-bold text-slate-900 mt-1">Live Passenger Tracking</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8 text-xs text-slate-400">Loading live trip details...</p>
      ) : trip ? (
        <div className="space-y-4">
          {/* Status Header */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Current Trip State</p>
              <p className="text-base font-bold text-teal-400">{trip.status.replace("_", " ")}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Vehicle</p>
              <p className="font-mono font-bold text-sm">{trip.vehicle?.licensePlate}</p>
            </div>
          </div>

          {/* Driver & Cab Details */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-900">{trip.driver?.name}</p>
              <p className="text-slate-500">
                {trip.vehicle?.color} {trip.vehicle?.make} {trip.vehicle?.model}
              </p>
              <p className="text-teal-700 font-semibold mt-0.5">Rating: ⭐ {trip.driver?.rating}</p>
            </div>
            <a
              href={`tel:${trip.driver?.phone}`}
              className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs text-teal-700"
              title="Call Driver"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>

          {/* Stops Progress */}
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Drop-off Route:
            </p>
            <div className="space-y-2">
              {trip.stops?.map((stop: any) => (
                <div
                  key={stop.memberId}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[10px]">
                      #{stop.dropoffOrder}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">{stop.riderName}</p>
                      <p className="text-[10px] text-slate-500">{stop.destinationAddress}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-teal-700 font-semibold">{stop.destinationZone}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verified Safety Badge */}
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-[11px] text-emerald-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              FlightPool GPS & Airport Security Monitoring active. Police Emergency Helpline: 112.
            </span>
          </div>
        </div>
      ) : (
        <p className="text-center py-8 text-xs text-slate-400">Trip not found or link expired.</p>
      )}
    </div>
  );
}

export default function LiveTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      <Navbar />
      <main className="w-full max-w-md mx-auto flex-1 p-4 pb-16 space-y-4">
        <Suspense fallback={<p className="text-center text-xs text-slate-400 py-8">Loading trip stream...</p>}>
          <LiveTripContent id={resolved.id} />
        </Suspense>
      </main>
    </div>
  );
}
