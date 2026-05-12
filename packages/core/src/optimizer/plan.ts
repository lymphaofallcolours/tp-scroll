import type { Trip } from "../trips/trip.js";

export type TripPlan = {
  readonly trips: ReadonlyArray<Trip>;
  readonly leaveCostTotal: number;
  readonly awayDaysTotal: number;
  readonly anchorCoverage: number;
  readonly tripCount: number;
  /**
   * Sum of outbound + inbound priceMinor across the plan's trips. Only set
   * when the optimizer was given a flightInfo lookup AND the lookup had
   * pricing for each trip. Optional so price-naive runs keep their tight
   * 4-field shape.
   */
  readonly priceTotalMinor?: number;
};
