import { useEffect, useMemo, useState } from "react";

import {
  FixedClock,
  isoFromDayInt,
  optimize,
  scorePlan,
  type TripPlan,
} from "@tp-scroll/core";
import type { AnnotatedTripPlan } from "@tp-scroll/adapter-flights";

import { bridge } from "../../api/bridge.js";
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
            <span className={styles.controlLabel}>top</span>
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
          </label>
          <label className={styles.checkboxControl} title={flightProviderName ?? ""}>
            <input
              type="checkbox"
              checked={fetchFlights}
              onChange={(e) => setFetchFlights(e.target.checked)}
            />
            flights {isMockFlights ? "(mock)" : ""}
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
            {state.plans.length === 0 ? (
              <div className={styles.emptyPlans}>
                No feasible plans within your budget.
              </div>
            ) : (
              state.plans.map((plan, i) => (
                <PlanCard
                  key={i}
                  plan={plan}
                  rank={i + 1}
                  annotated={annotated?.[i] ?? null}
                  isMockFlights={isMockFlights}
                />
              ))
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
