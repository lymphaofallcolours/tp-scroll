export {
  type DayInt,
  EPOCH,
  toDayInt,
  fromDayInt,
  dayIntFromIso,
  isoFromDayInt,
} from "./calendar/day-int.js";

export {
  type WeekendDay,
  weekendDaysFor,
  isWeekend,
} from "./calendar/weekend.js";

export {
  type DayRange,
  daysIn,
  overlaps,
  intersect,
  iterate,
} from "./calendar/range.js";

export { type Clock, FixedClock, SystemClock } from "./calendar/clock.js";

export { type Logger, type LogContext, NoopLogger } from "./logger.js";

export {
  type LeaveCycle,
  LeaveCycleSchema,
  type LeaveBucket,
  LeaveBucketSchema,
  type Balance,
  type BalanceArgs,
  computeBalance,
  type BucketBalance,
  computeBucketBalances,
} from "./leave/index.js";

export {
  type DayAttribution,
  DayAttributionSchema,
  type Trip,
  TripSchema,
  type ResolvedAttribution,
  resolveAttribution,
  type TripCost,
  computeTripCost,
} from "./trips/index.js";

export {
  type BlockedPeriod,
  BlockedPeriodSchema,
  tripOverlapsBlocked,
  type AnchorDate,
  AnchorDateSchema,
  type IsAtHome,
  anchorSatisfied,
  anchorCoverageScore,
  type SchengenWatch,
  SchengenWatchSchema,
  type SchengenInput,
  type SchengenResult,
  type SchengenLoadInput,
  SCHENGEN_ISO2,
  isSchengen,
  evaluateSchengenWindow,
  currentSchengenLoad,
  respectsBookingHorizon,
  type LegInfo,
  type CandidateFlightInfo,
  type FlightConstraints,
  FlightConstraintsSchema,
  passesFlightConstraints,
} from "./constraints/index.js";

export {
  type Session,
  SessionSchema,
  type DepartureMode,
  DepartureModeSchema,
  type HistoricalCycle,
  HistoricalCycleSchema,
  ExtraHolidaySchema,
  OverriddenHolidaySchema,
  type SessionSeed,
  defaultSession,
  rollCycle,
  carryoverFromHistory,
} from "./session/index.js";

export {
  type TripPlan,
  type PlanScore,
  scorePlan,
  compareScores,
  type Candidate,
  generateCandidates,
  type SearchOptions,
  searchTopK,
  type OptimizeOptions,
  optimize,
  planSimilarity,
} from "./optimizer/index.js";
