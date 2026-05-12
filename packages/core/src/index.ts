export {
  type DayInt,
  EPOCH,
  toDayInt,
  fromDayInt,
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
  SCHENGEN_ISO2,
  isSchengen,
  evaluateSchengenWindow,
  respectsBookingHorizon,
} from "./constraints/index.js";

export {
  type Session,
  SessionSchema,
  type DepartureMode,
  DepartureModeSchema,
  ExtraHolidaySchema,
  OverriddenHolidaySchema,
  type SessionSeed,
  defaultSession,
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
} from "./optimizer/index.js";
