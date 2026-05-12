import { describe, it, expect } from "vitest";

import { type BlockedPeriod, tripOverlapsBlocked } from "../../src/constraints/blocked.js";
import { makeTrip } from "../fixtures/sessions.js";

const block = (start: number, end: number, reason = "x"): BlockedPeriod => ({ start, end, reason });

describe("tripOverlapsBlocked", () => {
  it("returns true when the trip's interior touches the block", () => {
    expect(tripOverlapsBlocked(makeTrip({ departure: 100, return: 110 }), block(105, 108))).toBe(
      true,
    );
  });

  it("returns true when departure equals block end", () => {
    expect(tripOverlapsBlocked(makeTrip({ departure: 108, return: 115 }), block(100, 108))).toBe(
      true,
    );
  });

  it("returns false when the block ends one day before departure", () => {
    expect(tripOverlapsBlocked(makeTrip({ departure: 109, return: 115 }), block(100, 108))).toBe(
      false,
    );
  });

  it("returns false when the block starts one day after return", () => {
    expect(tripOverlapsBlocked(makeTrip({ departure: 100, return: 110 }), block(111, 120))).toBe(
      false,
    );
  });

  it("returns true when the block fully contains the trip", () => {
    expect(tripOverlapsBlocked(makeTrip({ departure: 100, return: 110 }), block(50, 200))).toBe(
      true,
    );
  });
});
