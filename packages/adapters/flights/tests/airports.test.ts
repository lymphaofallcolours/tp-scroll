import { describe, expect, it } from "vitest";

import { DEFAULT_AIRPORTS, resolveIata } from "../src/airports.js";

describe("resolveIata", () => {
  it("passes IATA codes through", () => {
    expect(resolveIata("BER")).toBe("BER");
    expect(resolveIata("ber")).toBe("BER");
  });

  it("maps ISO-2 country codes via DEFAULT_AIRPORTS", () => {
    expect(resolveIata("DE")).toBe(DEFAULT_AIRPORTS["DE"]);
    expect(resolveIata("es")).toBe("MAD");
  });

  it("returns null for unknown shapes", () => {
    expect(resolveIata("12")).toBeNull();
    expect(resolveIata("XX")).toBeNull(); // not in mapping
  });
});
