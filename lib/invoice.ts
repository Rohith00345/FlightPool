import { paiseToRupees } from "./pricing";

export interface GstTaxBreakdown {
  sacCode: string; // 996412 (Passenger transport service)
  baseFarePaise: number;
  cgstPaise: number; // 2.5%
  sgstPaise: number; // 2.5%
  igstPaise: number; // 0% intra-state
  totalTaxPaise: number;
  convenienceFeePaise: number;
  totalPaidPaise: number;
  baseFareRupees: number;
  cgstRupees: number;
  sgstRupees: number;
  totalTaxRupees: number;
  convenienceFeeRupees: number;
  totalPaidRupees: number;
}

export interface GstTripReceipt {
  invoiceNumber: string;
  invoiceDate: string;
  gstin: string;
  companyName: string;
  stateCode: string;
  tripId: string;
  pickupLocation: string;
  dropoffLocation: string;
  corridor: string;
  passengerName: string;
  driverName: string;
  vehiclePlate: string;
  coRidersCount: number;
  co2SavedKg: number;
  fareBreakdown: GstTaxBreakdown;
}

export const FLIGHTPOOL_COMPANY_INFO = {
  companyName: "FlightPool Mobility Solutions Private Limited",
  gstin: "27AABCF9988G1Z4", // Maharashtra state code 27
  stateCode: "27 (Maharashtra)",
  address: "Terminal 2, Chhatrapati Shivaji Maharaj International Airport, Mumbai 400099",
  sacCode: "996412",
};

/**
 * Computes statutory 5% GST tax breakdown for Indian cab aggregators (SAC 996412).
 * Fares in FlightPool are inclusive of taxes. Base fare and GST are extracted with integer paise rounding.
 */
export function calculateGstBreakdown(totalPaidPaise: number, convenienceFeePaise = 0): GstTaxBreakdown {
  const taxableFarePaise = Math.max(0, totalPaidPaise - convenienceFeePaise);

  // For 5% inclusive GST: Base = Taxable / 1.05
  const baseFarePaise = Math.round(taxableFarePaise / 1.05);
  const totalTaxPaise = taxableFarePaise - baseFarePaise;

  // Split equally into CGST (2.5%) and SGST (2.5%) for intra-state Maharashtra transport
  const cgstPaise = Math.floor(totalTaxPaise / 2);
  const sgstPaise = totalTaxPaise - cgstPaise;

  return {
    sacCode: FLIGHTPOOL_COMPANY_INFO.sacCode,
    baseFarePaise,
    cgstPaise,
    sgstPaise,
    igstPaise: 0,
    totalTaxPaise,
    convenienceFeePaise,
    totalPaidPaise,
    baseFareRupees: paiseToRupees(baseFarePaise),
    cgstRupees: paiseToRupees(cgstPaise),
    sgstRupees: paiseToRupees(sgstPaise),
    totalTaxRupees: paiseToRupees(totalTaxPaise),
    convenienceFeeRupees: paiseToRupees(convenienceFeePaise),
    totalPaidRupees: paiseToRupees(totalPaidPaise),
  };
}

/**
 * Generates an official GST invoice record for a completed shared trip.
 */
export function generateTripReceipt(params: {
  tripId: string;
  completedAt?: Date;
  passengerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  corridor: string;
  driverName?: string;
  vehiclePlate?: string;
  coRidersCount?: number;
  totalPaidPaise: number;
  convenienceFeePaise?: number;
}): GstTripReceipt {
  const date = params.completedAt || new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const tripSuffix = params.tripId.slice(-6).toUpperCase();
  const invoiceNumber = `FP/INV/${year}${month}/${tripSuffix}`;

  const fareBreakdown = calculateGstBreakdown(
    params.totalPaidPaise,
    params.convenienceFeePaise || 0
  );

  return {
    invoiceNumber,
    invoiceDate: date.toISOString(),
    gstin: FLIGHTPOOL_COMPANY_INFO.gstin,
    companyName: FLIGHTPOOL_COMPANY_INFO.companyName,
    stateCode: FLIGHTPOOL_COMPANY_INFO.stateCode,
    tripId: params.tripId,
    pickupLocation: params.pickupLocation,
    dropoffLocation: params.dropoffLocation,
    corridor: params.corridor,
    passengerName: params.passengerName,
    driverName: params.driverName || "Assigned Driver",
    vehiclePlate: params.vehiclePlate || "MH-02-COMMERCIAL",
    coRidersCount: params.coRidersCount || 1,
    co2SavedKg: Math.round(((params.coRidersCount || 1) * 3.9) * 10) / 10,
    fareBreakdown,
  };
}
