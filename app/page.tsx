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
import { Language, TRANSLATIONS } from "@/lib/i18n";
import {
  getGamificationState,
  GamificationState,
  GATE_TRIVIA_QUESTIONS,
} from "@/lib/gamification/provider";
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
  Sparkles,
  Award,
  Trophy,
  HelpCircle,
  Sliders,
  User,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Slider } from "@/components/ui/Slider";
import { Progress } from "@/components/ui/Progress";
import { Ring } from "@/components/ui/Ring";
import { Stepper } from "@/components/ui/Stepper";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "next-themes";

// Dynamically import MapPicker without SSR for Leaflet
const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)] text-xs border border-[var(--surface-border)] animate-pulse">
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
  const { theme, setTheme } = useTheme();

  // Language & i18n
  const [language, setLanguage] = useState<Language>("en");
  const t = TRANSLATIONS[language];

  // Active Bottom Nav Tab (Mobile 4-tab: "ride", "rewards", "trips", "profile")
  const [activeTab, setActiveTab] = useState<"ride" | "rewards" | "trips" | "profile">("ride");

  // Step in Ride Wizard: "AUTH" | "FLIGHT" | "VERIFY" | "DESTINATION" | "RIDE_STATE"
  const [step, setStep] = useState<"AUTH" | "FLIGHT" | "VERIFY" | "DESTINATION" | "RIDE_STATE">("AUTH");

  // User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [phoneInput, setPhoneInput] = useState(demoMode ? "+919810100001" : "");
  const [nameInput, setNameInput] = useState(demoMode ? "Aarav Sharma" : "");
  const [genderInput, setGenderInput] = useState("MALE");
  const [otpInput, setOtpInput] = useState(demoMode ? "123456" : "");
  const [authError, setAuthError] = useState("");
  const [showDemoSelector, setShowDemoSelector] = useState(false);

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

  // Wait-vs-Save Slider (0 to 100, where 0 is minimum wait and 100 is maximum savings)
  const [waitSaveRatio, setWaitSaveRatio] = useState(50);

  // Live Ride & Pool State
  const [rideStatus, setRideStatus] = useState<string>("SEARCHING");
  const [poolData, setPoolData] = useState<PoolDetails | null>(null);
  const [activeRequest, setActiveRequest] = useState<ActiveRideRequest | null>(null);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  // Modals
  const [showSOS, setShowSOS] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showRating, setShowRating] = useState(false);

  // Game Layer (Mock state for demo mode)
  const [gameState] = useState<GamificationState>(() => getGamificationState());
  const [triviaIndex] = useState(0);
  const [selectedTriviaOption, setSelectedTriviaOption] = useState<number | null>(null);
  const [triviaFeedback, setTriviaFeedback] = useState<string | null>(null);

  // Transparent Fare Calculation derived from selectedZone & selectedFlight & waitSaveRatio
  const estimates = useMemo(() => {
    const zoneInfo = MUMBAI_ZONES[selectedZone] || MUMBAI_ZONES["Thane"];
    const baseKm = zoneInfo.approxDistanceKmFromT2;
    // Solo fare in Mumbai airport taxi: approx Rs 120 base + 18/km * 1.25 toll/airport fee
    const solo = Math.round(120 + 18 * baseKm * 1.25);
    // Savings percentage scales between 40% and 55% based on wait preference
    const savingsDiscount = 0.45 + (waitSaveRatio / 100) * 0.10;
    const pool = Math.round(solo * (1 - savingsDiscount));
    const savings = solo - pool;
    const maxWaitMins = Math.round(10 + (waitSaveRatio / 100) * 15); // 10m to 25m

    return {
      soloFare: solo,
      estimatedPoolFare: pool,
      estimatedSavings: savings,
      savingsPct: Math.round((savings / solo) * 100),
      maxWaitMins,
      co2Kg: (baseKm * 0.16).toFixed(1),
    };
  }, [selectedZone, waitSaveRatio]);

  const handleSelectZone = (zoneId: string) => {
    setSelectedZone(zoneId);
    const zoneInfo = MUMBAI_ZONES[zoneId] || MUMBAI_ZONES["Thane"];
    setSelectedAddress(zoneInfo.popularDropoffs[0]);
  };

  // Haptic feedback tick
  const triggerHaptic = () => {
    if (typeof window !== "undefined" && "navigator" in window && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {
        // Ignore haptic errors on unsupported devices
      }
    }
  };

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
        if (!currentUser || ignore) return;
        refreshRideStatus();
      };
      poll();
      const interval = setInterval(poll, 4000);
      return () => {
        ignore = true;
        clearInterval(interval);
      };
    }
  }, [step, currentUser, refreshRideStatus]);

  // Quick Persona Login
  const handleQuickLogin = (name: string, phone: string, gender: string) => {
    setNameInput(name);
    setPhoneInput(phone);
    setGenderInput(gender);
    setOtpInput("123456");
    if (gender === "FEMALE") setWomenOnly(true);
    else setWomenOnly(false);
  };

  // Step 1: Submit Authentication
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoadingAction(true);

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput,
          identifier: phoneInput,
          otp: otpInput || "123456",
          gender: genderInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Authentication failed.");
        return;
      }

      setCurrentUser(data.user);
      setStep("FLIGHT");
    } catch (err: unknown) {
      setAuthError((err as Error).message || "Connection error.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Step 2: Select Flight
  const handleSelectFlight = (flight: FlightItem) => {
    setSelectedFlight(flight);
    setBoardingPassCode(`BP-${flight.flightNumber.replace("-", "")}-14B`);
  };

  // Step 3: Verify Boarding Pass
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
        setTimeout(() => setStep("DESTINATION"), 300);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  // Step 4: I've Landed / Signal Ready
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
        // Trigger matching engine
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

  // Gate Trivia Answer Check
  const handleAnswerTrivia = (optionIdx: number) => {
    setSelectedTriviaOption(optionIdx);
    const q = GATE_TRIVIA_QUESTIONS[triviaIndex];
    if (optionIdx === q.correctIndex) {
      setTriviaFeedback("🎉 Correct! +25 Miles unlocked for waiting smartly.");
    } else {
      setTriviaFeedback(`💡 Good try! ${q.fact}`);
    }
  };

  // Filtered flights for picker
  const filteredFlights = useMemo(() => {
    return flights.filter((f) => {
      if (terminalFilter !== "ALL" && f.terminal !== terminalFilter) return false;
      if (flightSearch) {
        const query = flightSearch.toLowerCase();
        return (
          f.flightNumber.toLowerCase().includes(query) ||
          f.airline.toLowerCase().includes(query) ||
          f.origin.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [flights, terminalFilter, flightSearch]);

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

  const stepperItems = [
    { label: "Profile", description: "Passenger ID" },
    { label: "Flight", description: "BOM Arrival" },
    { label: "Boarding", description: "Aviation Gate" },
    { label: "Corridor", description: "Fare & Route" },
    { label: "Pool", description: "Bay Dispatch" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col justify-between selection:bg-[var(--primary)] selection:text-black">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onSOSClick={() => setShowSOS(true)}
        currentLanguage={language}
        onLanguageChange={(l) => setLanguage(l)}
      />

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col">
        {/* Navigation Tabs for Mobile View (Ride, Rewards, Trips, Profile) */}
        {activeTab === "rewards" ? (
          /* ========================================================================= */
          /* C5: GAMIFICATION LAYER (REWARDS TAB)                                      */
          /* ========================================================================= */
          <div className="max-w-4xl mx-auto w-full space-y-6 pb-20 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)]">
                  {t.rewardsTitle}
                </h1>
                <p className="text-xs sm:text-sm text-[var(--muted)]">
                  Green miles, flight deck tiers, and airport pooling community perks.
                </p>
              </div>
              <Badge variant="glow" className="font-mono text-xs">
                {demoMode ? "Demo Mode Active" : "Production"}
              </Badge>
            </div>

            {!demoMode ? (
              /* Tasteful "Rewards coming soon" state when demo mode is off */
              <Card className="p-8 text-center border-[var(--border)] bg-[var(--surface)]">
                <Sparkles className="w-12 h-12 text-[var(--primary)] mx-auto mb-4 animate-pulse" />
                <h2 className="text-lg font-bold text-[var(--foreground)]">FlightDeck Rewards Coming Soon</h2>
                <p className="text-xs text-[var(--muted)] max-w-md mx-auto mt-2">
                  {t.rewardsComingSoon} Real miles and verifiable CO₂ reduction tracking will be available in the upcoming release.
                </p>
              </Card>
            ) : (
              /* Full Game Layer with Flight Score gauge (0-1000) and verified tiers */
              <div className="space-y-6">
                {/* Score & Tier Hero */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Flight Score Gauge (0 - 1000) */}
                  <Card className="p-5 border-[var(--border)] bg-[var(--surface)] text-center flex flex-col items-center justify-center">
                    <Ring
                      value={(gameState.flightScore / 1000) * 100}
                      size={140}
                      strokeWidth={10}
                      color="var(--primary)"
                    >
                      <div className="text-center">
                        <span className="text-2xl font-black font-mono text-[var(--foreground)]">
                          {gameState.flightScore}
                        </span>
                        <span className="text-[10px] text-[var(--muted)] block font-semibold">
                          Flight Score
                        </span>
                      </div>
                    </Ring>
                    <div className="mt-3">
                      <Badge variant="primary" className="text-xs font-bold uppercase tracking-wider">
                        Tier: {gameState.tierName}
                      </Badge>
                      <p className="text-[11px] text-[var(--muted)] mt-1">{gameState.tierPerk}</p>
                    </div>
                  </Card>

                  {/* XP & Rank */}
                  <Card className="p-5 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                        Rank & Aviation XP
                      </span>
                      <h3 className="text-xl font-bold text-[var(--foreground)] mt-1 flex items-center gap-2">
                        <Award className="w-5 h-5 text-[var(--accent)]" />
                        {gameState.rankName}
                      </h3>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {gameState.xp} / {gameState.xpNextLevel} XP to Next Rank
                      </p>
                      <div className="mt-3">
                        <Progress value={(gameState.xp / gameState.xpNextLevel) * 100} color="accent" />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                      <span className="text-[var(--muted)]">Miles Balance:</span>
                      <span className="font-mono font-bold text-[var(--rewards)] text-base">
                        {gameState.milesBalance} Miles
                      </span>
                    </div>
                  </Card>

                  {/* Why did my score change */}
                  <Card className="p-5 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                        Recent Score Audit
                      </span>
                      <div className="mt-2 space-y-2 max-h-36 overflow-y-auto pr-1">
                        {gameState.recentScoreEvents.map((evt) => (
                          <div key={evt.id} className="text-xs flex items-center justify-between">
                            <span className="text-[var(--foreground)] truncate max-w-[170px]">{evt.reason}</span>
                            <span className="font-mono font-bold text-emerald-400">+{evt.delta}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--muted)] italic mt-2">
                      Deterministic score based on promptness and verified safety.
                    </span>
                  </Card>
                </div>

                {/* Score Breakdown (5 categories) */}
                <Card className="p-5 border-[var(--border)] bg-[var(--surface)]">
                  <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                    Flight Score Composition (1000 Total)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    {gameState.scoreCategories.map((c) => (
                      <div key={c.name} className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                        <span className="text-[10px] text-[var(--muted)] font-semibold uppercase">{c.name} ({c.weight}%)</span>
                        <p className="text-base font-mono font-bold text-[var(--foreground)] mt-1">
                          {c.currentScore} / {c.maxScore}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Badges Grid */}
                <div>
                  <h3 className="text-base font-bold text-[var(--foreground)] mb-3">
                    Aviation Community Badges
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {gameState.badges.map((b) => (
                      <Card
                        key={b.id}
                        className={`p-3 text-center border-[var(--border)] ${
                          b.isUnlocked ? "bg-[var(--surface)]" : "bg-[var(--surface-2)]/50 opacity-60"
                        }`}
                      >
                        <span className="text-2xl mb-1 block">{b.icon}</span>
                        <p className="font-bold text-xs text-[var(--foreground)]">{b.title}</p>
                        <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-2">{b.description}</p>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Quests with Streak Freeze */}
                <div>
                  <h3 className="text-base font-bold text-[var(--foreground)] mb-3">
                    Active FlightDeck Quests
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {gameState.quests.map((q) => (
                      <Card key={q.id} className="p-4 border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[10px]">
                              {q.type} QUEST
                            </Badge>
                            {q.hasStreakFreeze && (
                              <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
                                ❄️ Streak Freeze Active
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-[var(--foreground)]">{q.title}</h4>
                          <p className="text-xs text-[var(--muted)] mt-1">{q.description}</p>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] text-[var(--muted)] mb-1">
                            <span>Progress</span>
                            <span>{q.progress} / {q.target}</span>
                          </div>
                          <Progress value={(q.progress / q.target) * 100} color="primary" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Green Miles Leaderboard */}
                <Card className="p-5 border-[var(--border)] bg-[var(--surface)]">
                  <h3 className="text-sm font-bold text-[var(--foreground)] mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[var(--primary)]" />
                    Opt-in Weekly Green Miles Leaderboard
                  </h3>
                  <div className="divide-y divide-[var(--border)]">
                    {gameState.leaderboard.map((lb) => (
                      <div key={lb.rank} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold w-5 text-[var(--muted)]">#{lb.rank}</span>
                          <span className={`font-semibold ${lb.isCurrentUser ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                            {lb.nickname} {lb.isCurrentUser ? "(You)" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <span className="text-[var(--accent)] font-semibold">{lb.co2SavedKg} kg CO₂ saved</span>
                          <span className="font-mono font-bold text-[var(--foreground)]">{lb.greenMiles} Miles</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        ) : activeTab === "trips" ? (
          /* Trips Tab */
          <div className="max-w-2xl mx-auto w-full space-y-4 pb-20 animate-in fade-in">
            <h1 className="text-2xl font-bold font-display text-[var(--foreground)]">Your Airport Trips</h1>
            {activeRequest || poolData ? (
              <Card className="p-5 border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="primary">Active Trip</Badge>
                  <span className="font-mono text-xs text-[var(--muted)]">{selectedFlight?.flightNumber}</span>
                </div>
                <p className="font-bold text-sm text-[var(--foreground)]">
                  Mumbai Airport (BOM) → {activeRequest?.destinationZone || selectedZone}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">{selectedAddress}</p>
                <Button
                  className="w-full mt-4"
                  size="sm"
                  onClick={() => setActiveTab("ride")}
                >
                  Return to Active Journey
                </Button>
              </Card>
            ) : (
              <EmptyState
                icon={<History className="w-10 h-10 text-[var(--muted)]" />}
                title="No Trips in Transit"
                description="Book a shared cab from Terminal 1 or 2 to see your active trip itinerary."
                action={
                  <Button size="sm" onClick={() => setActiveTab("ride")}>
                    Start Booking
                  </Button>
                }
              />
            )}
          </div>
        ) : activeTab === "profile" ? (
          /* Profile & Settings Tab */
          <div className="max-w-2xl mx-auto w-full space-y-6 pb-20 animate-in fade-in">
            <h1 className="text-2xl font-bold font-display text-[var(--foreground)]">{t.settings}</h1>
            <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
                <Avatar name={currentUser?.name || "Passenger"} size="md" />
                <div>
                  <p className="font-bold text-sm text-[var(--foreground)]">{currentUser?.name || "Guest Rider"}</p>
                  <p className="text-xs text-[var(--muted)] font-mono">{currentUser?.phone || "+91 (Unregistered)"}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mt-0.5">
                    ✓ {t.trustedRider}
                  </span>
                </div>
              </div>

              {/* Theme Settings */}
              <div>
                <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-2">
                  Display Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["dark", "light", "amoled"] as const).map((th) => (
                    <button
                      key={th}
                      onClick={() => setTheme(th)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        theme === th
                          ? "bg-[var(--primary)] text-black border-[var(--primary)] shadow-sm"
                          : "bg-[var(--surface-2)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--muted)]"
                      }`}
                    >
                      {th.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Settings */}
              <div>
                <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-2">
                  Preferred Language
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["en", "hi", "mr"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLanguage(l)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        language === l
                          ? "bg-[var(--primary)] text-black border-[var(--primary)] shadow-sm"
                          : "bg-[var(--surface-2)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--muted)]"
                      }`}
                    >
                      {l === "en" ? "English" : l === "hi" ? "हिंदी (Hindi)" : "मराठी (Marathi)"}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        ) : (
          /* ========================================================================= */
          /* RIDE TAB: DESKTOP 3-PANE / MOBILE BOTTOM SHEET JOURNEY                   */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 pb-20">
            {/* Left Rail / Wizard Control Panel (Col 1-5 on Desktop) */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              {/* C2: Flight-path Stepper Progress Indicator */}
              <div className="mb-2">
                <Stepper steps={stepperItems} currentStep={stepIndex} />
              </div>

              {/* ===================================================================== */}
              {/* STEP 1: ONBOARDING / HERO / QUICK FARE RADAR (C2)                     */}
              {/* ===================================================================== */}
              {step === "AUTH" && (
                <div className="space-y-4">
                  {/* Hero Card with Guaranteed Saving */}
                  <Card className="p-6 border-[var(--border)] bg-[var(--surface)] shadow-lg relative overflow-hidden">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 mb-3">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Mumbai Airport Shared Cabs</span>
                    </div>

                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)] font-display leading-tight">
                      {t.heroHeadline}
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                      {t.heroSubheadline}
                    </p>

                    {/* Pre-login Flight Input & Fare Preview Trigger */}
                    <div className="mt-5 space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={flightSearch || (selectedFlight ? selectedFlight.flightNumber : "6E-204")}
                          onChange={(e) => {
                            setFlightSearch(e.target.value);
                            const found = flights.find(
                              (f) => f.flightNumber.toLowerCase() === e.target.value.toLowerCase()
                            );
                            if (found) setSelectedFlight(found);
                          }}
                          placeholder={t.flightNumberInput}
                          className="w-full pl-3 pr-24 py-3 text-xs bg-[var(--surface-2)] rounded-xl border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] font-mono font-bold uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setStep("FLIGHT")}
                          className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-[var(--primary)] text-black text-xs font-bold hover:opacity-90 transition-opacity"
                        >
                          {t.seeMyFare}
                        </button>
                      </div>

                      {/* Upfront Fare Radar Preview BEFORE login */}
                      {estimates && (
                        <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                              Thane / Powai Preview
                            </span>
                            <span className="font-mono font-extrabold text-base text-[var(--primary)]">
                              ₹{estimates.estimatedPoolFare}
                            </span>
                            <span className="text-[10px] text-[var(--muted)] line-through ml-1.5">
                              ₹{estimates.soloFare} solo
                            </span>
                          </div>
                          <Badge variant="success" className="text-xs">
                            Save {estimates.savingsPct}%
                          </Badge>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Auth / Demo Personas Card (Preserves #login-btn and Aarav Sharma for Test 5) */}
                  <Card className="p-5 border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-bold text-[var(--foreground)]">Passenger Verification</h2>
                      {demoMode && (
                        <button
                          type="button"
                          onClick={() => setShowDemoSelector(!showDemoSelector)}
                          className="text-[11px] font-semibold text-[var(--primary)] hover:underline"
                        >
                          Try demo personas ⚡
                        </button>
                      )}
                    </div>

                    {/* Test Personas (Always visible or expandable in demo mode) */}
                    {demoMode && (
                      <div className="mb-4 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                        <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
                          Select Test Persona:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickLogin("Aarav Sharma", "+919810100001", "MALE")}
                            className={`p-2 rounded-lg text-left border text-xs transition-all ${
                              nameInput === "Aarav Sharma"
                                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-bold"
                                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--muted)]"
                            }`}
                          >
                            <p className="font-bold">Aarav Sharma</p>
                            <p className="text-[10px] text-[var(--muted)]">Thane • 6E-204</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickLogin("Priya Nair", "+919810100002", "FEMALE")}
                            className={`p-2 rounded-lg text-left border text-xs transition-all ${
                              nameInput === "Priya Nair"
                                ? "border-rose-500 bg-rose-500/10 text-rose-300 font-bold"
                                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--muted)]"
                            }`}
                          >
                            <p className="font-bold">Priya Nair 🌸</p>
                            <p className="text-[10px] text-[var(--muted)]">Women-Only • Powai</p>
                          </button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-[var(--muted)] mb-1 block">
                          Passenger Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="w-full text-xs p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
                          placeholder="e.g. Aarav Sharma"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-[var(--muted)] mb-1 block">
                          Mobile Number
                        </label>
                        <input
                          type="tel"
                          required
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="w-full text-xs p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--primary)]"
                          placeholder="+91 98765 43210"
                        />
                      </div>

                      {/* Ask gender only if rider toggles women-only pool, with short privacy note */}
                      <div className="pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={womenOnly}
                            onChange={(e) => {
                              setWomenOnly(e.target.checked);
                              if (e.target.checked) setGenderInput("FEMALE");
                            }}
                            className="rounded accent-[var(--accent)]"
                          />
                          <span className="text-xs font-medium text-[var(--foreground)]">{t.womenOnlyPool}</span>
                        </label>
                        {womenOnly && (
                          <p className="text-[10px] text-[var(--accent)] mt-1 ml-5 italic">
                            {t.privacyNote}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-semibold text-[var(--muted)]">
                            6-Digit Verification OTP
                          </label>
                          {demoMode && (
                            <span className="text-[10px] font-mono text-[var(--accent)]">
                              Dev OTP: 123456
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          className="w-full text-sm p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-center tracking-widest font-mono font-bold text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
                          placeholder={demoMode ? "123456" : "Enter 6-digit OTP"}
                        />
                      </div>

                      {authError && (
                        <p className="text-xs text-rose-500 font-semibold text-center">{authError}</p>
                      )}

                      <Button
                        type="submit"
                        id="login-btn"
                        disabled={loadingAction}
                        className="w-full py-3.5 text-xs font-bold gap-2 mt-2"
                        size="lg"
                      >
                        <span>{loadingAction ? "Authenticating..." : "CONTINUE TO FLIGHT"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </form>
                  </Card>
                </div>
              )}

              {/* ===================================================================== */}
              {/* STEP 2: FLIGHT PICKER (C3)                                            */}
              {/* ===================================================================== */}
              {step === "FLIGHT" && (
                <div className="space-y-3">
                  <Card className="p-4 border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h1 className="text-base font-bold text-[var(--foreground)] font-display">
                          Select Your Flight
                        </h1>
                        <p className="text-xs text-[var(--muted)]">Live Mumbai Airport Arrivals Schedule</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {filteredFlights.length} Flights
                      </Badge>
                    </div>

                    {/* Terminal Filters */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--surface-2)] rounded-xl mb-3 border border-[var(--border)]">
                      {(["ALL", "T2", "T1"] as const).map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => setTerminalFilter(term)}
                          className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            terminalFilter === term
                              ? "bg-[var(--primary)] text-black shadow-xs"
                              : "text-[var(--muted)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {term === "ALL" ? "All BOM" : `Terminal ${term}`}
                        </button>
                      ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={flightSearch}
                        onChange={(e) => setFlightSearch(e.target.value)}
                        placeholder={t.searchFlight}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-2)] rounded-xl border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </Card>

                  {/* Flight Cards Full-Page Scroll */}
                  <div className="space-y-2">
                    {filteredFlights.map((f, idx) => {
                      const isSelected = selectedFlight?.id === f.id;
                      const waitingCount = f.activeRequestsCount || (idx % 2 === 0 ? 3 : 2);
                      const corridors =
                        idx % 3 === 0
                          ? ["2 to Thane", "1 to Powai"]
                          : idx % 2 === 0
                          ? ["1 to Bandra", "1 to Andheri"]
                          : ["2 to Navi Mumbai"];

                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectFlight(f)}
                          className={`w-full p-4 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? "border-[var(--primary)] bg-[var(--surface)] ring-2 ring-[var(--primary)]/30 shadow-md"
                              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
                          }`}
                        >
                          {/* Headline: "N passengers waiting" with corridor chips */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              {waitingCount} {t.waitingPassengers}
                            </span>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              T{f.terminal === "T1" || f.terminal === "T2" ? f.terminal : "T2"}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-base text-[var(--primary)]">
                                  {f.flightNumber}
                                </span>
                                <span className="text-xs text-[var(--muted)] font-medium">
                                  {f.airline}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--foreground)] mt-0.5 font-semibold">
                                {f.origin} → BOM
                              </p>
                            </div>

                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {f.status.replace("_", " ")}
                            </span>
                          </div>

                          {/* Corridor Chips */}
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {corridors.map((c, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--accent)] font-medium"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedFlight && (
                    <div className="sticky bottom-4 z-20 pt-2">
                      <Button
                        onClick={() => setStep("VERIFY")}
                        className="w-full py-4 text-sm font-bold shadow-xl gap-2"
                        size="lg"
                      >
                        <span>CONFIRM FLIGHT {selectedFlight.flightNumber}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* ===================================================================== */}
              {/* STEP 3: DIGITAL BOARDING PASS HERO (C4)                               */}
              {/* ===================================================================== */}
              {step === "VERIFY" && selectedFlight && (
                <div className="space-y-4">
                  <Card className="p-5 border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-base font-bold text-[var(--foreground)] font-display">
                          Verify Boarding Pass
                        </h2>
                        <p className="text-xs text-[var(--muted)]">Digital verification for safety</p>
                      </div>
                      <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
                    </div>

                    {/* Boarding-Pass Hero Card */}
                    <div className="bg-gradient-to-br from-[#0B1020] to-[#141C30] border border-[var(--border)] rounded-2xl p-5 shadow-2xl relative overflow-hidden my-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                            Boarding Pass
                          </span>
                          <p className="font-bold text-sm text-white">{selectedFlight.airline}</p>
                        </div>
                        <span className="font-mono font-bold text-sm bg-black/40 text-[var(--primary)] px-2 py-0.5 rounded border border-white/10">
                          {selectedFlight.flightNumber}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center my-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Origin</span>
                          <span className="font-extrabold text-base text-white">{selectedFlight.origin.slice(0, 3)}</span>
                        </div>
                        <div className="flex items-center justify-center">
                          <Plane className="w-5 h-5 text-[var(--primary)]" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Arrival</span>
                          <span className="font-extrabold text-base text-white">BOM</span>
                        </div>
                      </div>

                      {/* Perforated tear line */}
                      <div className="border-t border-dashed border-white/20 my-3" />

                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Passenger</span>
                          <span className="font-semibold truncate block text-white">
                            {currentUser?.name || "Aarav S."}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">PNR</span>
                          <span className="font-mono font-bold text-[var(--accent)]">{pnrCode}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Seat</span>
                          <span className="font-mono font-bold text-white">{seatCode}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <QrCode className="w-3.5 h-3.5 text-slate-300" /> {boardingPassCode}
                        </span>
                        <span className="text-emerald-400 font-semibold">✓ Verified Aviation Gate</span>
                      </div>
                    </div>

                    {/* PNR / Seat Input Fields */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-xs font-semibold text-[var(--muted)] block mb-1">
                          PNR Number
                        </label>
                        <input
                          type="text"
                          value={pnrCode}
                          onChange={(e) => setPnrCode(e.target.value.toUpperCase())}
                          className="w-full text-xs font-mono font-bold p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[var(--muted)] block mb-1">
                          Seat Number
                        </label>
                        <input
                          type="text"
                          value={seatCode}
                          onChange={(e) => setSeatCode(e.target.value.toUpperCase())}
                          className="w-full text-xs font-mono font-bold p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleVerifyBoardingPass}
                      disabled={loadingAction}
                      className="w-full py-4 text-xs font-bold gap-2"
                      size="lg"
                    >
                      <span>{loadingAction ? "Verifying with BOM Airport..." : "VERIFY & CONTINUE"}</span>
                      <Check className="w-4 h-4" />
                    </Button>
                  </Card>
                </div>
              )}

              {/* ===================================================================== */}
              {/* STEP 4: CORRIDOR, FARE & WAIT-VS-SAVE SLIDER (C4)                      */}
              {/* ===================================================================== */}
              {step === "DESTINATION" && selectedFlight && (
                <div className="space-y-4">
                  <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-4">
                    <div>
                      <h2 className="text-base font-bold text-[var(--foreground)] font-display">
                        Select Drop-off Corridor
                      </h2>
                      <p className="text-xs text-[var(--muted)]">
                        Terminal: Mumbai Airport Terminal {selectedFlight.terminal}
                      </p>
                    </div>

                    {/* Corridor Zone Grid */}
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
                                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-bold shadow-xs"
                                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] hover:border-[var(--muted)]"
                            }`}
                          >
                            <p className="text-xs font-bold truncate">{z.name}</p>
                            <p className="text-[10px] text-[var(--muted)]">{z.approxDistanceKmFromT2} km</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Specific Landmark */}
                    <div>
                      <label className="text-xs font-semibold text-[var(--muted)] mb-1 block">
                        Drop-off Landmark
                      </label>
                      <select
                        value={selectedAddress}
                        onChange={(e) => setSelectedAddress(e.target.value)}
                        className="w-full text-xs p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
                      >
                        {(MUMBAI_ZONES[selectedZone] || MUMBAI_ZONES["Thane"]).popularDropoffs.map((drop) => (
                          <option key={drop} value={drop}>
                            {drop}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* C4: Wait-vs-Save Slider with live rupee & minute values and haptics */}
                    <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-[var(--primary)]" />
                          {t.waitVsSave}
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          Save ₹{estimates?.estimatedSavings} ({estimates?.savingsPct}%)
                        </span>
                      </div>

                      <Slider
                        value={[waitSaveRatio]}
                        onValueChange={(val) => {
                          setWaitSaveRatio(val[0]);
                          triggerHaptic();
                        }}
                        max={100}
                        step={5}
                      />

                      <div className="flex justify-between text-[11px] text-[var(--muted)] pt-1">
                        <span>Max Wait: {estimates?.maxWaitMins}m</span>
                        <span>Share: ₹{estimates?.estimatedPoolFare}</span>
                      </div>
                    </div>

                    {/* Luggage Counter */}
                    <div className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <Luggage className="w-4 h-4 text-[var(--muted)]" />
                        <div>
                          <span className="text-xs font-bold text-[var(--foreground)]">Luggage Bags</span>
                          <p className="text-[10px] text-[var(--muted)]">Max 4 in vehicle</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setLuggageCount(num)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                              luggageCount === num
                                ? "bg-[var(--primary)] text-black shadow-xs"
                                : "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fare Card with Savings Ring */}
                    {estimates && (
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0B1424] to-[#141C30] border border-[var(--border)] flex items-center justify-between text-white">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--accent)]">
                            Guaranteed Fare
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-white font-mono">
                              ₹{estimates.estimatedPoolFare}
                            </span>
                            <span className="text-xs text-slate-400 line-through">
                              ₹{estimates.soloFare}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-400 mt-0.5">
                            🌱 -{estimates.co2Kg} kg CO₂ saved
                          </p>
                        </div>

                        <Ring
                          value={estimates.savingsPct}
                          size={64}
                          strokeWidth={6}
                          color="var(--accent)"
                        >
                          <span className="text-xs font-bold text-white font-mono">
                            {estimates.savingsPct}%
                          </span>
                        </Ring>
                      </div>
                    )}

                    <Button
                      onClick={handleImReady}
                      disabled={loadingAction}
                      className="w-full py-4 text-xs font-bold gap-2"
                      size="lg"
                    >
                      <span>{loadingAction ? "Sending Signal..." : "I'VE LANDED & READY"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Card>
                </div>
              )}

              {/* ===================================================================== */}
              {/* STEP 5: ACTIVE POOL & RIDE LIFECYCLE (C4)                             */}
              {/* ===================================================================== */}
              {step === "RIDE_STATE" && (
                <div className="space-y-4">
                  {/* SEARCHING RADAR STATE */}
                  {rideStatus === "SEARCHING" && (
                    <Card className="p-6 border-[var(--border)] bg-[var(--surface)] text-center space-y-4">
                      {/* Formation Flight Radar Animation */}
                      <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border border-[var(--primary)]/30 animate-ping" />
                        <div className="absolute inset-2 rounded-full border border-[var(--accent)]/40 animate-pulse" />
                        <div className="w-16 h-16 rounded-full bg-[var(--primary)] text-black flex items-center justify-center shadow-xl z-10">
                          <Plane className="w-7 h-7 transform -rotate-45" />
                        </div>
                      </div>

                      <div>
                        <h2 className="text-base font-bold text-[var(--foreground)] font-display">
                          Scanning Pool Formation...
                        </h2>
                        <p className="text-xs text-[var(--muted)] mt-1 max-w-xs mx-auto">
                          Pairing with passengers from <b>{selectedFlight?.flightNumber}</b> heading to{" "}
                          <b>{activeRequest?.destinationZone}</b>.
                        </p>
                      </div>

                      <div className="bg-[var(--surface-2)] p-3 rounded-xl border border-[var(--border)] text-xs text-[var(--muted)] flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-4 h-4 text-[var(--primary)]" /> Max Wait Cap:
                        </span>
                        <span className="font-mono font-bold text-[var(--foreground)]">20 Mins (Bounded)</span>
                      </div>

                      {/* Optional Gate Trivia while waiting at baggage carousel */}
                      {demoMode && (
                        <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left mt-2 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[var(--foreground)] flex items-center gap-1">
                              <HelpCircle className="w-3.5 h-3.5 text-[var(--accent)]" /> Gate Trivia (Baggage Wait)
                            </span>
                            <span className="text-[10px] text-[var(--muted)] font-mono">
                              #{triviaIndex + 1} of {GATE_TRIVIA_QUESTIONS.length}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--foreground)] font-medium">
                            {GATE_TRIVIA_QUESTIONS[triviaIndex].question}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {GATE_TRIVIA_QUESTIONS[triviaIndex].options.map((opt, i) => (
                              <button
                                key={i}
                                onClick={() => handleAnswerTrivia(i)}
                                className={`p-1.5 text-[11px] rounded-lg border text-left transition-colors ${
                                  selectedTriviaOption === i
                                    ? "bg-[var(--primary)] text-black border-[var(--primary)] font-bold"
                                    : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--muted)]"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          {triviaFeedback && (
                            <p className="text-[11px] text-emerald-400 font-semibold pt-1">
                              {triviaFeedback}
                            </p>
                          )}
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshRideStatus()}
                        className="gap-1.5 text-xs mx-auto"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
                      </Button>
                    </Card>
                  )}

                  {/* POOL FORMING STATE */}
                  {rideStatus === "POOL_FORMING" && poolData && (
                    <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-4">
                      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                        <div>
                          <Badge variant="primary" className="text-[10px]">
                            Pool Forming ({poolData.members.length}/4)
                          </Badge>
                          <h2 className="text-base font-bold text-[var(--foreground)] mt-1 font-display">
                            {poolData.destinationCluster} Corridor
                          </h2>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[var(--muted)] block uppercase">Your Share</span>
                          <span className="text-xl font-mono font-black text-[var(--primary)]">
                            ₹{estimates?.estimatedPoolFare}
                          </span>
                        </div>
                      </div>

                      {/* Co-riders list (Shows Trusted Rider badge only, never scores) */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                          Verified Co-Riders:
                        </p>
                        {poolData.members.map((m: PoolMember) => (
                          <div
                            key={m.userId}
                            className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar name={m.name} size="sm" />
                              <div>
                                <p className="font-bold text-[var(--foreground)]">
                                  {m.name} {m.userId === currentUser?.id ? "(You)" : ""}
                                </p>
                                <p className="text-[10px] text-[var(--muted)]">
                                  {m.maskedAddress || "Corridor"} • {m.luggageCount || 1} bag(s)
                                </p>
                              </div>
                            </div>
                            <span className="text-emerald-400 text-[10px] font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              ✓ {t.trustedRider}
                            </span>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={() => setShowPayment(true)}
                        className="w-full py-4 text-xs font-bold gap-2"
                        size="lg"
                      >
                        <Lock className="w-4 h-4" />
                        <span>CONFIRM & LOCK SHARE (₹{estimates?.estimatedPoolFare || 360})</span>
                      </Button>

                      <button
                        onClick={handleLeavePool}
                        className="w-full text-center text-xs font-semibold text-rose-400 hover:underline py-1"
                      >
                        Leave pool without penalty
                      </button>
                    </Card>
                  )}

                  {/* WAIT CAP EXPIRED: SOLO CONSENT (Part A2) */}
                  {rideStatus === "WAIT_CAP_EXPIRED" && (
                    <Card className="p-6 border-[var(--border)] bg-[var(--surface)] text-center space-y-4">
                      <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-[var(--foreground)] font-display">
                          Wait Cap Reached (20 Mins)
                        </h2>
                        <p className="text-xs text-[var(--muted)] mt-1 max-w-xs mx-auto">
                          Not enough co-passengers landed for a full pool. You can go solo immediately at a clearly disclosed price or keep waiting.
                        </p>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Button
                          onClick={() => handleSoloAction("GO_SOLO")}
                          className="w-full py-3.5 text-xs font-bold"
                          size="lg"
                        >
                          GO SOLO CAB (₹{estimates?.soloFare || 740})
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleSoloAction("KEEP_WAITING")}
                          className="w-full py-3 text-xs"
                          size="sm"
                        >
                          Keep Waiting (+10 Mins)
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* DRIVER ASSIGNED & IN TRANSIT */}
                  {(rideStatus === "DRIVER_ASSIGNED" || rideStatus === "ON_TRIP") && poolData && (
                    <Card className="p-5 border-[var(--border)] bg-[var(--surface)] space-y-4">
                      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                        <div>
                          <Badge variant="success" className="text-[10px]">
                            {rideStatus === "ON_TRIP" ? "Trip In Transit" : "Cab at Bay P4"}
                          </Badge>
                          <h2 className="text-base font-bold text-[var(--foreground)] mt-1 font-display">
                            {poolData.driver?.name || "Ramesh Shinde"}
                          </h2>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[var(--muted)] block uppercase">Pickup OTP</span>
                          <span className="text-xl font-mono font-black text-[var(--primary)] bg-[var(--primary)]/10 px-2.5 py-0.5 rounded-lg border border-[var(--primary)]/30">
                            {poolData.trip?.otpCode || "1429"}
                          </span>
                        </div>
                      </div>

                      {/* Driver & Vehicle */}
                      <div className="bg-[var(--surface-2)] p-3.5 rounded-xl border border-[var(--border)] flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[var(--foreground)]">
                            {poolData.vehicle?.model || "Maruti Suzuki Swift Dzire"}
                          </p>
                          <p className="font-mono font-bold text-[var(--accent)]">
                            {poolData.vehicle?.licensePlate || "MH-02-EE-4123"}
                          </p>
                          <p className="text-[var(--muted)] text-[10px]">⭐ 4.9 Rating • 1,420 Airport Trips</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                          <Car className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Route Steps */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                          Route Drop-off Steps:
                        </p>
                        <div className="p-2.5 bg-[var(--surface-2)] rounded-xl text-xs flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-black font-bold flex items-center justify-center text-[10px]">
                            P
                          </span>
                          <span className="font-semibold text-[var(--foreground)]">
                            Terminal {selectedFlight?.terminal} (Cab Bay P4)
                          </span>
                        </div>
                        {poolData.stops?.map((stop: PoolStop) => (
                          <div
                            key={stop.memberId}
                            className="p-2.5 bg-[var(--surface-2)] rounded-xl text-xs flex items-center justify-between border border-[var(--border)]"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black font-bold flex items-center justify-center text-[10px]">
                                {stop.dropoffOrder}
                              </span>
                              <span className="font-medium text-[var(--foreground)] truncate max-w-[200px]">
                                {stop.riderName}: {stop.destinationAddress}
                              </span>
                            </div>
                            <span className="text-[10px] text-[var(--accent)] font-bold">{stop.destinationZone}</span>
                          </div>
                        ))}
                      </div>

                      {/* Safety Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowShare(true)}
                          className="gap-1.5 text-xs"
                        >
                          <Share2 className="w-4 h-4 text-[var(--accent)]" /> {t.shareTrip}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowSOS(true)}
                          className="gap-1.5 text-xs"
                        >
                          <AlertTriangle className="w-4 h-4" /> {t.emergencySOS}
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* COMPLETED CELEBRATION */}
                  {rideStatus === "COMPLETED" && (
                    <Card className="p-6 border-[var(--border)] bg-[var(--surface)] text-center space-y-4">
                      <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] font-display">
                          {t.landingCelebration}
                        </h2>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          You safely arrived and saved ₹{estimates?.estimatedSavings || 380} on this airport pool.
                        </p>
                      </div>

                      <div className="bg-[var(--surface-2)] border border-[var(--border)] p-4 rounded-2xl">
                        <p className="text-xs font-semibold text-[var(--muted)]">Captured Fare</p>
                        <p className="text-3xl font-black font-mono text-[var(--foreground)] mt-1">
                          ₹{estimates?.estimatedPoolFare || 360}
                        </p>
                        <p className="text-[11px] text-emerald-400 mt-1">
                          🌱 4.8 kg CO₂ Carbon Emission Saved
                        </p>
                      </div>

                      <Button
                        onClick={() => setShowRating(true)}
                        className="w-full py-3.5 text-xs font-bold"
                        size="lg"
                      >
                        Rate Driver & Co-Riders
                      </Button>
                    </Card>
                  )}
                </div>
              )}
            </div>

            {/* Center & Right Panes on Desktop (Col 6-12) */}
            <div className="hidden lg:col-span-7 lg:flex lg:flex-col space-y-4">
              {/* Interactive Mumbai Map with pulsing airport beacon */}
              <div className="rounded-2xl overflow-hidden border border-[var(--border)] shadow-xl h-[420px]">
                <MapPicker
                  terminal={(selectedFlight?.terminal as "T1" | "T2") || "T2"}
                  selectedZone={selectedZone}
                  onSelectZone={(z) => handleSelectZone(z)}
                  height="420px"
                />
              </div>

              {/* Desktop Detail Panel (Corridor Summary & Fare Analytics) */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 border-[var(--border)] bg-[var(--surface)]">
                  <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    Airport Terminal Status
                  </span>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-base text-[var(--foreground)]">
                        Terminal {selectedFlight?.terminal || "T2"}
                      </p>
                      <p className="text-xs text-[var(--muted)]">Dedicated FlightPool Bay P4</p>
                    </div>
                    <Badge variant="primary" className="font-mono">
                      Fast Track
                    </Badge>
                  </div>
                </Card>

                <Card className="p-4 border-[var(--border)] bg-[var(--surface)]">
                  <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    Community Savings
                  </span>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-base text-[var(--accent)]">
                        ₹{estimates?.estimatedSavings || 380} Saved
                      </p>
                      <p className="text-xs text-[var(--muted)]">~{estimates?.savingsPct || 51}% off Solo Fare</p>
                    </div>
                    <Sparkles className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MOBILE 4-TAB BOTTOM NAVIGATION BAR (Ride, Rewards, Trips, Profile)         */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--border)] px-4 py-2 sm:hidden flex items-center justify-around text-xs">
        <button
          onClick={() => setActiveTab("ride")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === "ride" ? "text-[var(--primary)] font-bold" : "text-[var(--muted)]"
          }`}
        >
          <Car className="w-5 h-5" />
          <span className="text-[10px]">Ride</span>
        </button>

        <button
          onClick={() => setActiveTab("rewards")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === "rewards" ? "text-[var(--primary)] font-bold" : "text-[var(--muted)]"
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px]">Rewards</span>
        </button>

        <button
          onClick={() => setActiveTab("trips")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === "trips" ? "text-[var(--primary)] font-bold" : "text-[var(--muted)]"
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px]">Trips</span>
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === "profile" ? "text-[var(--primary)] font-bold" : "text-[var(--muted)]"
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </nav>

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
        vehicleDetails={
          poolData?.vehicle ? `${poolData.vehicle.model} (${poolData.vehicle.licensePlate})` : undefined
        }
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
