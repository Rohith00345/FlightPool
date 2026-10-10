import { PrismaClient } from "@prisma/client";
import { isDemoMode } from "../lib/demo";
import { assertLocalDatabase } from "../lib/db-guard";

const prisma = new PrismaClient();

const MUMBAI_ZONES = [
  {
    name: "Thane",
    lat: 19.2183,
    lng: 72.9781,
    addresses: [
      "Hiranandani Estate, Ghodbunder Rd, Thane West",
      "Majiwada Junction, Thane West",
      "Viviana Mall area, Eastern Express Hwy, Thane",
      "Vasant Vihar, Pokhran Rd No 2, Thane West",
    ],
  },
  {
    name: "Mulund",
    lat: 19.1726,
    lng: 72.9425,
    addresses: [
      "LBS Marg, Mulund West, near Nirmal Lifestyle",
      "Sarvodaya Nagar, Mulund West",
      "Mulund East, near Station Road",
      "Devidayal Road, Mulund West",
    ],
  },
  {
    name: "Powai",
    lat: 19.1176,
    lng: 72.9060,
    addresses: [
      "Central Avenue, Hiranandani Gardens, Powai",
      "JVLR, near IIT Bombay Main Gate, Powai",
      "Galleria Shopping Mall, Powai",
      "Raheja Vihar, Chandivali, Powai",
    ],
  },
  {
    name: "Bandra",
    lat: 19.0596,
    lng: 72.8295,
    addresses: [
      "Bandra Kurla Complex (BKC), G Block",
      "Hill Road, Bandra West",
      "Carter Road Promenade, Bandra West",
      "Pali Hill, Bandra West",
    ],
  },
  {
    name: "Andheri",
    lat: 19.1363,
    lng: 72.8277,
    addresses: [
      "Lokhandwala Complex, Andheri West",
      "Versova Link Road, Andheri West",
      "DN Nagar Metro, Andheri West",
      "Four Bungalows, Andheri West",
    ],
  },
  {
    name: "Navi Mumbai",
    lat: 19.0771,
    lng: 72.9986,
    addresses: [
      "Sector 17, Vashi, Navi Mumbai",
      "Palm Beach Road, Nerul, Navi Mumbai",
      "Kopar Khairane Sector 5, Navi Mumbai",
      "Seawoods Grand Central, Navi Mumbai",
    ],
  },
];

const FLIGHTS = [
  { flightNumber: "6E-204", airline: "IndiGo", origin: "DEL (Delhi)", terminal: "T2", status: "LANDED", minutesAgo: 10 },
  { flightNumber: "AI-865", airline: "Air India", origin: "BLR (Bengaluru)", terminal: "T2", status: "LANDED", minutesAgo: 15 },
  { flightNumber: "UK-993", airline: "Vistara", origin: "HYD (Hyderabad)", terminal: "T2", status: "LANDED", minutesAgo: 5 },
  { flightNumber: "QP-1102", airline: "Akasa Air", origin: "MAA (Chennai)", terminal: "T1", status: "ON_TIME", minutesAgo: -20 },
  { flightNumber: "SG-8169", airline: "SpiceJet", origin: "GOI (Goa)", terminal: "T1", status: "ON_TIME", minutesAgo: -30 },
  { flightNumber: "6E-534", airline: "IndiGo", origin: "CCU (Kolkata)", terminal: "T2", status: "SCHEDULED", minutesAgo: -45 },
  { flightNumber: "AI-624", airline: "Air India", origin: "AMD (Ahmedabad)", terminal: "T2", status: "SCHEDULED", minutesAgo: -60 },
  { flightNumber: "UK-850", airline: "Vistara", origin: "COK (Kochi)", terminal: "T2", status: "SCHEDULED", minutesAgo: -75 },
  { flightNumber: "6E-678", airline: "IndiGo", origin: "PNQ (Pune)", terminal: "T1", status: "SCHEDULED", minutesAgo: -90 },
  { flightNumber: "IX-248", airline: "Air India Express", origin: "JAI (Jaipur)", terminal: "T2", status: "SCHEDULED", minutesAgo: -110 },
  { flightNumber: "6E-188", airline: "IndiGo", origin: "LKO (Lucknow)", terminal: "T2", status: "SCHEDULED", minutesAgo: -130 },
  { flightNumber: "QP-1354", airline: "Akasa Air", origin: "IXC (Chandigarh)", terminal: "T1", status: "SCHEDULED", minutesAgo: -150 },
  { flightNumber: "AI-441", airline: "Air India", origin: "PAT (Patna)", terminal: "T2", status: "SCHEDULED", minutesAgo: -180 },
  { flightNumber: "UK-707", airline: "Vistara", origin: "IXZ (Port Blair)", terminal: "T2", status: "SCHEDULED", minutesAgo: -200 },
  { flightNumber: "6E-902", airline: "IndiGo", origin: "GAU (Guwahati)", terminal: "T2", status: "SCHEDULED", minutesAgo: -220 },
];

