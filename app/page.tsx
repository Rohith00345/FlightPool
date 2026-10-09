"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import SOSModal from "@/components/SOSModal";
import PaymentModal from "@/components/PaymentModal";
import ShareTripModal from "@/components/ShareTripModal";
import RatingModal from "@/components/RatingModal";
import { MUMBAI_ZONES } from "@/lib/geo";
import {
  Plane,
  CheckCircle2,
  Clock,
  Users,
  Luggage,
  Shield,
  Sparkles,
  Phone,
  ArrowRight,
  LogOut,
  RefreshCw,
  Info,
  Car,
  ChevronRight,
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

export default function Home() {
  // Step in Wizard: "AUTH" | "FLIGHT" | "VERIFY" | "DESTINATION" | "RIDE_STATE"
  const [step, setStep] = useState<"AUTH" | "FLIGHT" | "VERIFY" | "DESTINATION" | "RIDE_STATE">("AUTH");

  // User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [phoneInput, setPhoneInput] = useState("+919810100001");
  const [nameInput, setNameInput] = useState("Aarav Sharma");
  const [genderInput, setGenderInput] = useState("MALE");
  const [otpInput, setOtpInput] = useState("123456");
  const [authError, setAuthError] = useState("");

  // Flight Selection
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightItem | null>(null);
  const [flightSearch, setFlightSearch] = useState("");

  // Boarding Pass Verification
  const [boardingPassCode, setBoardingPassCode] = useState("BP-6E204-12A");
  const [pnrCode, setPnrCode] = useState("PNR894");
  const [seatCode, setSeatCode] = useState("12A");
  const [isVerified, setIsVerified] = useState(false);

  // Destination & Ride Preferences
  const [selectedZone, setSelectedZone] = useState("Thane");
  const [selectedAddress, setSelectedAddress] = useState("Hiranandani Estate, Ghodbunder Rd");
  const [luggageCount, setLuggageCount] = useState(1);
  const [womenOnly, setWomenOnly] = useState(false);
  const [estimates, setEstimates] = useState<{
    soloFare: number;
    estimatedPoolFare: number;
    estimatedSavings: number;
    savingsPct: number;
  } | null>(null);

  // Live Ride & Pool State
  const [rideStatus, setRideStatus] = useState<string>("SEARCHING"); // "SEARCHING" | "POOL_FORMING" | "WAIT_CAP_EXPIRED" | "POOL_CONFIRMED" | "DRIVER_ASSIGNED" | "ON_TRIP" | "COMPLETED"
  const [poolData, setPoolData] = useState<any>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [coRidersCount, setCoRidersCount] = useState<number>(0);
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
      refreshRideStatus();
      const interval = setInterval(refreshRideStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [step, refreshRideStatus]);

  // Quick Demo Logins
  const handleQuickLogin = (name: string, phone: string, gender: string) => {
    setNameInput(name);
    setPhoneInput(phone);
    setGenderInput(gender);
    setWomenOnly(gender === "FEMALE");
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
    } catch (err) {
      setAuthError("Network error. Try again.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Step 2: Select Flight
  const handleSelectFlight = (f: FlightItem) => {
    setSelectedFlight(f);
    setBoardingPassCode(`BP-${f.flightNumber.replace("-", "")}-${Math.floor(10 + Math.random() * 89)}A`);
  };

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
        setTimeout(() => setStep("DESTINATION"), 600);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  // Step 4: Calculate upfront fare estimates when zone changes
  useEffect(() => {
    if (!selectedFlight) return;
    const zoneInfo = MUMBAI_ZONES[selectedZone] || MUMBAI_ZONES["Thane"];
    setSelectedAddress(zoneInfo.popularDropoffs[0]);

    // Quick estimation for UI
    const solo = Math.round(120 + 18 * zoneInfo.approxDistanceKmFromT2 * 1.25);
    const pool = Math.round(solo * 0.65);
    setEstimates({
      soloFare: solo,
      estimatedPoolFare: pool,
      estimatedSavings: solo - pool,
      savingsPct: 35,
    });
  }, [selectedZone, selectedFlight]);

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
    if (confirm("Leave this pool? You can re-pool or choose solo cab without any penalty.")) {
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onSOSClick={() => setShowSOS(true)}
      />

      {/* Main Mobile Screen Wrapper (Fixed max 440px width for true native PWA feeling) */}
      <main className="w-full max-w-md mx-auto flex-1 p-4 pb-20 flex flex-col">
        {/* ========================================================= */}
        {/* STEP 1: AUTH / ONBOARDING                                 */}
        {/* ========================================================= */}
        {step === "AUTH" && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 my-auto">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Plane className="w-7 h-7 text-teal-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Welcome to FlightPool
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                मुंबई एयरपोर्ट शेयर्ड कैब • Mumbai Airport Shared Cabs
              </p>
            </div>

            {/* Quick Demo Personas */}
            <div className="mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                ⚡ Quick Demo Passenger / यात्री चुनें:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("Aarav Sharma", "+919810100001", "MALE")}
                  className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                    nameInput === "Aarav Sharma"
                      ? "border-teal-600 bg-teal-50 text-teal-900 font-semibold shadow-xs"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <p className="font-bold">Aarav Sharma</p>
                  <p className="text-[10px] text-slate-500">Thane • 6E-204</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("Priya Nair", "+919810100002", "FEMALE")}
                  className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                    nameInput === "Priya Nair"
                      ? "border-teal-600 bg-teal-50 text-teal-900 font-semibold shadow-xs"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <p className="font-bold">Priya Nair 🌸</p>
                  <p className="text-[10px] text-slate-500">Women-only • Thane</p>
                </button>
              </div>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Passenger Name / यात्री का नाम
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
                  Mobile Number / मोबाइल नंबर
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
                  Gender / लिंग (For women-only cab matching)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGenderInput("MALE");
                      setWomenOnly(false);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-semibold border ${
                      genderInput === "MALE"
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    Male / पुरुष
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenderInput("FEMALE");
                      setWomenOnly(true);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-semibold border ${
                      genderInput === "FEMALE"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    Female / महिला 🌸
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    OTP Code / ओटीपी
                  </label>
                  <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md">
                    Dev OTP: 123456
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="w-full text-sm p-3.5 rounded-xl border border-slate-200 text-center tracking-widest font-mono font-bold focus:outline-none focus:border-teal-600"
                  placeholder="123456"
                />
              </div>

              {authError && (
                <p className="text-xs text-red-600 font-semibold text-center">{authError}</p>
              )}

              <button
                type="submit"
                id="login-btn"
                disabled={loadingAction}
                className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{loadingAction ? "Logging In..." : "CONTINUE • आगे बढ़ें"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: FLIGHT LOOKUP                                     */}
        {/* ========================================================= */}
        {step === "FLIGHT" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Select Your Flight</h2>
                  <p className="text-xs text-slate-500">अपनी उड़ान चुनें • BOM Arrivals</p>
                </div>
                <div className="text-xs font-semibold bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg">
                  {currentUser?.name}
                </div>
              </div>

              <input
                type="text"
                placeholder="Search by flight number (e.g. 6E-204, AI-865)..."
                value={flightSearch}
                onChange={(e) => setFlightSearch(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 mb-3"
              />

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {flights
                  .filter(
                    (f) =>
                      !flightSearch ||
                      f.flightNumber.toLowerCase().includes(flightSearch.toLowerCase()) ||
                      f.origin.toLowerCase().includes(flightSearch.toLowerCase())
                  )
                  .map((flight) => {
                    const isSelected = selectedFlight?.id === flight.id;
                    const isLanded = flight.status === "LANDED";
                    return (
                      <button
                        key={flight.id}
                        type="button"
                        onClick={() => handleSelectFlight(flight)}
                        className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? "border-teal-600 bg-teal-50/70 shadow-xs"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isLanded
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            ✈️
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">
                                {flight.flightNumber}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  isLanded
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {isLanded ? "Landed" : "Scheduled"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {flight.origin} → Terminal {flight.terminal}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-semibold text-teal-700 bg-teal-100/60 px-2 py-0.5 rounded-md">
                            {flight.activeRequestsCount || 0} pooling
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {selectedFlight && (
              <button
                type="button"
                id="flight-select-confirm-btn"
                onClick={() => setStep("VERIFY")}
                className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>CONFIRM FLIGHT {selectedFlight.flightNumber} • जारी रखें</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: BOARDING PASS VERIFICATION                        */}
        {/* ========================================================= */}
        {step === "VERIFY" && selectedFlight && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 my-auto space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-sky-100">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Verify Boarding Pass
              </h2>
              <p className="text-xs text-slate-500">
                बोर्डिंग पास सत्यापन • Prevents fake requests
              </p>
            </div>

            {/* Simulated Digital Boarding Pass */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-slate-700/80 pb-3 mb-3">
                <div>
                  <p className="text-[10px] text-teal-400 font-semibold tracking-wider uppercase">
                    PASSENGER
                  </p>
                  <p className="font-bold text-sm">{currentUser?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-teal-400 font-semibold tracking-wider uppercase">
                    FLIGHT
                  </p>
                  <p className="font-bold text-sm">{selectedFlight.flightNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">TERMINAL</span>
                  <span className="font-bold text-white text-sm">{selectedFlight.terminal}</span>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">SEAT</span>
                  <span className="font-bold text-white text-sm">{seatCode}</span>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">PNR</span>
                  <span className="font-bold text-teal-400 font-mono">{pnrCode}</span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>Code: {boardingPassCode}</span>
                <span className="text-emerald-400 font-medium">✓ Auto-Fetched</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center">
              Only verified passengers on flight <b>{selectedFlight.flightNumber}</b> can enter this pooling group.
            </p>

            <button
              type="button"
              id="verify-pass-btn"
              onClick={handleVerifyBoardingPass}
              disabled={loadingAction}
              className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
            >
              {loadingAction ? (
                <span>Verifying Passenger...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>VERIFY & CONTINUE • सत्यापित करें</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: DESTINATION ZONE PICKER & READY BUTTON            */}
        {/* ========================================================= */}
        {step === "DESTINATION" && selectedFlight && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Where in Mumbai are you heading?
                </h2>
                <p className="text-xs text-slate-500">गंतव्य क्षेत्र चुनें • Pickup: Terminal {selectedFlight.terminal}</p>
              </div>

              {/* Interactive Leaflet Map */}
              <MapPicker
                terminal={selectedFlight.terminal as "T1" | "T2"}
                selectedZone={selectedZone}
                onSelectZone={(zone) => setSelectedZone(zone)}
                height="220px"
              />

              {/* Zone Selector Chips */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                  Select Mumbai Destination Cluster:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(MUMBAI_ZONES).map((z) => {
                    const isSelected = selectedZone === z.id;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => setSelectedZone(z.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? "bg-teal-600 text-white border-teal-600 font-bold shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <p className="text-xs leading-tight">{z.name}</p>
                        <p className={`text-[10px] leading-tight ${isSelected ? "text-teal-100" : "text-slate-400"}`}>
                          {z.nameHi}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Popular Dropoff Landmarks in Zone */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Specific Drop-off Point / पता
                </label>
                <select
                  value={selectedAddress}
                  onChange={(e) => setSelectedAddress(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-600 text-slate-800"
                >
                  {(MUMBAI_ZONES[selectedZone]?.popularDropoffs || []).map((addr) => (
                    <option key={addr} value={addr}>
                      {addr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Luggage and Women-Only Controls */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Luggage count */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                    <Luggage className="w-4 h-4 text-teal-600" />
                    <span>Luggage / बैग</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setLuggageCount(num)}
                        className={`w-9 h-9 rounded-xl font-bold text-xs border transition-all ${
                          luggageCount === num
                            ? "bg-teal-600 text-white border-teal-600"
                            : "bg-white text-slate-700 border-slate-200"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Women-only pool toggle */}
                <div
                  onClick={() => setWomenOnly(!womenOnly)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    womenOnly
                      ? "bg-rose-50 border-rose-300 text-rose-950"
                      : "bg-slate-50 border-slate-200/80 text-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1">
                      🌸 Women Only
                    </span>
                    <input
                      type="checkbox"
                      checked={womenOnly}
                      onChange={() => {}}
                      className="w-4 h-4 accent-rose-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                    महिला सह-यात्री पूल
                  </p>
                </div>
              </div>

              {/* Upfront Fare & Guaranteed Savings Display */}
              {estimates && (
                <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-teal-800 font-medium block">
                      Guaranteed Pool Fare (Min 30% Off)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-teal-950">
                        ₹{estimates.estimatedPoolFare}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        ₹{estimates.soloFare}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg inline-block shadow-xs">
                      Save ₹{estimates.estimatedSavings} ({estimates.savingsPct}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Big Primary Action: "I've landed / I'm ready" */}
            <button
              type="button"
              id="ready-to-pool-btn"
              onClick={handleImReady}
              disabled={loadingAction}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-4 rounded-2xl text-base shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
            >
              <span>{loadingAction ? "Signal Sending..." : "I'VE LANDED & READY • मैं तैयार हूँ"}</span>
              <Sparkles className="w-5 h-5 text-amber-300" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 5: LIVE RIDE STATE MACHINE                           */}
        {/* ========================================================= */}
        {step === "RIDE_STATE" && (
          <div className="space-y-4">
            {/* STATE 1: SEARCHING FOR FELLOW PASSENGERS */}
            {rideStatus === "SEARCHING" && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 text-center space-y-4">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-teal-200 animate-pulse-slow opacity-60" />
                  <div className="relative w-20 h-20 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                    <Users className="w-9 h-9 animate-pulse" />
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Finding Co-riders from {selectedFlight?.flightNumber}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    समान उड़ान के यात्रियों की खोज • Destination: {activeRequest?.destinationZone}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">
                    {coRidersCount > 0
                      ? `✨ ${coRidersCount} passenger(s) on your flight are also requesting cabs to ${activeRequest?.destinationZone} corridor!`
                      : `Scanning passengers at Terminal ${selectedFlight?.terminal}...`}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Wait window: Max 20 mins from ready signal.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={refreshRideStatus}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Check Status</span>
                  </button>

                  <button
                    onClick={() => handleSoloAction("GO_SOLO")}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs"
                  >
                    Go Solo Now (₹{estimates?.soloFare || 420})
                  </button>
                </div>
              </div>
            )}

            {/* STATE 2: POOL FORMING (X of 3) */}
            {rideStatus === "POOL_FORMING" && poolData && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-teal-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md">
                      Pool Forming ({poolData.membersCount} of {poolData.maxCapacity})
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-1">
                      {poolData.destinationCluster} Cluster Pool
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Terminal {poolData.terminal}</p>
                    <p className="text-xs font-semibold text-emerald-700">
                      {poolData.membersCount >= 2 ? "Ready to Confirm!" : "Waiting for 1 more"}
                    </p>
                  </div>
                </div>

                {/* Member avatars & anonymity display */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Pool Members / सह-यात्री:</p>
                  {poolData.members.map((m: any, idx: number) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        m.isSelf
                          ? "bg-teal-50 border-teal-300 font-medium"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-[11px]">
                          {m.gender === "FEMALE" ? "👩" : "👨"}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{m.name}</p>
                          <p className="text-[10px] text-slate-500">{m.destinationAddress}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">₹{m.poolFare}</span>
                        <span className="block text-[10px] text-emerald-600 font-semibold">
                          Save {m.savingsPct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Savings Banner */}
                {poolData.myShare && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-center">
                    <p className="text-xs text-emerald-900">
                      Your Share: <span className="font-bold text-base">₹{poolData.myShare.poolFare}</span>{" "}
                      (Solo fare is ₹{poolData.myShare.soloFare})
                    </p>
                    <p className="text-xs font-bold text-emerald-700 mt-0.5">
                      You save ₹{poolData.myShare.soloFare - poolData.myShare.poolFare} (
                      {poolData.myShare.savingsPct}%)!
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => setShowPayment(true)}
                    id="confirm-pool-btn"
                    className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2"
                  >
                    <span>CONFIRM & LOCK SHARE (₹{poolData.myShare?.poolFare})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleLeavePool}
                    disabled={loadingAction}
                    className="w-full text-slate-500 hover:text-red-600 text-xs font-semibold py-2 text-center"
                  >
                    Leave pool without penalty / पूल छोड़ें
                  </button>
                </div>
              </div>
            )}

            {/* STATE 3: WAIT CAP EXPIRED FALLBACK */}
            {rideStatus === "WAIT_CAP_EXPIRED" && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-300 text-center space-y-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">Wait Cap Reached</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    20 मिनट का प्रतीक्षा समय समाप्त • No enough riders matched
                  </p>
                </div>

                <p className="text-xs text-slate-600">
                  We don't want you waiting indefinitely at the terminal. You can take a dedicated solo cab right away at standard price, or extend waiting for 15 minutes.
                </p>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleSoloAction("GO_SOLO")}
                    id="go-solo-btn"
                    className="w-full bg-slate-900 hover:bg-black active:scale-95 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md"
                  >
                    GO SOLO CAB (₹{estimates?.soloFare || 420}) • अभी चलें
                  </button>

                  <button
                    onClick={() => handleSoloAction("KEEP_WAITING")}
                    id="keep-waiting-btn"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-2xl text-xs"
                  >
                    Keep Waiting (+15 Mins) • प्रतीक्षा जारी रखें
                  </button>
                </div>
              </div>
            )}

            {/* STATE 4 & 5: POOL CONFIRMED & DRIVER ASSIGNED */}
            {(rideStatus === "POOL_CONFIRMED" || rideStatus === "DRIVER_ASSIGNED") && poolData && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-emerald-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      ✓ Cab Confirmed
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-1">
                      {poolData.vehicle ? `${poolData.vehicle.make} ${poolData.vehicle.model}` : "Driver Assigned"}
                    </h2>
                  </div>
                  {poolData.trip?.otpCode && (
                    <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block">OTP</span>
                      <span className="font-mono font-black text-sm text-teal-400">{poolData.trip.otpCode}</span>
                    </div>
                  )}
                </div>

                {/* Driver Details Card */}
                {poolData.driver && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-base">
                        {poolData.driver.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">{poolData.driver.name}</p>
                        <p className="text-xs text-slate-500">⭐ {poolData.driver.rating} • {poolData.vehicle?.color} {poolData.vehicle?.model}</p>
                        <p className="text-xs font-mono font-bold text-teal-800">{poolData.vehicle?.licensePlate}</p>
                      </div>
                    </div>
                    <a
                      href={`tel:${poolData.driver.phone}`}
                      className="p-3 bg-white hover:bg-slate-100 text-teal-700 rounded-xl border border-slate-200 shadow-xs"
                      title="Call Driver"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {/* Pickup Instructions */}
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs text-amber-900">
                  <p className="font-bold">📍 Pickup Point: Mumbai Airport Terminal {poolData.terminal}</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Cab lane P4. Share OTP <b>{poolData.trip?.otpCode}</b> with the driver when boarding.
                  </p>
                </div>

                {/* Safety & Sharing Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowShare(true)}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Share Trip Link</span>
                  </button>

                  <button
                    onClick={() => setShowSOS(true)}
                    className="py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Emergency SOS</span>
                  </button>
                </div>
              </div>
            )}

            {/* STATE 6: ON TRIP (IN TRANSIT) */}
            {rideStatus === "ON_TRIP" && poolData && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-teal-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-bold text-sm text-emerald-800">Trip In Transit • यात्रा जारी है</span>
                  </div>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    {poolData.vehicle?.licensePlate}
                  </span>
                </div>

                {/* Interactive Map with Multi-Stop Route */}
                <MapPicker
                  terminal={poolData.terminal}
                  selectedZone={activeRequest?.destinationZone}
                  onSelectZone={() => {}}
                  otherStops={poolData.members.map((m: any) => ({
                    name: `${m.name} (${m.destinationZone})`,
                    coords: MUMBAI_ZONES[m.destinationZone]?.center || MUMBAI_ZONES["Thane"].center,
                    order: m.dropoffOrder,
                  }))}
                  height="200px"
                />

                {/* Dropoff sequence */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Drop-off Sequence:</p>
                  {poolData.members.map((m: any) => (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        m.isSelf ? "bg-teal-50 border-teal-300 font-bold" : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">
                          {m.dropoffOrder}
                        </span>
                        <span>{m.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">{m.destinationAddress}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowShare(true)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs text-center"
                  >
                    Share Live Status
                  </button>
                  <button
                    onClick={() => setShowSOS(true)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs text-center"
                  >
                    Emergency SOS
                  </button>
                </div>
              </div>
            )}

            {/* STATE 7: COMPLETED */}
            {rideStatus === "COMPLETED" && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-200 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">Drop-off Completed!</h2>
                  <p className="text-xs text-slate-500 mt-1">यात्रा सफलतापूर्वक समाप्त हुई</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination</span>
                    <span className="font-bold text-slate-800">{activeRequest?.destinationZone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paid via Razorpay</span>
                    <span className="font-bold text-emerald-700">₹{poolData?.myShare?.poolFare || 360}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-emerald-800 font-semibold">
                    <span>You Saved</span>
                    <span>₹{((poolData?.myShare?.soloFare || 740) - (poolData?.myShare?.poolFare || 360))} (35-51%)</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowRating(true)}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md"
                >
                  Rate Driver & Co-riders • रेटिंग दें
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <SOSModal
        isOpen={showSOS}
        onClose={() => setShowSOS(false)}
        tripId={poolData?.trip?.id}
        userId={currentUser?.id}
        vehicleDetails={poolData?.vehicle ? `${poolData.vehicle.make} ${poolData.vehicle.licensePlate}` : undefined}
      />

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        poolFare={poolData?.myShare?.poolFare || 360}
        soloFare={poolData?.myShare?.soloFare || 740}
        savingsPct={poolData?.myShare?.savingsPct || 51}
        onConfirmPayment={handleConfirmPoolWithPayment}
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
        userId={currentUser?.id || "u-1"}
        driverName={poolData?.driver?.name}
        onRatingSubmitted={() => setStep("FLIGHT")}
      />
    </div>
  );
}
