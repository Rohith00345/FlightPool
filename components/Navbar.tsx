"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, ShieldCheck, Moon, Sun, Monitor, Car, LayoutDashboard } from "lucide-react";
import { useTheme } from "next-themes";
import { Language } from "@/lib/i18n";

interface NavbarProps {
  onSOSClick?: () => void;
  currentUser?: { name: string; phone: string; role?: string } | null;
  currentLanguage?: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function Navbar({
  onSOSClick,
  currentUser,
  currentLanguage = "en",
  onLanguageChange,
}: NavbarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // Role checks: Riders never see Admin/Driver staff links
  const isRider = currentUser?.role === "RIDER";
  const isAdmin = currentUser?.role === "ADMIN" || (pathname?.startsWith("/admin") && !isRider);
  const isDriver = currentUser?.role === "DRIVER" || (pathname?.startsWith("/driver") && !isRider);

  const showDriverLink = !isRider && (isDriver || (isAdmin && pathname?.startsWith("/driver")));
  const showAdminLink = !isRider && isAdmin;

  const toggleTheme = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("amoled");
    else setTheme("dark");
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md text-[var(--text)] border-b border-[var(--surface-border)] shadow-sm transition-colors">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-[var(--primary-text)] shadow-sm group-hover:scale-105 transition-transform">
            <Plane className="w-4 h-4 transform -rotate-45" />
          </div>
          <div>
            <div className="font-display font-extrabold text-base tracking-tight flex items-center gap-1.5 leading-none">
              <span>FlightPool</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--accent)]/30 px-1.5 py-0.5 rounded-full">
                BOM
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
              Night Runway • T1 / T2
            </p>
          </div>
        </Link>

        {/* Action Controls: Calm Safety Shield, Language, Theme, Portals */}
        <div className="flex items-center gap-2">
          {/* C3: Calm Safety Shield (replaces aggressive red pill while keeping global-sos-btn ID) */}
          {onSOSClick && (
            <button
              onClick={onSOSClick}
              id="global-sos-btn"
              data-testid="global-sos-btn"
              className="bg-[var(--surface-2)] hover:bg-[var(--surface-border)] border border-[var(--accent)]/40 text-[var(--text)] px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95"
              title="Calm Safety Shield: Emergency SOS & Family Share"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[11px] hidden xs:inline">Safety</span>
            </button>
          )}

          {/* Language Toggle (English, Hindi, Marathi) */}
          {onLanguageChange && (
            <div className="flex items-center rounded-xl bg-[var(--surface-2)] border border-[var(--surface-border)] p-0.5 text-[10px] font-bold">
              <button
                onClick={() => onLanguageChange("en")}
                className={`px-1.5 py-0.5 rounded-lg transition-colors ${
                  currentLanguage === "en"
                    ? "bg-[var(--primary)] text-[var(--primary-text)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="English"
              >
                EN
              </button>
              <button
                onClick={() => onLanguageChange("hi")}
                className={`px-1.5 py-0.5 rounded-lg transition-colors ${
                  currentLanguage === "hi"
                    ? "bg-[var(--primary)] text-[var(--primary-text)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="हिंदी"
              >
                HI
              </button>
              <button
                onClick={() => onLanguageChange("mr")}
                className={`px-1.5 py-0.5 rounded-lg transition-colors ${
                  currentLanguage === "mr"
                    ? "bg-[var(--primary)] text-[var(--primary-text)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="मराठी"
              >
                MR
              </button>
            </div>
          )}

          {/* Theme Switcher Toggle (Dark, Light, AMOLED) */}
          <button
            onClick={toggleTheme}
            id="theme-toggle-btn"
            data-testid="theme-toggle-btn"
            className="p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            title={`Current theme: ${theme || "dark"}. Click to switch.`}
          >
            {theme === "light" ? (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            ) : theme === "amoled" ? (
              <Monitor className="w-3.5 h-3.5 text-[var(--accent)]" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[var(--primary)]" />
            )}
          </button>

          {showDriverLink && (
            <Link
              href="/driver"
              id="nav-driver-link"
              data-testid="nav-driver-link"
              className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1 text-xs font-medium border border-transparent"
              title="Driver Portal"
            >
              <Car className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Driver</span>
            </Link>
          )}

          {showAdminLink && (
            <Link
              href="/admin"
              id="nav-admin-link"
              data-testid="nav-admin-link"
              className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1 text-xs font-medium border border-transparent"
              title="Ops Dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
