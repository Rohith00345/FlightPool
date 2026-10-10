"use client";

export type Language = "en" | "hi" | "mr";

export interface TranslationDictionary {
  heroHeadline: string;
  heroSubheadline: string;
  seeMyFare: string;
  flightNumberInput: string;
  terminal1: string;
  terminal2: string;
  searchFlight: string;
  waitingPassengers: string;
  farePreview: string;
  poolRadar: string;
  womenOnlyPool: string;
  privacyNote: string;
  confirmPool: string;
  soloFare: string;
  poolFare: string;
  youSave: string;
  waitVsSave: string;
  safetyShield: string;
  safetyShieldDesc: string;
  shareTrip: string;
  checkIn: string;
  emergencySOS: string;
  enterOtp: string;
  verifyAndRide: string;
  passengersWaiting: string;
  rewardsTitle: string;
  rewardsComingSoon: string;
  flightScore: string;
  milesBalance: string;
  trustedRider: string;
  landingCelebration: string;
  settings: string;
  theme: string;
  language: string;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    heroHeadline: "Landing at BOM? Share a cab home and save up to 50%",
    heroSubheadline: "Pair with verified co-passengers on your flight heading to Thane, Powai, Bandra, Mulund & Navi Mumbai.",
    seeMyFare: "See my fare",
    flightNumberInput: "Enter Flight (e.g. 6E-204, AI-865)",
    terminal1: "Terminal 1 (Domestic)",
    terminal2: "Terminal 2 (International & Domestic)",
    searchFlight: "Search airline, flight # or city",
    waitingPassengers: "passengers waiting",
    farePreview: "Guaranteed Fare Preview",
    poolRadar: "Airport Pool Radar",
    womenOnlyPool: "Women-Only Pool",
    privacyNote: "Gender verified via airline boarding pass. Never disclosed publicly.",
    confirmPool: "Confirm Shared Cab",
    soloFare: "Solo Cab Fare",
    poolFare: "FlightPool Share",
    youSave: "You Save",
    waitVsSave: "Wait vs Save Preference",
    safetyShield: "Safety Shield",
    safetyShieldDesc: "24/7 Mumbai Police Dispatch & Real-Time Family Trip Tracking",
    shareTrip: "Share Live Trip",
    checkIn: "Safety Check-in",
    emergencySOS: "Emergency SOS",
    enterOtp: "Enter 6-Digit Boarding OTP",
    verifyAndRide: "Verify & Start Journey",
    passengersWaiting: "passengers waiting for cab pool",
    rewardsTitle: "FlightDeck Rewards & Miles",
    rewardsComingSoon: "FlightDeck Rewards coming soon for public travelers.",
    flightScore: "Flight Score",
    milesBalance: "Miles Balance",
    trustedRider: "Trusted Rider",
    landingCelebration: "Welcome to Mumbai! Journey Completed",
    settings: "Preferences & Settings",
    theme: "Theme (Dark / Light / AMOLED)",
    language: "Language",
  },
  hi: {
    heroHeadline: "मुंबई एयरपोर्ट (BOM) पहुंच रहे हैं? कैब शेयर करें और 50% तक बचाएं",
    heroSubheadline: "अपनी ही फ्लाइट के यात्रियों के साथ ठाणे, पवई, बांद्रा, मुलुंड और नवी मुंबई के लिए कैब शेयर करें।",
    seeMyFare: "किराया देखें",
    flightNumberInput: "फ्लाइट नंबर दर्ज करें (उदा. 6E-204, AI-865)",
    terminal1: "टर्मिनल 1 (घरेलू)",
    terminal2: "टर्मिनल 2 (अंतर्राष्ट्रीय एवं घरेलू)",
    searchFlight: "एयरलाइन, फ्लाइट या शहर खोजें",
    waitingPassengers: "यात्री प्रतीक्षा कर रहे हैं",
    farePreview: "किराया पूर्वावलोकन",
    poolRadar: "एयरपोर्ट पूल रडार",
    womenOnlyPool: "केवल महिलाओं के लिए पूल",
    privacyNote: "बोर्डिंग पास से लिंग सत्यापित। सार्वजनिक रूप से कभी नहीं दिखाया जाता।",
    confirmPool: "शेयर्ड कैब कन्फर्म करें",
    soloFare: "अकेले कैब का किराया",
    poolFare: "फ्लाइटपूल किराया",
    youSave: "आपकी बचत",
    waitVsSave: "प्रतीक्षा बनाम बचत",
    safetyShield: "सुरक्षा शील्ड",
    safetyShieldDesc: "24/7 मुंबई पुलिस सहायता और रीयल-टाइम परिवार ट्रैकिंग",
    shareTrip: "सफ़र शेयर करें",
    checkIn: "सुरक्षा चेक-इन",
    emergencySOS: "आपातकालीन SOS",
    enterOtp: "6-अंकों का बोर्डिंग OTP दर्ज करें",
    verifyAndRide: "सत्यापित करें और यात्रा शुरू करें",
    passengersWaiting: "यात्री कैब शेयर करने के लिए प्रतीक्षारत",
    rewardsTitle: "फ्लाइटडेक रिवॉर्ड्स एवं माइल्स",
    rewardsComingSoon: "फ्लाइटडेक रिवॉर्ड्स जल्द ही सार्वजनिक यात्रियों के लिए उपलब्ध होंगे।",
    flightScore: "फ्लाइट स्कोर",
    milesBalance: "माइल्स बैलेंस",
    trustedRider: "विश्वसनीय यात्री",
    landingCelebration: "मुंबई में आपका स्वागत है! यात्रा संपन्न",
    settings: "सेटिंग्स",
    theme: "थीम (डार्क / लाइट / अमोलेड)",
    language: "भाषा",
  },
  mr: {
    heroHeadline: "मुंबई विमानतळावर (BOM) आगमन? कॅब शेअर करा आणि ५०% पर्यंत बचत करा",
    heroSubheadline: "आपल्याच विमानातील सहप्रवाशांसोबत ठाणे, पवई, वांद्रे, मुलुंड आणि नवी मुंबईसाठी कॅब शेअर करा.",
    seeMyFare: "माझे भाडे पहा",
    flightNumberInput: "फ्लाइट नंबर प्रविष्ट करा (उदा. 6E-204)",
    terminal1: "टर्मिनल १ (अंतर्गत)",
    terminal2: "टर्मिनल २ (आंतरराष्ट्रीय आणि अंतर्गत)",
    searchFlight: "एअरलाइन, फ्लाइट किंवा शहर शोधा",
    waitingPassengers: "प्रवासी वाट पाहत आहेत",
    farePreview: "भाडे पूर्वावलोकन",
    poolRadar: "विमानतळ पूल रडार",
    womenOnlyPool: "फक्त महिलांसाठी पूल",
    privacyNote: "बोर्डिंग पासद्वारे लिंग सत्यापित. गोपनीय ठेवले जाते.",
    confirmPool: "शेअर्ड कॅब निश्चित करा",
    soloFare: "एकट्या कॅबचे भाडे",
    poolFare: "फ्लाइटपूल भाडे",
    youSave: "तुमची बचत",
    waitVsSave: "प्रतीक्षा विरूद्ध बचत",
    safetyShield: "सुरक्षा कवच",
    safetyShieldDesc: "२४/७ मुंबई पोलीस मदत आणि थेट कुटुंब ट्रॅकिंग",
    shareTrip: "प्रवास शेअर करा",
    checkIn: "सुरक्षा चेक-इन",
    emergencySOS: "आपत्कालीन SOS",
    enterOtp: "६-अंकी बोर्डिंग OTP टाका",
    verifyAndRide: "सत्यापित करा आणि प्रवास सुरू करा",
    passengersWaiting: "प्रवासी कॅब पूलसाठी प्रतीक्षेत",
    rewardsTitle: "फ्लाइटडेक रिवॉर्ड्स आणि माइल्स",
    rewardsComingSoon: "फ्लाइटडेक रिवॉर्ड्स लवकरच उपलब्ध होतील.",
    flightScore: "फ्लाइट स्कोअर",
    milesBalance: "माइल्स शिल्लक",
    trustedRider: "विश्वासू प्रवासी",
    landingCelebration: "मुंबईत आपले स्वागत आहे! प्रवास पूर्ण",
    settings: "सेटिंग्ज",
    theme: "थीम (डार्क / लाइट / अमोलेड)",
    language: "भाषा",
  },
};
