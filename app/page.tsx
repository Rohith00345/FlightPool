"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import SOSModal from "@/components/SOSModal";
import PaymentModal from "@/components/PaymentModal";
import ShareTripModal from "@/components/ShareTripModal";
import RatingModal from "@/components/RatingModal";
import { MUMBAI_ZONES } from "@/lib/geo";
import { isClientDemoMode } from "@/lib/demo";
import {
  Plane,
  CheckCircle2,
  Clock,
  Luggage,
  ArrowRight,
  RefreshCw,
  Car,
  Search,
  Check,
  Share2,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Lock,
} from "lucide-react";

// Dynamically import MapPicker without SSR for Leaflet
const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs border border-slate-200 animate-pulse">
      Loading Mumbai Corridor Map...
    </div>
  ),
});

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  gender: string;
  genderVerified?: boolean;
  role: string;
}

interface FlightItem {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  terminal: string;
  status: string;
  activeRequestsCount: number;
}

interface PoolMember {
  userId: string;
  name: string;
  maskedAddress?: string;
  luggageCount?: number;
  gender?: string;
  destinationZone?: string;
}

interface PoolStop {
  memberId: string;
  dropoffOrder: number;
  riderName?: string;
  destinationAddress?: string;
  destinationZone?: string;
}

interface PoolVehicle {
  model?: string;
  licensePlate?: string;
}

interface PoolDriver {
  name?: string;
}

interface PoolTrip {
  id?: string;
  status?: string;
  otpCode?: string;
}

interface PoolDetails {
  id: string;
  status?: string;
  isWaitCapExpired?: boolean;
  destinationCluster?: string;
  members: PoolMember[];
  stops?: PoolStop[];
  vehicle?: PoolVehicle;
  driver?: PoolDriver;
  trip?: PoolTrip;
}

interface ActiveRideRequest {
  id: string;
  status: string;
  destinationZone?: string;
  isWaitCapExpired?: boolean;
}

