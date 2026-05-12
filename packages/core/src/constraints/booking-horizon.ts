import { type Clock } from "../calendar/clock.js";
import { type LeaveCycle } from "../leave/cycle.js";
import { type Trip } from "../trips/trip.js";

export const respectsBookingHorizon = (trip: Trip, cycle: LeaveCycle, clock: Clock): boolean => {
  if (trip.isActual) return true;
  if (cycle.bookingHorizonDays === undefined) return true;
  return trip.departure >= clock.today() + cycle.bookingHorizonDays;
};