const PASSENGERS_DATA = [
  { name: "Aarav Sharma", phone: "+919810100001", email: "aarav.sharma@example.com", gender: "MALE", zone: "Thane", bags: 1, womenOnly: false },
  { name: "Priya Nair", phone: "+919810100002", email: "priya.nair@example.com", gender: "FEMALE", zone: "Thane", bags: 2, womenOnly: true },
  { name: "Rohan Kulkarni", phone: "+919810100003", email: "rohan.k@example.com", gender: "MALE", zone: "Thane", bags: 1, womenOnly: false },
  { name: "Sneha Deshmukh", phone: "+919810100004", email: "sneha.d@example.com", gender: "FEMALE", zone: "Thane", bags: 1, womenOnly: true },
  { name: "Vikram Mehta", phone: "+919810100005", email: "vikram.m@example.com", gender: "MALE", zone: "Mulund", bags: 2, womenOnly: false },
  { name: "Ananya Joshi", phone: "+919810100006", email: "ananya.j@example.com", gender: "FEMALE", zone: "Mulund", bags: 1, womenOnly: true },
  { name: "Rahul Verma", phone: "+919810100007", email: "rahul.v@example.com", gender: "MALE", zone: "Mulund", bags: 1, womenOnly: false },
  { name: "Neha Iyer", phone: "+919810100008", email: "neha.iyer@example.com", gender: "FEMALE", zone: "Mulund", bags: 1, womenOnly: true },
  { name: "Rohit Singhania", phone: "+919810100009", email: "rohit.s@example.com", gender: "MALE", zone: "Powai", bags: 1, womenOnly: false },
  { name: "Divya Pillai", phone: "+919810100010", email: "divya.p@example.com", gender: "FEMALE", zone: "Powai", bags: 2, womenOnly: false },
  { name: "Pooja Hegde", phone: "+919810100011", email: "pooja.h@example.com", gender: "FEMALE", zone: "Powai", bags: 1, womenOnly: true },
  { name: "Amit Bansal", phone: "+919810100012", email: "amit.b@example.com", gender: "MALE", zone: "Powai", bags: 1, womenOnly: false },
  { name: "Tanvi Saxena", phone: "+919810100013", email: "tanvi.s@example.com", gender: "FEMALE", zone: "Bandra", bags: 1, womenOnly: true },
  { name: "Arjun Kapoor", phone: "+919810100014", email: "arjun.k@example.com", gender: "MALE", zone: "Bandra", bags: 2, womenOnly: false },
  { name: "Kavita Rao", phone: "+919810100015", email: "kavita.r@example.com", gender: "FEMALE", zone: "Bandra", bags: 1, womenOnly: true },
  { name: "Meera Sen", phone: "+919810100016", email: "meera.sen@example.com", gender: "FEMALE", zone: "Bandra", bags: 1, womenOnly: false },
  { name: "Karan Johar", phone: "+919810100017", email: "karan.j@example.com", gender: "MALE", zone: "Andheri", bags: 1, womenOnly: false },
  { name: "Ritu Chawla", phone: "+919810100018", email: "ritu.c@example.com", gender: "FEMALE", zone: "Andheri", bags: 1, womenOnly: true },
  { name: "Aditya Roy", phone: "+919810100019", email: "aditya.r@example.com", gender: "MALE", zone: "Andheri", bags: 2, womenOnly: false },
  { name: "Shreya Ghoshal", phone: "+919810100020", email: "shreya.g@example.com", gender: "FEMALE", zone: "Andheri", bags: 1, womenOnly: false },
  { name: "Sameer Wankhede", phone: "+919810100021", email: "sameer.w@example.com", gender: "MALE", zone: "Navi Mumbai", bags: 1, womenOnly: false },
  { name: "Swati Bhatt", phone: "+919810100022", email: "swati.b@example.com", gender: "FEMALE", zone: "Navi Mumbai", bags: 2, womenOnly: true },
  { name: "Karthik Raja", phone: "+919810100023", email: "karthik.r@example.com", gender: "MALE", zone: "Navi Mumbai", bags: 1, womenOnly: false },
  { name: "Deepa Malik", phone: "+919810100024", email: "deepa.m@example.com", gender: "FEMALE", zone: "Navi Mumbai", bags: 1, womenOnly: true },
  { name: "Varun Dhawan", phone: "+919810100025", email: "varun.d@example.com", gender: "MALE", zone: "Powai", bags: 1, womenOnly: false },
  { name: "Ruchi Gujral", phone: "+919810100026", email: "ruchi.g@example.com", gender: "FEMALE", zone: "Powai", bags: 1, womenOnly: true },
  { name: "Nikhil Kamath", phone: "+919810100027", email: "nikhil.k@example.com", gender: "MALE", zone: "Bandra", bags: 2, womenOnly: false },
  { name: "Radhika Apte", phone: "+919810100028", email: "radhika.a@example.com", gender: "FEMALE", zone: "Bandra", bags: 1, womenOnly: true },
  { name: "Manish Malhotra", phone: "+919810100029", email: "manish.m@example.com", gender: "MALE", zone: "Bandra", bags: 1, womenOnly: false },
  { name: "Preeti Shenoy", phone: "+919810100030", email: "preeti.s@example.com", gender: "FEMALE", zone: "Thane", bags: 1, womenOnly: true },
  { name: "Devendra Fadnavis", phone: "+919810100031", email: "devendra.f@example.com", gender: "MALE", zone: "Thane", bags: 1, womenOnly: false },
  { name: "Gauri Khan", phone: "+919810100032", email: "gauri.k@example.com", gender: "FEMALE", zone: "Bandra", bags: 2, womenOnly: true },
  { name: "Siddharth Shukla", phone: "+919810100033", email: "siddharth.s@example.com", gender: "MALE", zone: "Andheri", bags: 1, womenOnly: false },
  { name: "Kiara Advani", phone: "+919810100034", email: "kiara.a@example.com", gender: "FEMALE", zone: "Andheri", bags: 1, womenOnly: true },
  { name: "Ayushmann Khurrana", phone: "+919810100035", email: "ayushmann.k@example.com", gender: "MALE", zone: "Mulund", bags: 1, womenOnly: false },
  { name: "Taapsee Pannu", phone: "+919810100036", email: "taapsee.p@example.com", gender: "FEMALE", zone: "Mulund", bags: 1, womenOnly: true },
  { name: "Abhishek Bachchan", phone: "+919810100037", email: "abhishek.b@example.com", gender: "MALE", zone: "Bandra", bags: 1, womenOnly: false },
  { name: "Vidya Balan", phone: "+919810100038", email: "vidya.b@example.com", gender: "FEMALE", zone: "Navi Mumbai", bags: 1, womenOnly: true },
  { name: "Rajkummar Rao", phone: "+919810100039", email: "rajkummar.r@example.com", gender: "MALE", zone: "Powai", bags: 1, womenOnly: false },
  { name: "Kriti Sanon", phone: "+919810100040", email: "kriti.s@example.com", gender: "FEMALE", zone: "Andheri", bags: 1, womenOnly: true },
  { name: "Ranbir Kapoor", phone: "+919810100041", email: "ranbir.k@example.com", gender: "MALE", zone: "Bandra", bags: 2, womenOnly: false },
  { name: "Alia Bhatt", phone: "+919810100042", email: "alia.b@example.com", gender: "FEMALE", zone: "Bandra", bags: 1, womenOnly: true },
];

