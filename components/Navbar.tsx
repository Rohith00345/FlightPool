"use client";

import Link from "next/link";
import { Plane, ShieldAlert, Car, LayoutDashboard } from "lucide-react";

interface NavbarProps {
  onSOSClick?: () => void;
  currentUser?: { name: string; phone: string } | null;
}

export default function Navbar({ onSOSClick, currentUser }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md text-white border-b border-slate-800 shadow-md">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight flex items-center gap-1.5 leading-none">
              <span>FlightPool</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-teal-950 text-teal-300 border border-teal-800/80 px-1.5 py-0.5 rounded-full">
                BOM
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
              Mumbai Airport Cab Sharing
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
              title="Emergency SOS Security Alert"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>SOS</span>
            </button>
          )}

          <Link
            href="/driver"
            id="nav-driver-link"
            className="px-2 py-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors flex items-center gap-1 text-xs font-medium border border-transparent hover:border-slate-700"
            title="Driver Portal"
          >
            <Car className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden xs:inline">Driver</span>
          </Link>

          <Link
            href="/admin"
            id="nav-admin-link"
            className="px-2 py-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors flex items-center gap-1 text-xs font-medium border border-transparent hover:border-slate-700"
            title="Ops Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden xs:inline">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
