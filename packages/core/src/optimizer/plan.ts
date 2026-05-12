import type { Trip } from "../trips/trip.js";

export type TripPlan = {
  readonly trips: ReadonlyArray<Trip>;
  readonly leaveCostTotal: number;
  readonly awayDaysTotal: number;
  readonly anchorCoverage: number;
  readonly tripCount: number;
};
