import { useMemo } from "react";
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

import { useSessionStore } from "../../state/session.js";

import {
  buildAnchorRows,
  buildBucketSlices,
  buildBurndown,
  buildLeverageStats,
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
    const main = `var(${b.colorVar})`;
    const soft = `var(${b.colorVar}-soft)`;
    if (b.consumed > 0) {
      labels.push(`${b.bucketName} consumed`);
      values.push(b.consumed);
      colors.push(main);
    }
    if (b.remaining > 0) {
      labels.push(`${b.bucketName} remaining`);
      values.push(b.remaining);
      colors.push(soft);
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
          return (
            <li key={b.bucketId} className={styles.bucketRow}>
              <span
                className={styles.bucketDot}
                style={{ background: `var(${b.colorVar})` }}
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
  return (
    <Panel
      title="Weekend & holiday leverage"
      subtitle="share of away-days that don't consume leave"
    >
      <div className={styles.gaugeFrame}>
        <div className={styles.gaugeValue}>{pct}%</div>
        <div className={styles.gaugeRing}>
          <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
            <circle
              cx="80"
              cy="80"
              r="64"
              fill="none"
              stroke={TOKENS.sunk}
              strokeWidth="14"
            />
            <circle
              cx="80"
              cy="80"
              r="64"
              fill="none"
              stroke={TOKENS.sage}
              strokeWidth="14"
              strokeDasharray={`${(pct / 100) * 2 * Math.PI * 64} ${2 * Math.PI * 64}`}
              strokeDashoffset={2 * Math.PI * 64 * 0.25}
              transform="rotate(-90 80 80)"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className={styles.gaugeDetail}>
          <div><span className={styles.gaugeNum}>{stats.awayDays}</span> away-days total</div>
          <div><span className={styles.gaugeNum}>{stats.leaveDays}</span> charged to leave</div>
          <div>
            <span className={styles.gaugeNum}>{stats.freeDays}</span> free
            <span style={{ color: TOKENS.inkTertiary }}> · weekends + holidays + overrides</span>
          </div>
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
