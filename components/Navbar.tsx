"use client";

import Link from "next/link";
import { Plane, ShieldAlert, Car, LayoutDashboard, User } from "lucide-react";

interface NavbarProps {
  onSOSClick?: () => void;
  currentUser?: { name: string; phone: string } | null;
}

export default function Navbar({ onSOSClick, currentUser }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight flex items-center gap-1.5 leading-none">
              <span>FlightPool</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider bg-teal-950 text-teal-300 border border-teal-800/60 px-1.5 py-0.5 rounded">
                BOM
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              फ़्लाइटपूल • Mumbai Airport Cab Sharing
            </p>
          </div>
        </Link>

        {/* Quick Nav & Emergency SOS */}
        <div className="flex items-center gap-2">
          {onSOSClick && (
            <button
              onClick={onSOSClick}
              id="global-sos-btn"
              className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all animate-pulse"
              title="Emergency SOS / आपातकालीन सहायता"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>SOS</span>
            </button>
          )}

          <Link
            href="/admin"
            id="nav-admin-link"
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Admin Dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
          </Link>

          <Link
            href="/driver"
            id="nav-driver-link"
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Driver View"
          >
            <Car className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