export default function Home() {
  const demoMode = isClientDemoMode();

  // Step in Wizard: "AUTH" | "FLIGHT" | "VERIFY" | "DESTINATION" | "RIDE_STATE"
  const [step, setStep] = useState<"AUTH" | "FLIGHT" | "VERIFY" | "DESTINATION" | "RIDE_STATE">("AUTH");

  // User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [phoneInput, setPhoneInput] = useState(demoMode ? "+919810100001" : "");
  const [nameInput, setNameInput] = useState(demoMode ? "Aarav Sharma" : "");
  const [genderInput, setGenderInput] = useState("MALE");
  const [otpInput, setOtpInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Flight Selection
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightItem | null>(null);
  const [flightSearch, setFlightSearch] = useState("");
  const [terminalFilter, setTerminalFilter] = useState<"ALL" | "T2" | "T1">("ALL");

  // Boarding Pass Verification
  const [boardingPassCode, setBoardingPassCode] = useState("BP-6E204-12A");
  const [pnrCode, setPnrCode] = useState("PNR894");
  const [seatCode, setSeatCode] = useState("12A");
  const [isVerified, setIsVerified] = useState(false);
  void isVerified;

  // Destination & Ride Preferences
  const [selectedZone, setSelectedZone] = useState("Thane");
  const [selectedAddress, setSelectedAddress] = useState("Hiranandani Estate, Ghodbunder Rd");
  const [luggageCount, setLuggageCount] = useState(1);
  const [womenOnly, setWomenOnly] = useState(false);

  // Transparent Fare Calculation derived from selectedZone & selectedFlight
  const estimates = useMemo(() => {
    if (!selectedFlight) return null;
    const zoneInfo = MUMBAI_ZONES[selectedZone] || MUMBAI_ZONES["Thane"];
    const solo = Math.round(120 + 18 * zoneInfo.approxDistanceKmFromT2 * 1.25);
    const pool = Math.round(solo * 0.49); // guaranteed ~51% savings
    return {
      soloFare: solo,
      estimatedPoolFare: pool,
      estimatedSavings: solo - pool,
      savingsPct: Math.round(((solo - pool) / solo) * 100),
    };
  }, [selectedZone, selectedFlight]);

  const handleSelectZone = (zoneId: string) => {
    setSelectedZone(zoneId);
    const zoneInfo = MUMBAI_ZONES[zoneId] || MUMBAI_ZONES["Thane"];
    setSelectedAddress(zoneInfo.popularDropoffs[0]);
  };

  // Live Ride & Pool State
  const [rideStatus, setRideStatus] = useState<string>("SEARCHING"); // "SEARCHING" | "POOL_FORMING" | "WAIT_CAP_EXPIRED" | "POOL_CONFIRMED" | "DRIVER_ASSIGNED" | "ON_TRIP" | "COMPLETED"
  const [poolData, setPoolData] = useState<PoolDetails | null>(null);
  const [activeRequest, setActiveRequest] = useState<ActiveRideRequest | null>(null);
  const [coRidersCount, setCoRidersCount] = useState<number>(0);
  void coRidersCount;
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  // Modals
  const [showSOS, setShowSOS] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showRating, setShowRating] = useState(false);

  // Load Flights on Mount
  useEffect(() => {
    fetch("/api/flights")
      .then((res) => res.json())
      .then((data) => {
        if (data.flights) {
          setFlights(data.flights);
          if (data.flights.length > 0) {
            setSelectedFlight(data.flights[0]);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Poll Ride Status every 5 seconds when in RIDE_STATE
  const refreshRideStatus = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/rides/status?userId=${currentUser.id}`);
      const data = await res.json();

      if (data.activeRequest) {
        setActiveRequest(data.activeRequest);

        if (data.pool) {
          setPoolData(data.pool);
          const p = data.pool;

          if (p.trip) {
            if (p.trip.status === "COMPLETED") {
              setRideStatus("COMPLETED");
            } else if (p.trip.status === "IN_TRANSIT") {
              setRideStatus("ON_TRIP");
            } else {
              setRideStatus("DRIVER_ASSIGNED");
            }
          } else if (p.status === "CONFIRMED") {
            setRideStatus("POOL_CONFIRMED");
          } else if (p.isWaitCapExpired) {
            setRideStatus("WAIT_CAP_EXPIRED");
          } else {
            setRideStatus("POOL_FORMING");
          }
        } else {
          setPoolData(null);
          setCoRidersCount(data.coRidersFound || 0);
          if (data.activeRequest.isWaitCapExpired) {
            setRideStatus("WAIT_CAP_EXPIRED");
          } else {
            setRideStatus("SEARCHING");
          }
        }
      }
    } catch (e) {
      console.error("Status poll error:", e);
    }
  }, [currentUser]);

  useEffect(() => {
    if (step === "RIDE_STATE") {
      let ignore = false;
      const poll = () => {
        if (!currentUser) return;
        fetch(`/api/rides/status?userId=${currentUser.id}`)
          .then((res) => res.json())
          .then((data) => {
            if (ignore) return;
            if (data.activeRequest) {
              setActiveRequest(data.activeRequest);
              if (data.pool) {
                setPoolData(data.pool);
                const p = data.pool;
                if (p.trip) {
                  if (p.trip.status === "COMPLETED") {
                    setRideStatus("COMPLETED");
                  } else if (p.trip.status === "IN_TRANSIT") {
                    setRideStatus("ON_TRIP");
                  } else {
                    setRideStatus("DRIVER_ASSIGNED");
                  }
                } else if (p.status === "CONFIRMED") {
                  setRideStatus("POOL_CONFIRMED");
                } else if (p.isWaitCapExpired) {
                  setRideStatus("WAIT_CAP_EXPIRED");
                } else {
                  setRideStatus("POOL_FORMING");
                }
              } else {
                setPoolData(null);
                setCoRidersCount(data.coRidersFound || 0);
                if (data.activeRequest.isWaitCapExpired) {
                  setRideStatus("WAIT_CAP_EXPIRED");
                } else {
                  setRideStatus("SEARCHING");
                }
              }
            }
          })
          .catch((e) => console.error("Status poll error:", e));
      };
      poll();
      const interval = setInterval(poll, 5000);
      return () => {
        ignore = true;
        clearInterval(interval);
      };
    }
  }, [step, currentUser]);

  // Quick Demo Logins
  const handleQuickLogin = (name: string, phone: string, gender: string) => {
    setNameInput(name);
    setPhoneInput(phone);
    setGenderInput(gender);
    setWomenOnly(gender === "FEMALE");
    if (demoMode) {
      setOtpInput("123456");
    }
  };

  // Step 1: Submit Auth
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoadingAction(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: phoneInput,
          otp: otpInput,
          name: nameInput,
          gender: genderInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Login failed");
      } else {
        setCurrentUser(data.user);
        setStep("FLIGHT");
      }
    } catch {
      setAuthError("Network connection error. Please try again.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Step 2: Select Flight
  const handleSelectFlight = (f: FlightItem) => {
    setSelectedFlight(f);
    const suffix = ((f.flightNumber.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 89) + 10);
    setBoardingPassCode(`BP-${f.flightNumber.replace("-", "")}-${suffix}A`);
  };

  // Filtered flights
  const filteredFlights = useMemo(() => {
    return flights.filter((f) => {
      const matchesTerminal =
        terminalFilter === "ALL" || f.terminal === terminalFilter;
      const matchesSearch =
        !flightSearch ||
        f.flightNumber.toLowerCase().includes(flightSearch.toLowerCase()) ||
        f.airline.toLowerCase().includes(flightSearch.toLowerCase()) ||
        f.origin.toLowerCase().includes(flightSearch.toLowerCase());
      return matchesTerminal && matchesSearch;
    });
  }, [flights, terminalFilter, flightSearch]);

  // Step 3: Boarding Pass Verification
  const handleVerifyBoardingPass = async () => {
    if (!currentUser || !selectedFlight) return;
    setLoadingAction(true);
    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          flightId: selectedFlight.id,
          boardingPassCode,
          pnr: pnrCode,
          seatNumber: seatCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsVerified(true);
        setTimeout(() => setStep("DESTINATION"), 500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  // Step 5: "I've landed / I'm ready" button
  const handleImReady = async () => {
    if (!currentUser || !selectedFlight) return;
    setLoadingAction(true);
    try {
      const zoneInfo = MUMBAI_ZONES[selectedZone] || MUMBAI_ZONES["Thane"];
      const res = await fetch("/api/rides/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          flightId: selectedFlight.id,
          destinationZone: selectedZone,
          destinationAddress: selectedAddress,
          destinationLat: zoneInfo.center.lat,
          destinationLng: zoneInfo.center.lng,
          luggageCount,
          womenOnly,
          isReady: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveRequest(data.rideRequest);
        // Trigger matching run
        await fetch("/api/pools/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flightId: selectedFlight.id }),
        });
        setStep("RIDE_STATE");
        await refreshRideStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  // Rider confirms pool with mock payment
  const handleConfirmPoolWithPayment = async (method: "UPI" | "CARD" | "NETBANKING") => {
    if (!currentUser || !poolData) return;
    const res = await fetch("/api/pools/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poolId: poolData.id,
        userId: currentUser.id,
        paymentMethod: method,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await refreshRideStatus();
    }
  };

  // Rider leaves pool without penalty
  const handleLeavePool = async () => {
    if (!currentUser || !poolData) return;
    if (confirm("Leave this pool? You can re-pool or choose a solo cab without any penalty.")) {
      setLoadingAction(true);
      try {
        await fetch("/api/pools/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolId: poolData.id,
            userId: currentUser.id,
          }),
        });
        await refreshRideStatus();
      } finally {
        setLoadingAction(false);
      }
    }
  };

  // Solo fallback or Keep Waiting
  const handleSoloAction = async (action: "GO_SOLO" | "KEEP_WAITING") => {
    if (!currentUser || !activeRequest) return;
    setLoadingAction(true);
    try {
      await fetch("/api/pools/solo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          rideRequestId: activeRequest.id,
          action,
        }),
      });
      await refreshRideStatus();
    } finally {
      setLoadingAction(false);
    }
  };

  // Helper for airline badge color
  const getAirlineColor = (airline: string) => {
    if (airline.includes("IndiGo")) return "bg-blue-600 text-white";
    if (airline.includes("Vistara")) return "bg-purple-900 text-purple-100";
    if (airline.includes("Air India")) return "bg-red-700 text-white";
    if (airline.includes("Akasa")) return "bg-orange-600 text-white";
    return "bg-slate-800 text-white";
  };

  // Progress Stepper Step Index
  const stepIndex =
    step === "AUTH"
      ? 1
      : step === "FLIGHT"
      ? 2
      : step === "VERIFY"
      ? 3
      : step === "DESTINATION"
      ? 4
      : 5;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onSOSClick={() => setShowSOS(true)}
      />

      {/* Main Mobile Screen Wrapper */}
      <main className="w-full max-w-md mx-auto flex-1 p-4 pb-20 flex flex-col">
        {/* Sleek Step Progress Indicator */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
            <span>
              {step === "AUTH" && "Step 1 of 5 • Passenger Profile"}
              {step === "FLIGHT" && "Step 2 of 5 • Flight Details"}
              {step === "VERIFY" && "Step 3 of 5 • Boarding Pass"}
              {step === "DESTINATION" && "Step 4 of 5 • Route & Fare"}
              {step === "RIDE_STATE" && "Step 5 of 5 • Active Pool"}
            </span>
            <span className="text-teal-700">{Math.round((stepIndex / 5) * 100)}% Complete</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${(stepIndex / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* STEP 1: AUTH / ONBOARDING                                 */}
        {/* ========================================================= */}
        {step === "AUTH" && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 my-auto animate-in fade-in">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-tr from-teal-600 to-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white shadow-md shadow-teal-500/20">
                <Plane className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Welcome to FlightPool
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Mumbai Airport Shared Cabs • Verified Passengers Only
              </p>
            </div>

            {/* Quick Demo Personas */}
            {demoMode && (
              <div className="mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  ⚡ Select Test Persona:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("Aarav Sharma", "+919810100001", "MALE")}
                    className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                      nameInput === "Aarav Sharma"
                        ? "border-teal-600 bg-teal-50/80 text-teal-900 font-semibold shadow-xs ring-1 ring-teal-500/30"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <p className="font-bold">Aarav Sharma</p>
                    <p className="text-[10px] text-slate-500">Business • Thane • 6E-204</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin("Priya Nair", "+919810100002", "FEMALE")}
                    className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                      nameInput === "Priya Nair"
                        ? "border-rose-600 bg-rose-50/80 text-rose-900 font-semibold shadow-xs ring-1 ring-rose-500/30"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <p className="font-bold flex items-center gap-1">Priya Nair 🌸</p>
                    <p className="text-[10px] text-slate-500">Women-Only • Powai</p>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Passenger Full Name
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full text-sm p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  placeholder="e.g. Aarav Sharma"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full text-sm p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-mono"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Gender (Used for Women-Only Pool Preference)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGenderInput("MALE");
                      setWomenOnly(false);
                    }}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      genderInput === "MALE"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenderInput("FEMALE");
                      setWomenOnly(true);
                    }}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      genderInput === "FEMALE"
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Female 🌸
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenderInput("PREFER_NOT_TO_SAY");
                      setWomenOnly(false);
                    }}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      genderInput === "PREFER_NOT_TO_SAY"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Prefer not to say
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    6-Digit Verification OTP
                  </label>
                  {demoMode && (
                    <span className="text-[10px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                      Dev OTP: 123456
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="w-full text-sm p-3.5 rounded-xl border border-slate-200 text-center tracking-widest font-mono font-bold focus:outline-none focus:border-teal-600"
                  placeholder={demoMode ? "123456" : "Enter 6-digit OTP"}
                />
              </div>

              {authError && (
                <p className="text-xs text-red-600 font-semibold text-center">{authError}</p>
              )}

              <button
                type="submit"
                id="login-btn"
                disabled={loadingAction}
                className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>{loadingAction ? "Authenticating..." : "CONTINUE TO FLIGHT"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: SELECT ARRIVING FLIGHT                            */}
        {/* ========================================================= */}
        {step === "FLIGHT" && (
          <div className="space-y-3 flex-1 flex flex-col animate-in fade-in">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-base font-bold text-slate-900">Select Your Flight</h1>
                  <p className="text-xs text-slate-500">Live Mumbai Airport (BOM) Arrivals Schedule</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200/60 px-2.5 py-1 rounded-full">
                  {filteredFlights.length} Flights
                </span>
              </div>

              {/* Terminal Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => setTerminalFilter("ALL")}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    terminalFilter === "ALL"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All BOM
                </button>
                <button
                  type="button"
                  onClick={() => setTerminalFilter("T2")}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    terminalFilter === "T2"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Terminal 2
                </button>
                <button
                  type="button"
                  onClick={() => setTerminalFilter("T1")}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    terminalFilter === "T1"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Terminal 1
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={flightSearch}
                  onChange={(e) => setFlightSearch(e.target.value)}
                  placeholder="Search flight number (6E-204) or origin city (Delhi)..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Flight Cards List */}
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[420px] pr-0.5">
              {filteredFlights.map((f) => {
                const isSelected = selectedFlight?.id === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFlight(f)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-teal-600 bg-white ring-2 ring-teal-500/20 shadow-md"
                        : "border-slate-200 bg-white hover:border-slate-300 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${getAirlineColor(f.airline)}`}>
                          {f.airline}
                        </span>
                        <span className="font-bold text-sm text-slate-900 font-mono">
                          {f.flightNumber}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        Terminal {f.terminal}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-slate-500 text-[11px]">Origin</p>
                        <p className="font-bold text-slate-800">{f.origin}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {f.status.replace("_", " ")}
                        </span>
                        {f.activeRequestsCount > 0 && (
                          <p className="text-[10px] text-teal-700 font-semibold mt-1">
                            {f.activeRequestsCount} passengers waiting
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedFlight && (
              <button
                onClick={() => setStep("VERIFY")}
                className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>CONFIRM FLIGHT {selectedFlight.flightNumber}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: BOARDING PASS VERIFICATION                        */}
        {/* ========================================================= */}
        {step === "VERIFY" && selectedFlight && (
          <div className="space-y-4 my-auto animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-base font-bold text-slate-900">Verify Boarding Pass</h1>
                  <p className="text-xs text-slate-500">Ensures only authentic flight passengers share cabs</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              {/* Apple Wallet Style Digital Boarding Pass */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden mb-5">
                <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                      Digital Boarding Pass
                    </span>
                    <p className="font-bold text-sm">{selectedFlight.airline}</p>
                  </div>
                  <span className="font-mono font-bold text-sm bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {selectedFlight.flightNumber}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center my-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Origin</span>
                    <span className="font-extrabold text-base">{selectedFlight.origin.slice(0, 3)}</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <Plane className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Destination</span>
                    <span className="font-extrabold text-base">BOM</span>
                  </div>
                </div>

                {/* Perforated Divider */}
                <div className="border-t border-dashed border-slate-700 my-3 relative">
                  <div className="absolute -left-7 -top-2 w-4 h-4 rounded-full bg-white" />
                  <div className="absolute -right-7 -top-2 w-4 h-4 rounded-full bg-white" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Passenger</span>
                    <span className="font-semibold text-slate-200 truncate block">
                      {currentUser?.name || "Aarav S."}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">PNR</span>
                    <span className="font-mono font-bold text-teal-300">{pnrCode}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Seat</span>
                    <span className="font-mono font-bold">{seatCode}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <QrCode className="w-3.5 h-3.5 text-slate-300" /> {boardingPassCode}
                  </span>
                  <span className="text-emerald-400 font-semibold">✓ Verified Airline Schedule</span>
                </div>
              </div>

              {/* Form Manual Overrides if user wants */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    PNR Number
                  </label>
                  <input
                    type="text"
                    value={pnrCode}
                    onChange={(e) => setPnrCode(e.target.value.toUpperCase())}
                    className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Seat Number
                  </label>
                  <input
                    type="text"
                    value={seatCode}
                    onChange={(e) => setSeatCode(e.target.value.toUpperCase())}
                    className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <button
                onClick={handleVerifyBoardingPass}
                disabled={loadingAction}
                className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{loadingAction ? "Verifying with BOM Airport..." : "VERIFY & CONTINUE"}</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: DESTINATION & CORRIDOR SELECTION                  */}
        {/* ========================================================= */}
        {step === "DESTINATION" && selectedFlight && (
          <div className="space-y-3 flex-1 flex flex-col animate-in fade-in">
            {/* Interactive Corridor Map */}
            <MapPicker
              terminal={selectedFlight.terminal as "T1" | "T2"}
              selectedZone={selectedZone}
              onSelectZone={(z) => handleSelectZone(z)}
              height="200px"
            />

            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
              <div>
                <h1 className="text-base font-bold text-slate-900">Select Drop-off Corridor</h1>
                <p className="text-xs text-slate-500">
                  Pickup Terminal: Mumbai Airport Terminal {selectedFlight.terminal}
                </p>
              </div>

              {/* Destination Zone Grid */}
              <div className="grid grid-cols-3 gap-2">
                {Object.values(MUMBAI_ZONES).map((z) => {
                  const isSelected = z.id === selectedZone;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => handleSelectZone(z.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? "border-teal-600 bg-teal-50 text-teal-900 font-bold shadow-xs ring-1 ring-teal-500/30"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <p className="text-xs font-bold truncate">{z.name}</p>
                      <p className="text-[10px] text-slate-500">{z.approxDistanceKmFromT2} km</p>
                    </button>
                  );
                })}
              </div>

              {/* Specific Drop-off Landmark */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Specific Landmark / Street
                </label>
                <select
                  value={selectedAddress}
                  onChange={(e) => setSelectedAddress(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-teal-600"
                >
                  {(MUMBAI_ZONES[selectedZone] || MUMBAI_ZONES["Thane"]).popularDropoffs.map((drop) => (
                    <option key={drop} value={drop}>
                      {drop}
                    </option>
                  ))}
                </select>
              </div>

              {/* Luggage Counter */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Luggage className="w-4 h-4 text-slate-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Luggage Bags</span>
                    <p className="text-[10px] text-slate-400">Max 4 total in shared vehicle</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setLuggageCount(num)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                        luggageCount === num
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-slate-200"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Women-Only Pool Toggle */}
              {currentUser?.gender === "FEMALE" && (
                <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🌸</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-rose-950">Women-Only Pool</span>
                        <span className="text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          ✓ Verified Female
                        </span>
                      </div>
                      <p className="text-[10px] text-rose-700">Strictly match with verified female co-passengers</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={womenOnly}
                    onChange={(e) => setWomenOnly(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                  />
                </div>
              )}

              {/* Upfront Guaranteed Fare Card */}
              {estimates && (
                <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-2xl p-4 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400">
                      Guaranteed Upfront Fare
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Save ₹{estimates.estimatedSavings} ({estimates.savingsPct}%)
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-extrabold text-white">₹{estimates.estimatedPoolFare}</span>
                      <span className="text-xs text-slate-400 line-through ml-2">₹{estimates.soloFare} solo</span>
                    </div>
                    <span className="text-[11px] text-teal-300 font-semibold">
                      🌱 -4.8 kg CO₂ reduced
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleImReady}
                disabled={loadingAction}
                className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{loadingAction ? "Sending Pickup Signal..." : "I'VE LANDED & READY"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 5: ACTIVE POOL & RIDE LIFECYCLE                      */}
        {/* ========================================================= */}
        {step === "RIDE_STATE" && (
          <div className="space-y-4 flex-1 flex flex-col animate-in fade-in">
            {/* SEARCHING RADAR STATE */}
            {rideStatus === "SEARCHING" && (
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80 text-center my-auto space-y-5">
                <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-teal-500/20 animate-ping-slow" />
                  <div className="absolute inset-2 rounded-full bg-teal-500/30 animate-pulse" />
                  <div className="w-16 h-16 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/30 z-10">
                    <Plane className="w-8 h-8" />
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">Finding Co-Riders...</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    Scanning passengers from flight <b>{selectedFlight?.flightNumber}</b> heading towards <b>{activeRequest?.destinationZone}</b>.
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-4 h-4 text-teal-600" /> Max Wait Window:
                  </span>
                  <span className="font-mono font-bold text-slate-900">20 Mins (Auto-Dispatch)</span>
                </div>

                <button
                  onClick={() => refreshRideStatus()}
                  className="text-xs text-teal-700 hover:text-teal-800 font-bold flex items-center justify-center gap-1.5 mx-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
                </button>
              </div>
            )}

            {/* POOL FORMING STATE */}
            {rideStatus === "POOL_FORMING" && poolData && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Pool Forming ({poolData.members.length}/4)
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-1">
                      {poolData.destinationCluster} Corridor
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Your Share</span>
                    <span className="text-xl font-black text-teal-700">₹{estimates?.estimatedPoolFare}</span>
                  </div>
                </div>

                {/* Co-riders list */}
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Verified Co-Riders in Vehicle:
                  </p>
                  <div className="space-y-2">
                    {poolData.members.map((m: PoolMember) => (
                      <div
                        key={m.userId}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                            {m.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">
                              {m.name} {m.userId === currentUser?.id ? "(You)" : ""}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Drop: {m.maskedAddress || "Corridor Zone"} • {m.luggageCount} bag(s)
                            </p>
                          </div>
                        </div>
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                          ✓ Verified
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirm & Authorize Fare Button */}
                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>CONFIRM & LOCK SHARE (₹{estimates?.estimatedPoolFare || 360})</span>
                </button>

                {/* Zero penalty leave option */}
                <button
                  onClick={handleLeavePool}
                  className="w-full text-center text-xs font-semibold text-rose-600 hover:text-rose-800 py-1 transition-colors"
                >
                  Leave pool without penalty
                </button>
              </div>
            )}

            {/* WAIT CAP EXPIRED: SOLO FALLBACK */}
            {rideStatus === "WAIT_CAP_EXPIRED" && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 text-center space-y-4 my-auto">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Wait Cap Reached (20 Mins)</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Not enough co-riders landed for a full pool. You can switch to a solo airport cab immediately or continue waiting.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleSoloAction("GO_SOLO")}
                    className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-2xl text-sm shadow-md"
                  >
                    GO SOLO CAB (₹{estimates?.soloFare || 740})
                  </button>
                  <button
                    onClick={() => handleSoloAction("KEEP_WAITING")}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs"
                  >
                    Keep Waiting (+10 Mins)
                  </button>
                </div>
              </div>
            )}

            {/* DRIVER ASSIGNED & IN TRANSIT */}
            {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "ON_TRIP") && poolData && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {rideStatus === "ON_TRIP" ? "Trip In Transit" : "Cab Dispatched"}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-1">
                      {poolData.driver?.name || "Ramesh Shinde"}
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Pickup OTP</span>
                    <span className="text-xl font-mono font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                      {poolData.trip?.otpCode || "1429"}
                    </span>
                  </div>
                </div>

                {/* Driver & Vehicle Details */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{poolData.vehicle?.model || "Maruti Suzuki Swift Dzire"}</p>
                    <p className="font-mono font-bold text-teal-800">{poolData.vehicle?.licensePlate || "MH-02-EE-4123"}</p>
                    <p className="text-slate-400 text-[10px]">⭐ 4.9 Driver Rating • 1,420 Airport Trips</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                    <Car className="w-5 h-5" />
                  </div>
                </div>

                {/* Multi-Stop Sequence */}
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Route Sequence:
                  </p>
                  <div className="space-y-2">
                    <div className="p-2.5 bg-slate-100 rounded-xl text-xs flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[10px]">
                        P
                      </span>
                      <span className="font-semibold text-slate-800">
                        Mumbai Airport Terminal {selectedFlight?.terminal} (Cab Lane P4)
                      </span>
                    </div>
                    {poolData.stops?.map((stop: PoolStop) => (
                      <div
                        key={stop.memberId}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center text-[10px]">
                            {stop.dropoffOrder}
                          </span>
                          <span className="font-medium text-slate-800 truncate max-w-[200px]">
                            {stop.riderName}: {stop.destinationAddress}
                          </span>
                        </div>
                        <span className="text-[10px] text-teal-700 font-bold">{stop.destinationZone}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Safety & Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setShowShare(true)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-teal-600" /> Share Live Trip
                  </button>
                  <button
                    onClick={() => setShowSOS(true)}
                    className="p-3 bg-red-50 hover:bg-red-100 rounded-2xl text-xs font-bold text-red-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-600" /> Emergency SOS
                  </button>
                </div>
              </div>
            )}

            {/* COMPLETED STATE */}
            {rideStatus === "COMPLETED" && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 text-center space-y-4 my-auto animate-in fade-in">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Trip Completed!</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    You safely arrived at your destination and saved ₹{estimates?.estimatedSavings || 380} on this trip.
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                  <p className="text-xs font-semibold text-emerald-900">Your Fare Paid (Captured)</p>
                  <p className="text-3xl font-black text-emerald-950 mt-1">
                    ₹{estimates?.estimatedPoolFare || 360}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-1">🌱 4.8 kg CO₂ Carbon Emission Saved</p>
                </div>

                <button
                  onClick={() => setShowRating(true)}
                  className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md"
                >
                  Rate Driver & Co-Riders
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        poolFare={estimates?.estimatedPoolFare || 360}
        soloFare={estimates?.soloFare || 740}
        savingsPct={estimates?.savingsPct || 51}
        onConfirmPayment={handleConfirmPoolWithPayment}
      />

      <SOSModal
        isOpen={showSOS}
        onClose={() => setShowSOS(false)}
        tripId={poolData?.trip?.id}
        userId={currentUser?.id}
        vehicleDetails={poolData?.vehicle ? `${poolData.vehicle.model} (${poolData.vehicle.licensePlate})` : undefined}
      />

      <ShareTripModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        tripId={poolData?.trip?.id || "demo-trip"}
        driverName={poolData?.driver?.name}
        vehicleNumber={poolData?.vehicle?.licensePlate}
      />

      <RatingModal
        isOpen={showRating}
        onClose={() => setShowRating(false)}
        tripId={poolData?.trip?.id || "demo-trip"}
        userId={currentUser?.id || "user"}
        driverName={poolData?.driver?.name}
      />
    </div>
  );
}
