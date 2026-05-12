import { z } from "zod";

export const SchengenWatchSchema = z.object({
  enabled: z.boolean(),
  windowDays: z.literal(180),
  maxDaysInWindow: z.literal(90),
});

export type SchengenWatch = z.infer<typeof SchengenWatchSchema>;

// Source: EU Schengen Area membership as of 2026-05. Croatia joined fully in
// 2023; Romania + Bulgaria full land-border accession 2025-01. Switzerland,
// Norway, Iceland, Liechtenstein are non-EU Schengen members.
// Review: re-confirm annually.
export const SCHENGEN_ISO2: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT",
  "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH",
]);

export const isSchengen = (countryCode: string): boolean =>
  SCHENGEN_ISO2.has(countryCode.toUpperCase());
