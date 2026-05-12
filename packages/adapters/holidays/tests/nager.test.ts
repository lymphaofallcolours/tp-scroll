import { describe, it, expect, vi } from "vitest";

import { NagerHolidayProvider } from "../src/nager.js";
import { canned2026DE_nagerResponse } from "./fixtures/nager-fixture.js";

const mockOk = (body: unknown) =>
  vi.fn(async () =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
  );

const mockStatus = (status: number) =>
  vi.fn(async () => new Response("nope", { status }));

describe("NagerHolidayProvider", () => {
  it("builds the correct URL for a country/year", async () => {
    const fetchFn = mockOk(canned2026DE_nagerResponse);
    const provider = new NagerHolidayProvider({ fetch: fetchFn });
    await provider.forCountry("DE", 2026);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://date.nager.at/api/v3/PublicHolidays/2026/DE",
      expect.any(Object),
    );
  });

  it("uppercases the country code in the URL", async () => {
    const fetchFn = mockOk(canned2026DE_nagerResponse);
    const provider = new NagerHolidayProvider({ fetch: fetchFn });
    await provider.forCountry("de", 2026);
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining("/DE"),
      expect.any(Object),
    );
  });

  it("classifies items with non-empty counties as regional", async () => {
    const provider = new NagerHolidayProvider({ fetch: mockOk(canned2026DE_nagerResponse) });
    const result = await provider.forCountry("DE", 2026);
    const allSaints = result.find((h) => h.name === "All Saints' Day");
    expect(allSaints?.type).toBe("regional");
    expect(allSaints?.region).toBe("DE-BY");
  });

  it("classifies global items as public", async () => {
    const provider = new NagerHolidayProvider({ fetch: mockOk(canned2026DE_nagerResponse) });
    const result = await provider.forCountry("DE", 2026);
    const newYear = result.find((h) => h.name === "New Year's Day");
    expect(newYear?.type).toBe("public");
  });

  it("throws when the response is not OK", async () => {
    const provider = new NagerHolidayProvider({ fetch: mockStatus(503) });
    await expect(provider.forCountry("DE", 2026)).rejects.toThrow(/503/);
  });

  it("throws when the JSON does not match the schema", async () => {
    const provider = new NagerHolidayProvider({ fetch: mockOk({ not: "an array" }) });
    await expect(provider.forCountry("DE", 2026)).rejects.toThrow();
  });
});
