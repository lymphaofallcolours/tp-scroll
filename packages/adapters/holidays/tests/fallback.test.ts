import { describe, it, expect, vi } from "vitest";

import { FallbackHolidayProvider } from "../src/fallback.js";
import type { Holiday, HolidayProvider } from "../src/provider.js";

const makeProvider = (
  name: string,
  fn: (cc: string, y: number) => Promise<Holiday[]>,
): HolidayProvider => ({ name, forCountry: fn });

describe("FallbackHolidayProvider", () => {
  it("returns the primary's result when it succeeds", async () => {
    const primary = makeProvider("primary", async () => [
      { day: 9497, name: "P", type: "public" },
    ]);
    const fb = makeProvider("fb", async () => [{ day: 9498, name: "F", type: "public" }]);
    const provider = new FallbackHolidayProvider(primary, fb);
    const r = await provider.forCountry("DE", 2026);
    expect(r).toEqual([{ day: 9497, name: "P", type: "public" }]);
  });

  it("falls back when the primary throws", async () => {
    const primary = makeProvider("primary", async () => {
      throw new Error("boom");
    });
    const fb = makeProvider("fb", async () => [{ day: 9498, name: "F", type: "public" }]);
    const provider = new FallbackHolidayProvider(primary, fb);
    const r = await provider.forCountry("DE", 2026);
    expect(r[0]?.name).toBe("F");
  });

  it("caches per (country, year) and avoids re-calling either provider", async () => {
    const primaryFn = vi.fn(async () => [{ day: 9497, name: "P", type: "public" as const }]);
    const fbFn = vi.fn(async () => []);
    const provider = new FallbackHolidayProvider(
      { name: "primary", forCountry: primaryFn },
      { name: "fb", forCountry: fbFn },
    );

    await provider.forCountry("DE", 2026);
    await provider.forCountry("DE", 2026);
    await provider.forCountry("de", 2026); // case-insensitive

    expect(primaryFn).toHaveBeenCalledTimes(1);
    expect(fbFn).not.toHaveBeenCalled();
  });

  it("cache is keyed by (country, year): different year triggers a fresh primary call", async () => {
    const primaryFn = vi.fn(async () => [{ day: 9497, name: "P", type: "public" as const }]);
    const provider = new FallbackHolidayProvider(
      { name: "primary", forCountry: primaryFn },
      { name: "fb", forCountry: async () => [] },
    );
    await provider.forCountry("DE", 2026);
    await provider.forCountry("DE", 2027);
    expect(primaryFn).toHaveBeenCalledTimes(2);
  });

  it("caches the fallback result too when primary fails", async () => {
    const primaryFn = vi.fn(async () => {
      throw new Error("boom");
    });
    const fbFn = vi.fn(async () => [{ day: 9497, name: "F", type: "public" as const }]);
    const provider = new FallbackHolidayProvider(
      { name: "primary", forCountry: primaryFn },
      { name: "fb", forCountry: fbFn },
    );
    await provider.forCountry("DE", 2026);
    await provider.forCountry("DE", 2026);
    expect(primaryFn).toHaveBeenCalledTimes(1); // first call only
    expect(fbFn).toHaveBeenCalledTimes(1);
  });
});
