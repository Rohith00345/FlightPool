"use client";

import { isClientDemoMode } from "../demo";

export interface ScoreCategory {
  name: string;
  weight: number; // percentage (30, 25, 20, 15, 10)
  maxScore: number;
  currentScore: number;
  description: string;
}

export interface ScoreEvent {
  id: string;
  reason: string;
  delta: number;
  timestamp: string;
  category: "Reliability" | "Community" | "Safety" | "Loyalty" | "Profile";
}

export interface QuestItem {
  id: string;
  title: string;
  description: string;
  type: "TRIP" | "SEASON";
  progress: number;
  target: number;
  rewardMiles: number;
  isCompleted: boolean;
  hasStreakFreeze: boolean;
}

export interface BadgeItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
  unlockedAt?: string;
}

export interface PassportStamp {
  zone: string;
  terminal: string;
  flightCode: string;
  stampedAt: string;
}

export interface RewardCatalogItem {
  id: string;
  title: string;
  costMiles: number;
  discountRupees: number;
  description: string;
  type: "RIDE_CREDIT" | "PERK";
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  greenMiles: number;
  co2SavedKg: number;
  isCurrentUser: boolean;
}

export interface GateTriviaQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  fact: string;
}

export interface GamificationState {
  enabled: boolean;
  flightScore: number; // 0 - 1000
  tierName: "Taxi" | "Takeoff" | "Cruise" | "Jet Stream" | "Supersonic";
  tierPerk: string;
  xp: number;
  xpNextLevel: number;
  rankName: "Ground Crew" | "Cadet" | "First Officer" | "Captain" | "Commander" | "Ace";
  milesBalance: number;
  scoreCategories: ScoreCategory[];
  recentScoreEvents: ScoreEvent[];
  quests: QuestItem[];
  badges: BadgeItem[];
  passportStamps: PassportStamp[];
  rewardsCatalog: RewardCatalogItem[];
  leaderboard: LeaderboardEntry[];
  triviaQuestions: GateTriviaQuestion[];
}

export const GATE_TRIVIA_QUESTIONS: GateTriviaQuestion[] = [
  {
    id: "tr_1",
    question: "Which terminal at BOM handles all international flights?",
    options: ["Terminal 1", "Terminal 2", "Both T1 & T2", "Terminal 3"],
    correctIndex: 1,
    fact: "Terminal 2 (T2) at Sahar handles all international arrivals and departures as well as Air India and Vistara domestic flights.",
  },
  {
    id: "tr_2",
    question: "What is the approximate road distance from BOM T2 to Thane via Eastern Express Highway?",
    options: ["12 km", "18 km", "25 - 31 km", "45 km"],
    correctIndex: 2,
    fact: "The corridor to Majiwada/Ghodbunder Road in Thane is ~25 to 31 km, which makes pooling ideal to save ₹300+ per passenger.",
  },
  {
    id: "tr_3",
    question: "Which highway corridor connects BOM Airport directly to Powai and JVLR?",
    options: ["Western Express Hwy", "Jogeshwari–Vikhroli Link Rd (JVLR)", "Sion–Panvel Hwy", "Coastal Road"],
    correctIndex: 1,
    fact: "JVLR connects the Western Express Highway near the airport directly to Powai and the Eastern Express Highway.",
  },
];

