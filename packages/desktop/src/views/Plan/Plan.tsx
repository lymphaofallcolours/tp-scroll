import { useEffect, useMemo, useState } from "react";

import {
  FixedClock,
  compareScores,
  isoFromDayInt,
  optimize,
  passesFlightConstraints,
  scorePlan,
  type CandidateFlightInfo,
  type TripPlan,
} from "@tp-scroll/core";
import { legInfoOf, type AnnotatedTripPlan } from "@tp-scroll/adapter-flights";

import { bridge } from "../../api/bridge.js";
import { Hint } from "../../components/Hint.js";
import { useSessionStore } from "../../state/session.js";
import styles from "./Plan.module.css";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; plans: ReadonlyArray<TripPlan>; durationMs: number }
  | { kind: "error"; message: string };

type FlightFetchState = "idle" | "fetching" | "done" | "error";

export const Plan = (): JSX.Element | null => {
  const session = useSessionStore((s) => s.session);
  const holidays = useSessionStore((s) => s.holidays);

  const [topK, setTopK] = useState(5);
  const [diverse, setDiverse] = useState(true);
  const [fetchFlights, setFetchFlights] = useState(false);
  const [priceAware, setPriceAware] = useState(false);
  const [state, setState] = useState<RunState>({ kind: "idle" });
  const [annotated, setAnnotated] = useState<ReadonlyArray<AnnotatedTripPlan> | null>(null);
  const [flightState, setFlightState] = useState<FlightFetchState>("idle");
  const [flightProviderName, setFlightProviderName] = useState<string | null>(null);

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.day)), [holidays]);

  useEffect(() => {
    void bridge.flights.providerName().then((n) => setFlightProviderName(n)).catch(() => undefined);
  }, []);

  if (!session) return null;

  const run = (): void => {
    setState({ kind: "running" });
    setAnnotated(null);
    setFlightState("idle");
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const plans = optimize(session, {
          clock: FixedClock(session.cycle.start),
          holidays: holidaySet,
          topK,
          seedCount: diverse ? 5 : 1,
        });
        const t1 = performance.now();
        setState({ kind: "done", plans, durationMs: t1 - t0 });

        if (fetchFlights && plans.length > 0) {
          void runFlightFetch(plans);
        }
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }, 30);
  };

  const runFlightFetch = async (plans: ReadonlyArray<TripPlan>): Promise<void> => {
    setFlightState("fetching");
    try {
      const out: AnnotatedTripPlan[] = [];
      for (const plan of plans) {
        const a = await bridge.flights.annotate({
          plan,
          origin: session.residenceCountry,
          destination: session.homeCountry,
        });
        out.push(a);
      }
      setAnnotated(out);
      setFlightState("done");
    } catch {
      setFlightState("error");
    }
  };

  // v1.7 post-processing applied AFTER plans + annotations are both available.
  // The optimizer's full flight-aware path (engine-side) requires pre-fetching
  // flight info for every candidate, which is fine on the mock provider but
  // would burn through Amadeus rate limits. The renderer instead applies the
  // same constraint check + price tiebreaker over the existing top-K so the
  // visible behavior matches without the bandwidth cost.
  const displayedPlans = useMemo(() => {
    if (state.kind !== "done") return [] as ReadonlyArray<TripPlan>;
    let plans = state.plans;
    if (annotated && session.flightConstraints) {
      const constraints = session.flightConstraints;
      plans = plans.filter((_, i) => {
        const a = annotated[i];
        if (!a) return true;
        return a.annotations.every((leg) => {
          const out = leg.outbound ? legInfoOf(leg.outbound) : undefined;
          const inb = leg.inbound ? legInfoOf(leg.inbound) : undefined;
          const info: CandidateFlightInfo = {
            ...(out !== undefined ? { outbound: out } : {}),
            ...(inb !== undefined ? { inbound: inb } : {}),
          };
          return passesFlightConstraints(info, constraints);
        });
      });
    }
    if (annotated && priceAware) {
      const totals = new Map<TripPlan, number>();
      for (let i = 0; i < state.plans.length; i++) {
        totals.set(state.plans[i]!, annotated[i]?.totalPriceMinor ?? Number.MAX_SAFE_INTEGER);
      }
      plans = [...plans].sort((a, b) => {
        const cmp = compareScores(scorePlan(a), scorePlan(b));
        if (cmp !== 0) return cmp;
        return (totals.get(a) ?? 0) - (totals.get(b) ?? 0);
      });
    }
    return plans;
  }, [state, annotated, session.flightConstraints, priceAware]);

  const isMockFlights = (flightProviderName ?? "").includes("mock");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>tp-scroll · planning room</span>
          <h1 className={styles.title}>Where else could the year go?</h1>
        </div>
        <div className={styles.controls}>
          <div className={styles.controlField}>
            <span className={styles.controlLabel}>
              top
              <Hint text="How many ranked plans to show. The optimizer always finds many candidates; this caps the display." />
            </span>
            <input
              type="number"
              className={styles.controlInput}
              min={1}
              max={12}
              value={topK}
              onChange={(e) => setTopK(Math.max(1, Math.min(12, Number(e.target.value))))}
            />
          </div>
          <label className={styles.checkboxControl}>
            <input
              type="checkbox"
              checked={diverse}
              onChange={(e) => setDiverse(e.target.checked)}
            />
            diverse
            <Hint text="Splits the year into 5 segments and runs the search once per segment, then merges. Without it, the top plans tend to cluster around the same dates; with it, you'll see one plan starting roughly per quarter." />
          </label>
          <label className={styles.checkboxControl}>
            <input
              type="checkbox"
              checked={fetchFlights}
              onChange={(e) => setFetchFlights(e.target.checked)}
            />
            flights {isMockFlights ? "(mock)" : ""}
            <Hint
              text={
                isMockFlights
                  ? "Showing mock prices. To enable real prices, register a free Amadeus Self-Service account and set TP_SCROLL_AMADEUS_CLIENT_ID + _CLIENT_SECRET before launching, or use the Settings card on the Sessions tab."
                  : "Fetches the cheapest direct flight for each trip's outbound and return legs from Amadeus."
              }
            />
          </label>
          <label className={styles.checkboxControl}>
            <input
              type="checkbox"
              checked={priceAware}
              disabled={!fetchFlights}
              onChange={(e) => setPriceAware(e.target.checked)}
            />
            price-aware
            <Hint text="Re-ranks the top plans so cheaper flight totals win among plans tied on home days / leverage / anchors / trip count. Also drops plans whose flights violate the flight constraints (configurable on the Sessions tab)." />
          </label>
          <button
            type="button"
            className={styles.runBtn}
            disabled={state.kind === "running"}
            onClick={run}
          >
            {state.kind === "running" ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                running
              </>
            ) : (
              "Run optimization"
            )}
          </button>
        </div>
      </header>

      {state.kind === "idle" && (
        <div className={styles.intro}>
          The optimizer keeps your weekends and holidays free of charge —<br />
          pick a count, decide if you want variety, and press Run.
          <div
            style={{
              marginTop: "var(--space-5)",
              fontStyle: "normal",
              fontSize: "var(--type-small)",
              fontFamily: "var(--font-mono)",
              color: "var(--ink-tertiary)",
              maxWidth: 540,
              marginLeft: "auto",
              marginRight: "auto",
              textAlign: "left",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "var(--ink-secondary)" }}>Plans are ranked, in order:</strong>
            <br />
            1. most home-days · 2. best leverage (home days per leave day) ·{" "}
            3. anchor-date coverage · 4. trip count {priceAware ? "· 5. lowest flight cost" : ""}
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className={styles.intro} style={{ color: "var(--accent-blocked)" }}>
          {state.message}
        </div>
      )}

      {state.kind === "done" && (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>Plans</span>
              <span className={styles.summaryValue}>
                {state.plans.length} returned, top {topK} requested
              </span>
            </div>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>Mode</span>
              <span className={styles.summaryValue}>
                {diverse ? "multi-seed (5 segments)" : "single search"}
              </span>
            </div>
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>Time</span>
              <span className={styles.summaryValue}>
                {state.durationMs.toFixed(0)} ms
                {flightState === "fetching" && (
                  <span style={{ marginLeft: 8, color: "var(--ink-tertiary)" }}>
                    · flights…
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className={styles.plans}>
            {displayedPlans.length === 0 ? (
              <div className={styles.emptyPlans}>
                {state.plans.length === 0
                  ? "No feasible plans within your budget."
                  : "No plans satisfy the active flight constraints."}
              </div>
            ) : (
              displayedPlans.map((plan, i) => {
                const originalIdx = state.plans.indexOf(plan);
                return (
                  <PlanCard
                    key={i}
                    plan={plan}
                    rank={i + 1}
                    annotated={originalIdx >= 0 ? annotated?.[originalIdx] ?? null : null}
                    isMockFlights={isMockFlights}
                  />
                );
              })
            )}
          </div>
        </>
      )}
    </main>
  );
};

