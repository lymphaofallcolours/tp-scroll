import { useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  FixedClock,
  isoFromDayInt,
  optimize,
  type TripPlan,
} from "@tp-scroll/core";

import { useSessionStore } from "../../state/session.js";

import {
  buildAnchorRows,
  buildBucketSlices,
  buildBurndown,
  buildLeverageStats,
  buildMonthlyDistribution,
  buildSchengenSnapshot,
  buildTripLengthHistogram,
} from "./insights-data.js";
import styles from "./Insights.module.css";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

// Computed tokens consumed by Chart.js — keep in sync with tokens.css.
// Chart.js paints to canvas and doesn't resolve CSS custom properties, so we
// duplicate the palette here in hex form rather than passing `var(--…)` refs.
const TOKENS = {
  ink: "#1a2433",
  inkTertiary: "#6b7488",
  inkFaint: "#aaa794",
  edge: "#d4c8ad",
  sage: "#7a8e62",
  sageSoft: "#c4cdb1",
  teal: "#4f7c84",
  amber: "#b08440",
  brick: "#9d5145",
  red: "#a85333",
  surface: "#f4ede0",
  card: "#f8f3e9",
  sunk: "#ece2cc",
};

const BUCKET_KIND_COLORS: Record<string, { main: string; soft: string }> = {
  annual: { main: "#7a8e62", soft: "#c4cdb1" },
  sick: { main: "#8a6a8d", soft: "#cdbbcd" },
  parental: { main: "#4f7c84", soft: "#b7cfd2" },
  conference: { main: "#9d5145", soft: "#d8b9af" },
  other: { main: "#88837a", soft: "#c8c4bc" },
};

const FONT_MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace";

const tooltipStyle = {
  backgroundColor: TOKENS.ink,
  titleColor: TOKENS.surface,
  bodyColor: TOKENS.surface,
  titleFont: { family: FONT_MONO, size: 11, weight: 400 as const },
  bodyFont: { family: FONT_MONO, size: 12 },
  padding: 10,
  borderWidth: 0,
  cornerRadius: 2,
  displayColors: true,
};

export const Insights = (): JSX.Element | null => {
  const session = useSessionStore((s) => s.session);
  const holidays = useSessionStore((s) => s.holidays);
  // "today" for Schengen tracking. Falls back to today's date if the cycle is
  // future-dated (so the counter never reports phantom days outside).
  const todayDayInt = useMemo(() => {
    if (!session) return 0;
    const now = new Date();
    const iso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    const epoch = new Date(Date.UTC(2000, 0, 1));
    const millis = new Date(iso + "T00:00:00Z").getTime() - epoch.getTime();
    const today = Math.floor(millis / 86_400_000);
    return Math.min(Math.max(today, session.cycle.start), session.cycle.end);
  }, [session]);

  const burndown = useMemo(
    () => (session ? buildBurndown(session, holidays) : null),
    [session, holidays],
  );
  const buckets = useMemo(
    () => (session ? buildBucketSlices(session, holidays) : []),
    [session, holidays],
  );
  const anchors = useMemo(
    () => (session ? buildAnchorRows(session, holidays) : []),
    [session, holidays],
  );
  const histogram = useMemo(
    () => (session ? buildTripLengthHistogram(session) : []),
    [session],
  );
  const leverage = useMemo(
    () =>
      session
        ? buildLeverageStats(session, holidays)
        : { leaveDays: 0, awayDays: 0, freeDays: 0, leveragePct: 0 },
    [session, holidays],
  );
  const monthly = useMemo(
    () => (session ? buildMonthlyDistribution(session, holidays) : []),
    [session, holidays],
  );
  const schengen = useMemo(
    () => (session ? buildSchengenSnapshot(session, todayDayInt) : null),
    [session, todayDayInt],
  );

  if (!session || !burndown) return null;

  const actualToDate = burndown.actuals[burndown.actuals.length - 1] ?? 0;
  const projectedTotal = burndown.projected[burndown.projected.length - 1] ?? 0;
  const remaining = burndown.budget - actualToDate;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>tp-scroll · insights</span>
          <h1 className={styles.title}>The year, examined from several angles.</h1>
        </div>
        <div className={styles.statRow}>
          <div>
            consumed
            <span className={styles.statValue}>{actualToDate}</span>
          </div>
          <div>
            projected
            <span className={styles.statValue}>{projectedTotal}</span>
          </div>
          <div>
            remaining
            <span className={styles.statValue}>{remaining}</span>
          </div>
        </div>
      </header>

      <BurndownPanel burndown={burndown} projectedTotal={projectedTotal} />

      <div className={styles.grid2}>
        <BucketDonutPanel buckets={buckets} />
        <LeveragePanel stats={leverage} />
      </div>

      <TripLengthPanel histogram={histogram} />

      <PlanVsActualPanel />

      <MonthlyDistributionPanel monthly={monthly} />

      {schengen && (
        <SchengenPanel
          snapshot={schengen}
          residenceCountry={session.residenceCountry}
          homeCountry={session.homeCountry}
        />
      )}

      <AnchorListPanel anchors={anchors} />

      <p className={styles.note}>
        Numbers update live as you add or edit trips. The burndown step lands on each trip's
        return day — that's when leave is "spent".
      </p>
    </main>
  );
};