export function getGamificationState(): GamificationState {
  const isDemo = isClientDemoMode();

  if (!isDemo) {
    return {
      enabled: false,
      flightScore: 0,
      tierName: "Taxi",
      tierPerk: "Rewards coming soon",
      xp: 0,
      xpNextLevel: 500,
      rankName: "Ground Crew",
      milesBalance: 0,
      scoreCategories: [],
      recentScoreEvents: [],
      quests: [],
      badges: [],
      passportStamps: [],
      rewardsCatalog: [],
      leaderboard: [],
      triviaQuestions: [],
    };
  }

  // Realistic mock gamification profile when DEMO_MODE === "true"
  return {
    enabled: true,
    flightScore: 840, // 0 - 1000 gauge
    tierName: "Supersonic",
    tierPerk: "Express Marshal Bay priority & 10% ride credit rebate",
    xp: 2450,
    xpNextLevel: 3500,
    rankName: "Captain",
    milesBalance: 1420,
    scoreCategories: [
      {
        name: "Reliability",
        weight: 30,
        maxScore: 300,
        currentScore: 285,
        description: "On-time OTP validation at airport bay & zero no-shows",
      },
      {
        name: "Community",
        weight: 25,
        maxScore: 250,
        currentScore: 230,
        description: "Co-rider ratings and positive courtesy feedback",
      },
      {
        name: "Safety",
        weight: 20,
        maxScore: 200,
        currentScore: 195,
        description: "Clean ride verification and verified identity",
      },
      {
        name: "Loyalty",
        weight: 15,
        maxScore: 150,
        currentScore: 80,
        description: "Frequent Mumbai terminal pool completions",
      },
      {
        name: "Profile",
        weight: 10,
        maxScore: 100,
        currentScore: 50,
        description: "Boarding pass verification & account completion",
      },
    ],
    recentScoreEvents: [
      {
        id: "ev_1",
        reason: "Instant OTP verification at T2 Bay B",
        delta: +15,
        timestamp: "Yesterday",
        category: "Reliability",
      },
      {
        id: "ev_2",
        reason: "Co-pilot kudos sticker from Priya N.",
        delta: +20,
        timestamp: "Yesterday",
        category: "Community",
      },
      {
        id: "ev_3",
        reason: "Completed shared ride to Thane",
        delta: +15,
        timestamp: "3 days ago",
        category: "Loyalty",
      },
      {
        id: "ev_4",
        reason: "Boarding pass verified via PNR",
        delta: +25,
        timestamp: "5 days ago",
        category: "Profile",
      },
    ],
    quests: [
      {
        id: "q_1",
        title: "Thane Corridor Pioneer",
        description: "Complete 3 shared rides heading towards Thane",
        type: "TRIP",
        progress: 2,
        target: 3,
        rewardMiles: 250,
        isCompleted: false,
        hasStreakFreeze: true,
      },
      {
        id: "q_2",
        title: "Clean Air Mumbai",
        description: "Prevent 50 kg of CO₂ through airport shared rides",
        type: "SEASON",
        progress: 38,
        target: 50,
        rewardMiles: 500,
        isCompleted: false,
        hasStreakFreeze: true,
      },
    ],
    badges: [
      {
        id: "b_first_landing",
        title: "First Landing",
        description: "Completed first shared cab trip from BOM Airport",
        icon: "🛬",
        isUnlocked: true,
        unlockedAt: "Oct 2026",
      },
      {
        id: "b_boarding_buddy",
        title: "Boarding Buddy",
        description: "Shared ride with 2+ verified passengers from same flight",
        icon: "🤝",
        isUnlocked: true,
        unlockedAt: "Oct 2026",
      },
      {
        id: "b_mumbai_explorer",
        title: "Mumbai Explorer",
        description: "Traveled to 3 different corridor zones",
        icon: "🗺️",
        isUnlocked: true,
        unlockedAt: "Oct 2026",
      },
      {
        id: "b_night_owl",
        title: "Night Owl Safe",
        description: "Completed safe night journey with live SOS tracking",
        icon: "🦉",
        isUnlocked: true,
        unlockedAt: "Oct 2026",
      },
      {
        id: "b_green_miles",
        title: "Green Miles",
        description: "Saved over 25 kg of carbon emissions",
        icon: "🌱",
        isUnlocked: true,
        unlockedAt: "Oct 2026",
      },
      {
        id: "b_quick_boarder",
        title: "Quick Boarder",
        description: "Validated PIN code within 2 minutes of reaching bay",
        icon: "⚡",
        isUnlocked: true,
        unlockedAt: "Oct 2026",
      },
      {
        id: "b_copilot",
        title: "Co-pilot",
        description: "Earned 5 positive co-rider kudos tags",
        icon: "✈️",
        isUnlocked: false,
      },
      {
        id: "b_frequent_flyer",
        title: "Frequent Flyer",
        description: "Completed 10 rides in a single season",
        icon: "🌟",
        isUnlocked: false,
      },
    ],
    passportStamps: [
      {
        zone: "Thane",
        terminal: "T2",
        flightCode: "6E-204",
        stampedAt: "10 Oct 2026",
      },
      {
        zone: "Powai",
        terminal: "T2",
        flightCode: "AI-865",
        stampedAt: "08 Oct 2026",
      },
      {
        zone: "Bandra",
        terminal: "T1",
        flightCode: "QP-1102",
        stampedAt: "04 Oct 2026",
      },
    ],
    rewardsCatalog: [
      {
        id: "rw_100",
        title: "₹100 Airport Cab Credit",
        costMiles: 500,
        discountRupees: 100,
        description: "Deducted automatically from your next shared cab fare",
        type: "RIDE_CREDIT",
      },
      {
        id: "rw_250",
        title: "₹250 Airport Cab Credit",
        costMiles: 1200,
        discountRupees: 250,
        description: "Deducted automatically from your next shared cab fare",
        type: "RIDE_CREDIT",
      },
      {
        id: "rw_detour",
        title: "Zero-Detour Token",
        costMiles: 800,
        discountRupees: 0,
        description: "Guarantees first drop-off order on your next shared pool",
        type: "PERK",
      },
      {
        id: "rw_bay",
        title: "Express Bay Priority",
        costMiles: 650,
        discountRupees: 0,
        description: "Priority staging line access at airport Terminal 2",
        type: "PERK",
      },
    ],
    leaderboard: [
      {
        rank: 1,
        nickname: "SkyRunner99",
        greenMiles: 340,
        co2SavedKg: 85.2,
        isCurrentUser: false,
      },
      {
        rank: 2,
        nickname: "BOM_Captain_A",
        greenMiles: 295,
        co2SavedKg: 73.8,
        isCurrentUser: true,
      },
      {
        rank: 3,
        nickname: "WesternExpress",
        greenMiles: 260,
        co2SavedKg: 65.0,
        isCurrentUser: false,
      },
      {
        rank: 4,
        nickname: "NightOwlBOM",
        greenMiles: 215,
        co2SavedKg: 53.7,
        isCurrentUser: false,
      },
      {
        rank: 5,
        nickname: "PowaiCommuter",
        greenMiles: 190,
        co2SavedKg: 47.5,
        isCurrentUser: false,
      },
    ],
    triviaQuestions: GATE_TRIVIA_QUESTIONS,
  };
}
