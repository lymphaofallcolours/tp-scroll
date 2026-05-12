import { describe, it, expect } from "vitest";

import { FixedClock } from "../../src/calendar/clock.js";

describe("Clock", () => {
  it("FixedClock returns the day it was constructed with", () => {
    const clock = FixedClock(9_500);
    expect(clock.today()).toBe(9_500);
  });

  it("FixedClock returns the same value on repeated calls", () => {
    const clock = FixedClock(42);
    expect(clock.today()).toBe(42);
    expect(clock.today()).toBe(42);
    expect(clock.today()).toBe(42);
  });
});
