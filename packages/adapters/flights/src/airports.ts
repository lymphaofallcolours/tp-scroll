/**
 * Minimal ISO-3166-1 alpha-2 → IATA primary-airport mapping. Covers common
 * residence/home pairs for the v1.5 demo. Users will be able to override per
 * session in a v2.0 schema extension. NOT intended to be comprehensive.
 */
export const DEFAULT_AIRPORTS: Readonly<Record<string, string>> = {
  AT: "VIE",
  BE: "BRU",
  CA: "YYZ",
  CH: "ZRH",
  CN: "PEK",
  CZ: "PRG",
  DE: "BER",
  DK: "CPH",
  ES: "MAD",
  FI: "HEL",
  FR: "CDG",
  GB: "LHR",
  GR: "ATH",
  HR: "ZAG",
  HU: "BUD",
  IE: "DUB",
  IL: "TLV",
  IS: "KEF",
  IT: "FCO",
  JP: "HND",
  MX: "MEX",
  NL: "AMS",
  NO: "OSL",
  PL: "WAW",
  PT: "LIS",
  RO: "OTP",
  SE: "ARN",
  TR: "IST",
  US: "JFK",
};

const isIata = (s: string): boolean => /^[A-Z]{3}$/.test(s);
const isIso2 = (s: string): boolean => /^[A-Z]{2}$/.test(s);

/** Best-effort resolution of a 2-letter ISO country code OR a 3-letter IATA. */
export const resolveIata = (code: string): string | null => {
  const up = code.toUpperCase();
  if (isIata(up)) return up;
  if (isIso2(up)) return DEFAULT_AIRPORTS[up] ?? null;
  return null;
};
