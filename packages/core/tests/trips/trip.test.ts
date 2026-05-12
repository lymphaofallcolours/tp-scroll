import { describe, it, expect } from "vitest";

import { TripSchema, DayAttributionSchema } from "../../src/trips/trip.js";

const valid = {
  id: "trip-1",
  departure: 9500,
  return: 9510,
  bucketId: "annual",
  isActual: false,
  dayOverrides: [],
};

describe("TripSchema", () => {
  it("accepts a minimally valid planned trip", () => {
    expect(() => TripSchema.parse(valid)).not.toThrow();
  });

  it("rejects a trip whose return is before departure", () => {
    expect(() => TripSchema.parse({ ...valid, departure: 9510, return: 9500 })).toThrow();
  });

  it("accepts an isActual trip", () => {
    expect(() => TripSchema.parse({ ...valid, isActual: true })).not.toThrow();
  });

  it("accepts a sparse dayOverrides array", () => {
    const trip = {
      ...valid,
      dayOverrides: [
        { day: 9500, isTravelDay: true, consumesLeave: false },
        { day: 9510, isTravelDay: true, consumesLeave: true },
      ],
    };
    expect(() => TripSchema.parse(trip)).not.toThrow();
  });

  it("rejects dayOverrides whose day falls outside the trip range", () => {
    const trip = { ...valid, dayOverrides: [{ day: 12345, consumesLeave: true }] };
    expect(() => TripSchema.parse(trip)).toThrow();
  });

  it("rejects duplicate days in dayOverrides", () => {
    const trip = {
      ...valid,
      dayOverrides: [
        { day: 9500, consumesLeave: false },
        { day: 9500, isTravelDay: true },
      ],
    };
    expect(() => TripSchema.parse(trip)).toThrow();
  });
});

describe("DayAttributionSchema", () => {
  it("accepts an entry with only a day", () => {
    expect(() => DayAttributionSchema.parse({ day: 9500 })).not.toThrow();
  });

  it("accepts all three flags set", () => {
    const a = { day: 9500, consumesLeave: true, isTravelDay: true, location: "transit" as const };
    expect(() => DayAttributionSchema.parse(a)).not.toThrow();
  });

  it("rejects unknown location values", () => {
    expect(() =>
      DayAttributionSchema.parse({ day: 9500, location: "somewhere" }),
    ).toThrow();
  });
});
