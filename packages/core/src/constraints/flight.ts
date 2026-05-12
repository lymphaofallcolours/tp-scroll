import { z } from "zod";

/**
 * Pure-data projection of a flight leg. Lives in core so the optimizer can
 * reason about flights without depending on @tp-scroll/adapter-flights. The
 * adapter package provides the `legInfoOf(quote)` helper that builds one of
 * these from its FlightQuote shape.
 */
export type LegInfo = {
  readonly priceMinor: number;
  readonly currency: string;
  readonly durationMinutes: number;
  readonly departHour: number;
  readonly arriveHour: number;
};

export type CandidateFlightInfo = {
  readonly outbound?: LegInfo;
  readonly inbound?: LegInfo;
};

const HourSchema = z.number().int().min(0).max(23);

export const FlightConstraintsSchema = z
  .object({
    maxDurationMinutes: z.number().int().positive().optional(),
    departAfterHour: HourSchema.optional(),
    arriveBeforeHour: HourSchema.optional(),
    combineMode: z.enum(["and", "or"]).optional(),
  })
  .refine(
    (c) =>
      c.maxDurationMinutes !== undefined ||
      c.departAfterHour !== undefined ||
      c.arriveBeforeHour !== undefined,
    {
      message: "flightConstraints must specify at least one constraint",
    },
  );

export type FlightConstraints = z.infer<typeof FlightConstraintsSchema>;

type ConstraintCheck = (info: CandidateFlightInfo) => boolean;

const checkMaxDuration =
  (max: number): ConstraintCheck =>
  (info) => {
    if (info.outbound !== undefined && info.outbound.durationMinutes > max) return false;
    if (info.inbound !== undefined && info.inbound.durationMinutes > max) return false;
    return true;
  };

const checkDepartAfter =
  (hour: number): ConstraintCheck =>
  (info) => {
    if (info.outbound !== undefined && info.outbound.departHour < hour) return false;
    if (info.inbound !== undefined && info.inbound.departHour < hour) return false;
    return true;
  };

const checkArriveBefore =
  (hour: number): ConstraintCheck =>
  (info) => {
    if (info.outbound !== undefined && info.outbound.arriveHour >= hour) return false;
    if (info.inbound !== undefined && info.inbound.arriveHour >= hour) return false;
    return true;
  };

/**
 * True if the candidate's flight info satisfies the constraints under the
 * chosen combineMode. Missing leg data is conservatively treated as "passes"
 * — a constraint can only DISQUALIFY a candidate when the upstream gave us
 * enough data to fail it.
 *
 * combineMode "and" (default): every SET constraint must pass.
 * combineMode "or": at least one set constraint must pass. If no constraints
 * are set, returns true (nothing to satisfy).
 */
export const passesFlightConstraints = (
  info: CandidateFlightInfo,
  constraints: FlightConstraints,
): boolean => {
  const checks: ConstraintCheck[] = [];
  if (constraints.maxDurationMinutes !== undefined) {
    checks.push(checkMaxDuration(constraints.maxDurationMinutes));
  }
  if (constraints.departAfterHour !== undefined) {
    checks.push(checkDepartAfter(constraints.departAfterHour));
  }
  if (constraints.arriveBeforeHour !== undefined) {
    checks.push(checkArriveBefore(constraints.arriveBeforeHour));
  }
  if (checks.length === 0) return true;

  if ((constraints.combineMode ?? "and") === "or") {
    return checks.some((c) => c(info));
  }
  return checks.every((c) => c(info));
};