const Panel = ({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}): JSX.Element => (
  <section className={`${styles.panel} ${className ?? ""}`}>
    <header className={styles.panelHeader}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {subtitle && <p className={styles.panelSubtitle}>{subtitle}</p>}
    </header>
    <div className={styles.panelBody}>{children}</div>
  </section>
);

const BurndownPanel = ({
  burndown,
  projectedTotal,
}: {
  burndown: ReturnType<typeof buildBurndown>;
  projectedTotal: number;
}): JSX.Element => {
  const chartData = {
    labels: burndown.labels.slice(),
    datasets: [
      {
        label: "Actual (recorded)",
        data: burndown.actuals.slice(),
        borderColor: TOKENS.sage,
        backgroundColor: `${TOKENS.sage}26`,
        borderWidth: 3,
        fill: true,
        tension: 0,
        stepped: "after" as const,
        pointRadius: 0,
        pointHitRadius: 8,
      },
      {
        label: "Projected (actual + planned)",
        data: burndown.projected.slice(),
        borderColor: TOKENS.teal,
        borderWidth: 2,
        borderDash: [8, 5],
        fill: false,
        tension: 0,
        stepped: "after" as const,
        pointRadius: 0,
        pointHitRadius: 8,
      },
      {
        label: `Budget (${burndown.budget})`,
        data: Array(burndown.labels.length).fill(burndown.budget),
        borderColor: TOKENS.red,
        borderWidth: 2,
        borderDash: [2, 3],
        fill: false,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: tooltipStyle,
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: TOKENS.edge },
        ticks: {
          color: TOKENS.inkTertiary,
          font: { family: FONT_MONO, size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
          callback(this: unknown, _val: unknown, index: number) {
            const label = burndown.labels[index];
            return label ? label.slice(5, 10) : "";
          },
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: Math.max(burndown.budget + 2, projectedTotal + 2),
        grid: { color: `${TOKENS.edge}66`, drawTicks: false },
        border: { display: false },
        ticks: {
          color: TOKENS.inkTertiary,
          font: { family: FONT_MONO, size: 10 },
          stepSize: 5,
          callback(this: unknown, val: unknown) {
            return `${val}d`;
          },
        },
      },
    },
    animation: { duration: 800, easing: "easeOutCubic" as const },
  };

  return (
    <Panel
      title="Burndown"
      subtitle="cumulative leave-days spent over the cycle · solid = actuals, dashed = projection"
    >
      <div className={styles.chartFrame}>
        <Line data={chartData} options={options} />
      </div>
      <div className={styles.miniLegend}>
        <span><span className={styles.lineSwatch} /> actual</span>
        <span><span className={`${styles.lineSwatch} ${styles.dashed}`} /> projected</span>
        <span><span className={`${styles.lineSwatch} ${styles.budget}`} /> budget</span>
      </div>
    </Panel>
  );
};

const BucketDonutPanel = ({
  buckets,
}: {
  buckets: ReadonlyArray<ReturnType<typeof buildBucketSlices>[number]>;
}): JSX.Element => {
  if (buckets.length === 0) {
    return (
      <Panel title="Buckets" subtitle="how leave is split">
        <div className={styles.emptyState}>No buckets yet.</div>
      </Panel>
    );
  }

  // Two concentric rings would have been ideal but chart.js doughnut datasets
  // share a label index; we use a single dataset and split each bucket into a
  // consumed slice (saturated) and a remaining slice (soft tint of the same
  // hue). The result reads as "filled = used, faint = left to spend."
  const labels: string[] = [];
  const values: number[] = [];
  const colors: string[] = [];
  for (const b of buckets) {
    const palette =
      BUCKET_KIND_COLORS[b.kind] ?? BUCKET_KIND_COLORS["annual"]!;
    if (b.consumed > 0) {
      labels.push(`${b.bucketName} consumed`);
      values.push(b.consumed);
      colors.push(palette.main);
    }
    if (b.remaining > 0) {
      labels.push(`${b.bucketName} remaining`);
      values.push(b.remaining);
      colors.push(palette.soft);
    }
  }

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: TOKENS.card,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          label: (ctx: { label: string; raw: unknown }) =>
            `${ctx.label}: ${ctx.raw as number}d`,
        },
      },
    },
    cutout: "62%",
  };

  return (
    <Panel title="Bucket allocation" subtitle="consumed (saturated) vs remaining (soft)">
      <div className={styles.donutFrame}>
        <Doughnut data={data} options={options} />
      </div>
      <ul className={styles.bucketList}>
        {buckets.map((b) => {
          const pct = b.total === 0 ? 0 : Math.round((b.consumed / b.total) * 100);
          const palette =
            BUCKET_KIND_COLORS[b.kind] ?? BUCKET_KIND_COLORS["annual"]!;
          return (
            <li key={b.bucketId} className={styles.bucketRow}>
              <span
                className={styles.bucketDot}
                style={{ background: palette.main }}
              />
              <span className={styles.bucketName}>{b.bucketName}</span>
              <span className={styles.bucketKindTag}>{b.kind}</span>
              <span className={styles.bucketCount}>
                {b.consumed}/{b.total}d · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

const LeveragePanel = ({
  stats,
}: {
  stats: ReturnType<typeof buildLeverageStats>;
}): JSX.Element => {
  const pct = stats.leveragePct;
  const RADIUS = 120;
  const CIRC = 2 * Math.PI * RADIUS;
  return (
    <Panel
      title="Weekend & holiday leverage"
      subtitle="share of away-days that don't consume leave"
    >
      <div className={styles.gaugeFrame}>
        <svg
          className={styles.gaugeSvg}
          viewBox="0 0 280 280"
          aria-hidden="true"
        >
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke={TOKENS.sunk}
            strokeWidth="18"
          />
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke={TOKENS.sage}
            strokeWidth="18"
            strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * 0.25}
            transform="rotate(-90 140 140)"
            strokeLinecap="round"
          />
        </svg>
        <div className={styles.gaugeCenter}>
          <div className={styles.gaugeValue}>{pct}%</div>
          <div className={styles.gaugeBreakdown}>
            <div>
              <span className={styles.gaugeNum}>{stats.freeDays}</span>
              <span className={styles.gaugeLabel}>free</span>
            </div>
            <div className={styles.gaugeSlash}>/</div>
            <div>
              <span className={styles.gaugeNum}>{stats.awayDays}</span>
              <span className={styles.gaugeLabel}>away</span>
            </div>
          </div>
          <div className={styles.gaugeSubtle}>{stats.leaveDays}d charged to leave</div>
        </div>
      </div>
    </Panel>
  );
};

const TripLengthPanel = ({
  histogram,
}: {
  histogram: ReadonlyArray<ReturnType<typeof buildTripLengthHistogram>[number]>;
}): JSX.Element => {
  const total = histogram.reduce((s, b) => s + b.count, 0);
  const data = {
    labels: histogram.map((b) => b.label),
    datasets: [
      {
        label: "trips",
        data: histogram.map((b) => b.count),
        backgroundColor: TOKENS.sageSoft,
        borderColor: TOKENS.sage,
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: tooltipStyle },
    scales: {
      x: {
        grid: { display: false },
        border: { color: TOKENS.edge },
        ticks: {
          color: TOKENS.inkTertiary,
          font: { family: FONT_MONO, size: 11 },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: TOKENS.inkTertiary,
          font: { family: FONT_MONO, size: 10 },
          stepSize: 1,
          precision: 0,
        },
        grid: { color: `${TOKENS.edge}66`, drawTicks: false },
        border: { display: false },
      },
    },
  };
  return (
    <Panel
      title="Trip-length distribution"
      subtitle={`${total} actual trip${total === 1 ? "" : "s"} grouped by length`}
    >
      <div className={styles.histogramFrame}>
        <Bar data={data} options={options} />
      </div>
    </Panel>
  );
};

type DiffRow =
  | { source: "optimal"; departure: number; return: number; matchedActual: boolean }
  | { source: "actual"; departure: number; return: number; matchedOptimal: boolean; isActual: boolean };

type DiffState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; rows: DiffRow[]; planScore: TripPlan; durationMs: number }
  | { kind: "error"; message: string };

const overlapsRange = (
  a: { departure: number; return: number },
  b: { departure: number; return: number },
): boolean => a.departure <= b.return && b.departure <= a.return;

const PlanVsActualPanel = (): JSX.Element => {
  const session = useSessionStore((s) => s.session);
  const holidays = useSessionStore((s) => s.holidays);
  const [state, setState] = useState<DiffState>({ kind: "idle" });

  if (!session) return <Panel title="Plan vs actual"><></></Panel>;

  const run = (): void => {
    setState({ kind: "running" });
    // Yield so React paints the running state before we burn the main thread.
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const sessionActualsOnly = {
          ...session,
          // Strip planned trips so the optimizer plans into the same budget
          // the user actually still has. Without this, an existing planned
          // trip would block the optimizer from suggesting anything in that
          // window, giving misleading "match" data.
          trips: session.trips.filter((t) => t.isActual),
        };
        const plans = optimize(sessionActualsOnly, {
          clock: FixedClock(session.cycle.start),
          holidays: new Set(holidays.map((h) => h.day)),
          topK: 1,
        });
        const optimal = plans[0];
        if (!optimal) {
          setState({ kind: "error", message: "Optimizer returned no plan" });
          return;
        }

        const optimalTrips = optimal.trips.map((t) => ({
          departure: t.departure,
          return: t.return,
        }));
        // Include both actuals and planned trips for comparison — the user's
        // intent is to see "what I have" vs "what the optimizer would do".
        const userTrips = session.trips.map((t) => ({
          departure: t.departure,
          return: t.return,
          isActual: t.isActual,
        }));

        const rows: DiffRow[] = [];
        for (const o of optimalTrips) {
          rows.push({
            source: "optimal",
            departure: o.departure,
            return: o.return,
            matchedActual: userTrips.some((u) => overlapsRange(o, u)),
          });
        }
        for (const u of userTrips) {
          rows.push({
            source: "actual",
            departure: u.departure,
            return: u.return,
            isActual: u.isActual,
            matchedOptimal: optimalTrips.some((o) => overlapsRange(u, o)),
          });
        }
        rows.sort((a, b) => a.departure - b.departure || (a.source === b.source ? 0 : a.source === "optimal" ? -1 : 1));

        const t1 = performance.now();
        setState({ kind: "done", rows, planScore: optimal, durationMs: t1 - t0 });
      } catch (err) {
        setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      }
    }, 30);
  };

  return (
    <Panel
      title="Plan vs actual"
      subtitle="how your current trips line up with the optimizer's top plan"
    >
      {state.kind === "idle" && (
        <div className={styles.diffIdle}>
          <p>
            Runs the optimizer against your session (counting only actual trips toward the budget),
            then shows which of its suggested trips you've already booked / planned and which trips
            you have that wouldn't be in the optimal plan.
          </p>
          <button type="button" className={styles.runBtn} onClick={run}>
            Compute optimal plan
          </button>
        </div>
      )}
      {state.kind === "running" && (
        <div className={styles.diffIdle}>Computing — this may take a few seconds…</div>
      )}
      {state.kind === "error" && (
        <div className={styles.diffIdle} style={{ color: "var(--accent-blocked)" }}>
          {state.message}
        </div>
      )}
      {state.kind === "done" && <DiffTable rows={state.rows} score={state.planScore} duration={state.durationMs} />}
      {state.kind === "done" && (
        <button type="button" className={styles.runBtn} onClick={run} style={{ alignSelf: "flex-start" }}>
          Recompute
        </button>
      )}
    </Panel>
  );
};

const DiffTable = ({
  rows,
  score,
  duration,
}: {
  rows: ReadonlyArray<DiffRow>;
  score: TripPlan;
  duration: number;
}): JSX.Element => {
  const matchedOptimal = rows.filter((r) => r.source === "optimal" && r.matchedActual).length;
  const totalOptimal = rows.filter((r) => r.source === "optimal").length;
  const extraActual = rows.filter((r) => r.source === "actual" && !r.matchedOptimal).length;

  return (
    <>
      <div className={styles.diffSummary}>
        <span>
          <strong>{matchedOptimal}/{totalOptimal}</strong> optimal trips covered by yours
        </span>
        <span>
          <strong>{extraActual}</strong> of yours not in the optimal plan
        </span>
        <span style={{ color: "var(--ink-tertiary)" }}>
          {score.awayDaysTotal}d home in optimal plan · ran in {duration.toFixed(0)} ms
        </span>
      </div>
      <ul className={styles.diffList}>
        {rows.map((r, i) => {
          const days = r.return - r.departure + 1;
          if (r.source === "optimal") {
            const tone = r.matchedActual ? styles.diffOk : styles.diffMissing;
            return (
              <li key={`o-${i}`} className={`${styles.diffRow} ${tone}`}>
                <span className={styles.diffMark} aria-hidden="true">
                  {r.matchedActual ? "★" : "+"}
                </span>
                <span className={styles.diffSource}>optimal</span>
                <span className={styles.diffDates}>
                  {isoFromDayInt(r.departure)} → {isoFromDayInt(r.return)}
                </span>
                <span className={styles.diffMeta}>{String(days).padStart(2, "0")}d</span>
                <span className={styles.diffNote}>
                  {r.matchedActual ? "covered" : "missing — consider adding"}
                </span>
              </li>
            );
          }
          const tone = r.matchedOptimal ? styles.diffOk : styles.diffExtra;
          return (
            <li key={`a-${i}`} className={`${styles.diffRow} ${tone}`}>
              <span className={styles.diffMark} aria-hidden="true">
                {r.matchedOptimal ? "●" : "◯"}
              </span>
              <span className={styles.diffSource}>{r.isActual ? "actual" : "planned"}</span>
              <span className={styles.diffDates}>
                {isoFromDayInt(r.departure)} → {isoFromDayInt(r.return)}
              </span>
              <span className={styles.diffMeta}>{String(days).padStart(2, "0")}d</span>
              <span className={styles.diffNote}>
                {r.matchedOptimal ? "aligns with optimal" : "outside optimal plan"}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
};

const MonthlyDistributionPanel = ({
  monthly,
}: {
  monthly: ReadonlyArray<ReturnType<typeof buildMonthlyDistribution>[number]>;
}): JSX.Element => {
  const labels = monthly.map((m) => m.label);
  const data = {
    labels,
    datasets: [
      {
        label: "trip days",
        data: monthly.map((m) => m.away),
        backgroundColor: TOKENS.sage,
        stack: "days",
      },
      {
        label: "blocked",
        data: monthly.map((m) => m.blocked),
        backgroundColor: TOKENS.brick,
        stack: "days",
      },
      {
        label: "holidays",
        data: monthly.map((m) => m.holiday),
        backgroundColor: TOKENS.amber,
        stack: "days",
      },
      {
        label: "weekends",
        data: monthly.map((m) => m.weekend),
        backgroundColor: TOKENS.inkFaint,
        stack: "days",
      },
      {
        label: "home (residence)",
        data: monthly.map((m) => m.home),
        backgroundColor: TOKENS.sunk,
        stack: "days",
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: TOKENS.inkTertiary,
          font: { family: FONT_MONO, size: 11 },
          boxWidth: 10,
          padding: 14,
        },
      },
      tooltip: tooltipStyle,
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        border: { color: TOKENS.edge },
        ticks: { color: TOKENS.inkTertiary, font: { family: FONT_MONO, size: 11 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          color: TOKENS.inkTertiary,
          font: { family: FONT_MONO, size: 10 },
          stepSize: 5,
        },
        grid: { color: `${TOKENS.edge}66`, drawTicks: false },
        border: { display: false },
      },
    },
  };
  return (
    <Panel
      title="Monthly distribution"
      subtitle="how each month of the cycle is spent — every day in exactly one bucket"
    >
      <div className={styles.histogramFrame} style={{ height: 280 }}>
        <Bar data={data} options={options} />
      </div>
    </Panel>
  );
};

const SchengenPanel = ({
  snapshot,
  residenceCountry,
  homeCountry,
}: {
  snapshot: ReturnType<typeof buildSchengenSnapshot>;
  residenceCountry: string;
  homeCountry: string;
}): JSX.Element => {
  if (!snapshot.applicable) {
    return (
      <Panel
        title="Schengen window"
        subtitle="not applicable — both residence and home are inside the Schengen Area"
      >
        <div className={styles.emptyState}>
          The 90/180 rolling-window rule restricts non-EU nationals visiting Schengen. With
          residence={residenceCountry} and home={homeCountry}, both are inside Schengen, so the
          rule doesn't apply here.
        </div>
      </Panel>
    );
  }
  const pct = Math.round((snapshot.daysUsed / snapshot.maxDays) * 100);
  const overLimit = snapshot.daysUsed > snapshot.maxDays;
  return (
    <Panel
      title="Schengen window"
      subtitle={`rolling ${snapshot.windowDays}-day counter for days outside the Schengen area`}
    >
      <div className={styles.schengenFrame}>
        <div className={styles.schengenStat}>
          <span className={styles.schengenValue}>
            {snapshot.daysUsed}
            <span className={styles.schengenSlash}>/{snapshot.maxDays}</span>
          </span>
          <span className={styles.schengenLabel}>days used (rolling 180)</span>
        </div>
        <div className={styles.schengenBar}>
          <div
            className={`${styles.schengenFill} ${overLimit ? styles.schengenFillOver : ""}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className={styles.schengenNote}>
          {overLimit
            ? "Window exceeds the 90-day limit — check your travel record."
            : `${snapshot.maxDays - snapshot.daysUsed} days remaining before the 90-day cap.`}
        </div>
      </div>
    </Panel>
  );
};

const AnchorListPanel = ({
  anchors,
}: {
  anchors: ReadonlyArray<ReturnType<typeof buildAnchorRows>[number]>;
}): JSX.Element => {
  const total = anchors.length;
  const satisfied = anchors.filter((a) => a.satisfied).length;
  return (
    <Panel
      title="Anchor coverage"
      subtitle={
        total === 0
          ? "no anchors yet — mark a day on the calendar to add one"
          : `${satisfied} of ${total} anchors satisfied by current trips`
      }
    >
      {total === 0 ? (
        <div className={styles.emptyState}>
          Anchors are days you really want to be in a specific place (typically home).
          The optimizer prefers plans that cover them.
        </div>
      ) : (
        <ul className={styles.anchorList}>
          {anchors.map((a) => (
            <li key={a.day} className={styles.anchorRow}>
              <span
                className={`${styles.anchorMark} ${a.satisfied ? styles.anchorMarkOk : styles.anchorMarkMiss}`}
                aria-label={a.satisfied ? "satisfied" : "not satisfied"}
              />
              <span className={styles.anchorDate}>
                {a.weekday} {a.iso}
              </span>
              <span className={styles.anchorPrefer}>
                prefer in <em>{a.preferIn}</em>
              </span>
              <span className={styles.anchorWeight}>+{a.weight}</span>
              <span className={styles.anchorExplain}>{a.explanation}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};