async function main() {
  const isDemo = (isDemoMode() || process.argv.includes("--demo")) && !process.argv.includes("--prod");
  assertLocalDatabase(isDemo ? "Demo database seeding (db:seed:demo)" : "Production reference seeding (db:seed)");

  if (isDemo) {
    console.log("DEMO_MODE active: Cleaning old demo records and OTP requests...");
    await prisma.otpRequest.deleteMany();
    await prisma.fareQuote.deleteMany();
    await prisma.shareTripToken.deleteMany();
    await prisma.incident.deleteMany();
    await prisma.rating.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.poolMember.deleteMany();
    await prisma.pool.deleteMany();
    await prisma.rideRequest.deleteMany();
    await prisma.passengerVerification.deleteMany();
    await prisma.driverDocument.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.flight.deleteMany();
    await prisma.consent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.sosEvent.deleteMany();
    await prisma.driverIncentive.deleteMany();
    await prisma.payout.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.user.deleteMany();
  }

  console.log("Cleaning and refreshing reference tables...");
  await prisma.ledgerAccount.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.pickupBay.deleteMany();
  await prisma.terminal.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.airport.deleteMany();

  console.log("Seeding Airport, Terminals, Bays & Zones for Mumbai (BOM)...");
  const airport = await prisma.airport.create({
    data: {
      iataCode: "BOM",
      name: "Chhatrapati Shivaji Maharaj International Airport",
      city: "Mumbai",
      timezone: "Asia/Kolkata",
    },
  });

  const [t1, t2] = await Promise.all([
    prisma.terminal.create({
      data: {
        airportId: airport.id,
        code: "T1",
        name: "Terminal 1 (Domestic / Santa Cruz)",
      },
    }),
    prisma.terminal.create({
      data: {
        airportId: airport.id,
        code: "T2",
        name: "Terminal 2 (International & Domestic / Sahar)",
      },
    }),
  ]);

  await Promise.all([
    prisma.pickupBay.create({ data: { terminalId: t2.id, label: "P4 Bay A" } }),
    prisma.pickupBay.create({ data: { terminalId: t2.id, label: "P4 Bay B" } }),
    prisma.pickupBay.create({ data: { terminalId: t2.id, label: "P4 Bay C" } }),
    prisma.pickupBay.create({ data: { terminalId: t2.id, label: "P4 Bay D" } }),
    prisma.pickupBay.create({ data: { terminalId: t1.id, label: "Lane 1 Bay A" } }),
    prisma.pickupBay.create({ data: { terminalId: t1.id, label: "Lane 1 Bay B" } }),
  ]);

  const corridorMap: Record<string, string> = {
    Thane: "EAST",
    Mulund: "EAST",
    Powai: "EAST",
    Bandra: "WEST",
    Andheri: "WEST",
    "Navi Mumbai": "NAVI",
  };

  const createdZones = await Promise.all(
    MUMBAI_ZONES.map((z) =>
      prisma.zone.create({
        data: {
          airportId: airport.id,
          code: z.name.toUpperCase().replace(/\s+/g, "_"),
          name: z.name,
          corridor: corridorMap[z.name] || "EAST",
          lat: z.lat,
          lng: z.lng,
        },
      })
    )
  );

  console.log("Seeding Pricing Rules (Integer Paise) with Guaranteed 30% Savings...");
  await prisma.pricingRule.create({
    data: {
      airportId: airport.id,
      version: 1,
      baseFarePaise: 12000, // ₹120
      perKmPaise: 1800,     // ₹18/km
      perMinPaise: 0,
      nightMultiplier: 1.0,
      minSavingPct: 30.0,
      commissionPct: 15.0,
      convenienceFeePaise: 2000, // ₹20
    },
  });

  for (const zone of createdZones) {
    await prisma.pricingRule.create({
      data: {
        airportId: airport.id,
        zoneId: zone.id,
        version: 1,
        baseFarePaise: 12000,
        perKmPaise: 1800,
        perMinPaise: 0,
        nightMultiplier: 1.0,
        minSavingPct: 30.0,
        commissionPct: 15.0,
        convenienceFeePaise: 2000,
      },
    });
  }

  console.log("Seeding Platform Ledger Accounts...");
  await Promise.all([
    prisma.ledgerAccount.create({ data: { ownerType: "platform", accountType: "cash" } }),
    prisma.ledgerAccount.create({ data: { ownerType: "platform", accountType: "receivable" } }),
    prisma.ledgerAccount.create({ data: { ownerType: "platform", accountType: "commission" } }),
    prisma.ledgerAccount.create({ data: { ownerType: "tax", accountType: "gst" } }),
  ]);

  if (!isDemo) {
    console.log("Production reference data seeded successfully (Zero demo users, drivers, or pools created).");
    return;
  }

  console.log("DEMO_MODE is true: Creating Demo Admin User, Vehicles, Drivers, and Pools...");
  await prisma.user.create({
    data: {
      name: "FlightPool Admin",
      phone: "+919999999999",
      email: "admin@flightpool.in",
      role: "ADMIN",
      gender: "UNSPECIFIED",
    },
  });

  console.log("Creating Vehicles & Drivers...");
  const vehicles = await Promise.all([
    prisma.vehicle.create({
      data: {
        make: "Maruti Suzuki",
        model: "Swift Dzire",
        licensePlate: "MH-02-EE-4123",
        color: "Silver",
        capacitySeats: 4,
        capacityLuggage: 3,
        type: "SEDAN",
      },
    }),
    prisma.vehicle.create({
      data: {
        make: "Maruti Suzuki",
        model: "Ertiga",
        licensePlate: "MH-03-DF-8812",
        color: "Pearl White",
        capacitySeats: 6,
        capacityLuggage: 5,
        type: "SUV",
      },
    }),
    prisma.vehicle.create({
      data: {
        make: "Toyota",
        model: "Innova Crysta",
        licensePlate: "MH-01-BK-9001",
        color: "Metallic Grey",
        capacitySeats: 6,
        capacityLuggage: 5,
        type: "SUV",
      },
    }),
    prisma.vehicle.create({
      data: {
        make: "Tata",
        model: "Nexon EV",
        licensePlate: "MH-04-TC-5521",
        color: "Glacier White",
        capacitySeats: 4,
        capacityLuggage: 3,
        type: "EV",
      },
    }),
    prisma.vehicle.create({
      data: {
        make: "Tata",
        model: "Tigor EV",
        licensePlate: "MH-02-GH-7744",
        color: "Teal Blue",
        capacitySeats: 4,
        capacityLuggage: 3,
        type: "EV",
      },
    }),
  ]);

  await Promise.all([
    prisma.driver.create({
      data: {
        name: "Ramesh Shinde",
        phone: "+919820011223",
        rating: 4.92,
        vehicleId: vehicles[0].id,
        isAvailable: true,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Suresh Patil",
        phone: "+919820022334",
        rating: 4.88,
        vehicleId: vehicles[1].id,
        isAvailable: true,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Ganesh Gaikwad",
        phone: "+919820033445",
        rating: 4.95,
        vehicleId: vehicles[2].id,
        isAvailable: true,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Sunita Kamble",
        phone: "+919820044556",
        rating: 4.98,
        vehicleId: vehicles[3].id,
        isAvailable: true,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Abdul Khan",
        phone: "+919820055667",
        rating: 4.82,
        vehicleId: vehicles[4].id,
        isAvailable: true,
      },
    }),
  ]);

  console.log("Seeding 15 Flights at Mumbai Airport (BOM)...");
  const now = new Date();
  const createdFlights = [];

  for (const f of FLIGHTS) {
    const arrivalTime = new Date(now.getTime() - f.minutesAgo * 60 * 1000);
    const flight = await prisma.flight.create({
      data: {
        flightNumber: f.flightNumber,
        airline: f.airline,
        origin: f.origin,
        destination: "BOM",
        terminal: f.terminal,
        status: f.status,
        arrivalTime,
      },
    });
    createdFlights.push(flight);
  }

  console.log(`Created ${createdFlights.length} flights.`);

  console.log("Seeding 42 Passengers and verifications across Mumbai zones...");
  const primaryFlight = createdFlights[0]; // 6E-204 (DEL)
  const secondaryFlight = createdFlights[1]; // AI-865 (BLR)
  const thirdFlight = createdFlights[2]; // UK-993 (HYD)

  const createdUsers = [];
  const createdRequests = [];

  for (let i = 0; i < PASSENGERS_DATA.length; i++) {
    const p = PASSENGERS_DATA[i];
    const user = await prisma.user.create({
      data: {
        name: p.name,
        phone: p.phone,
        email: p.email,
        gender: p.gender,
        role: "RIDER",
      },
    });
    createdUsers.push(user);

    // Assign flight
    const flight = i < 20 ? primaryFlight : (i < 32 ? secondaryFlight : thirdFlight);
    const zoneInfo = MUMBAI_ZONES.find((z) => z.name === p.zone) || MUMBAI_ZONES[0];
    const address = zoneInfo.addresses[i % zoneInfo.addresses.length];

    // Jitter coordinates slightly around zone center for realism
    const latJitter = (Math.random() - 0.5) * 0.008;
    const lngJitter = (Math.random() - 0.5) * 0.008;

    // Boarding pass verification
    await prisma.passengerVerification.create({
      data: {
        userId: user.id,
        flightId: flight.id,
        boardingPassCode: `BP-${flight.flightNumber.replace("-", "")}-${String(i + 1).padStart(2, "0")}${["A", "B", "C", "D", "E", "F"][i % 6]}`,
        pnr: `PNR${(1000 + i).toString(36).toUpperCase()}`,
        seatNumber: `${(i % 30) + 1}${["A", "B", "C", "D", "E", "F"][i % 6]}`,
        status: "VERIFIED",
        verifiedAt: new Date(now.getTime() - 25 * 60 * 1000),
      },
    });

    // Create ride request for the first 24 passengers to simulate active pools
    if (i < 24) {
      const isReady = i < 18;
      const req = await prisma.rideRequest.create({
        data: {
          userId: user.id,
          flightId: flight.id,
          destinationZone: p.zone,
          destinationAddress: address,
          destinationLat: zoneInfo.lat + latJitter,
          destinationLng: zoneInfo.lng + lngJitter,
          luggageCount: p.bags,
          womenOnly: p.womenOnly,
          readyTime: isReady ? new Date(now.getTime() - (15 - (i % 10)) * 60 * 1000) : null,
          status: isReady ? "POOLING" : "SEARCHING",
        },
      });
      createdRequests.push({ req, user, zone: p.zone, womenOnly: p.womenOnly });
    }
  }

  console.log(`Seeded ${createdUsers.length} passengers and verifications.`);

  // Form a sample active forming pool for Thane (3 riders from flight 6E-204)
  console.log("Setting up an active Thane demonstration pool...");
  const thaneRiders = createdRequests.filter((r) => r.zone === "Thane" && !r.womenOnly).slice(0, 3);
  if (thaneRiders.length >= 2) {
    const demoPool = await prisma.pool.create({
      data: {
        targetFlightId: primaryFlight.id,
        destinationCluster: "Thane",
        terminal: "T2",
        status: "FORMING",
        maxDetourMinutes: 20,
        waitCapExpiry: new Date(now.getTime() + 12 * 60 * 1000), // 12 mins remaining
        vehicleId: vehicles[1].id,
      },
    });

    for (let idx = 0; idx < thaneRiders.length; idx++) {
      const rider = thaneRiders[idx];
      await prisma.poolMember.create({
        data: {
          poolId: demoPool.id,
          rideRequestId: rider.req.id,
          userId: rider.user.id,
          pickupOrder: 1,
          dropoffOrder: idx + 1,
          soloFare: 740,
          poolFare: 360,
          savingsPct: 51.3,
          detourMinutes: idx * 4.5,
          status: "CONFIRMED",
        },
      });
      await prisma.rideRequest.update({
        where: { id: rider.req.id },
        data: { status: "POOLING" },
      });
    }
  }

  // Form a women-only pool for Bandra
  console.log("Setting up a women-only demonstration pool for Bandra...");
  const bandraWomen = createdRequests.filter((r) => r.zone === "Bandra" && r.womenOnly).slice(0, 2);
  if (bandraWomen.length >= 2) {
    const womenPool = await prisma.pool.create({
      data: {
        targetFlightId: primaryFlight.id,
        destinationCluster: "Bandra",
        terminal: "T2",
        status: "FORMING",
        maxDetourMinutes: 15,
        waitCapExpiry: new Date(now.getTime() + 8 * 60 * 1000),
        vehicleId: vehicles[3].id,
      },
    });

    for (let idx = 0; idx < bandraWomen.length; idx++) {
      const rider = bandraWomen[idx];
      await prisma.poolMember.create({
        data: {
          poolId: womenPool.id,
          rideRequestId: rider.req.id,
          userId: rider.user.id,
          pickupOrder: 1,
          dropoffOrder: idx + 1,
          soloFare: 420,
          poolFare: 240,
          savingsPct: 42.8,
          detourMinutes: idx * 3.0,
          status: "CONFIRMED",
        },
      });
      await prisma.rideRequest.update({
        where: { id: rider.req.id },
        data: { status: "POOLING" },
      });
    }
  }

  console.log("Database seeded successfully with Mumbai flight & passenger data!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