const PlanCard = ({
  plan,
  rank,
  annotated,
  isMockFlights,
}: {
  plan: TripPlan;
  rank: number;
  annotated: AnnotatedTripPlan | null;
  isMockFlights: boolean;
}): JSX.Element => {
  const score = scorePlan(plan);
  const leverage = score[1] === Number.POSITIVE_INFINITY ? "∞" : (score[1] / 10000).toFixed(2);
  // Pair each trip with its annotation by original index (the annotation array
  // is built in plan.trips order before we sorted below).
  const indexed = plan.trips.map((trip, i) => ({ trip, annotation: annotated?.annotations[i] ?? null }));
  const sorted = [...indexed].sort((a, b) => a.trip.departure - b.trip.departure);

  return (
    <article className={styles.plan}>
      <div>
        <span className={styles.rankPrefix}>rank</span>
        <div className={styles.rank}>#{rank}</div>
      </div>
      <div className={styles.planContent}>
        <div className={styles.scoreRow}>
          <div className={styles.scoreChip}>
            <span className={styles.scoreLabel}>home days</span>
            <span className={`${styles.scoreValue} ${styles.scoreValuePrimary}`}>
              {plan.awayDaysTotal}
            </span>
          </div>
          <div className={styles.scoreChip}>
            <span className={styles.scoreLabel}>leverage</span>
            <span className={styles.scoreValue}>{leverage}</span>
          </div>
          <div className={styles.scoreChip}>
            <span className={styles.scoreLabel}>anchors</span>
            <span className={styles.scoreValue}>{plan.anchorCoverage}</span>
          </div>
          <div className={styles.scoreChip}>
            <span className={styles.scoreLabel}>trips</span>
            <span className={styles.scoreValue}>{plan.tripCount}</span>
          </div>
          <div className={styles.scoreChip}>
            <span className={styles.scoreLabel}>leave used</span>
            <span className={styles.scoreValue}>{plan.leaveCostTotal}</span>
          </div>
          {annotated && annotated.totalPriceMinor !== null && (
            <div className={styles.scoreChip}>
              <span className={styles.scoreLabel}>
                flights {isMockFlights ? "(mock)" : ""}
              </span>
              <span className={styles.scoreValue}>
                {(annotated.totalPriceMinor / 100).toFixed(0)} {annotated.currency ?? ""}
              </span>
            </div>
          )}
        </div>
        <div className={styles.tripList}>
          {sorted.length === 0 ? (
            <span style={{ color: "var(--ink-faint)" }}>— no trips, stay home —</span>
          ) : (
            sorted.map(({ trip, annotation }, i) => {
              const days = trip.return - trip.departure + 1;
              return (
                <div key={i} className={styles.tripLine}>
                  <span className={styles.tripDot} />
                  <span className={styles.tripDates}>
                    {isoFromDayInt(trip.departure)} → {isoFromDayInt(trip.return)}
                  </span>
                  <span className={styles.tripMeta}>
                    {String(days).padStart(2, "0")}d
                    {annotation && annotation.outbound !== null && annotation.inbound !== null && (
                      <>
                        {" · "}
                        {((annotation.outbound.priceMinor + annotation.inbound.priceMinor) / 100).toFixed(
                          0,
                        )}
                        {" "}
                        {annotation.outbound.currency}
                      </>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </article>
  );
};
