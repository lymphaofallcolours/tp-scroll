import { useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { useSessionStore } from "../../state/session.js";
import { buildBurndown } from "./burndown-data.js";
import styles from "./Burndown.module.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Computed tokens consumed by Chart.js — keep in sync with tokens.css.
const TOKENS = {
  ink: "#1a2433",
  inkTertiary: "#6b7488",
  inkFaint: "#aaa794",
  edge: "#d4c8ad",
  sage: "#7a8e62",         // actuals — bucket-annual
  sageSoft: "#c4cdb1",
  teal: "#4f7c84",         // projected — bucket-parental (distinct hue from sage)
  amber: "#b08440",        // budget warning — bucket-conference (warm contrast)
  red: "#a85333",
  surface: "#f4ede0",
};

const FONT_MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace";

export const Burndown = (): JSX.Element | null => {
  const session = useSessionStore((s) => s.session);
  const holidays = useSessionStore((s) => s.holidays);

  const data = useMemo(
    () => (session ? buildBurndown(session, holidays) : null),
    [session, holidays],
  );

  if (!session || !data) return null;

  const actualToDate = data.actuals[data.actuals.length - 1] ?? 0;
  const projectedTotal = data.projected[data.projected.length - 1] ?? 0;
  const remaining = data.budget - actualToDate;

  const chartData = {
    labels: data.labels.slice(),
    datasets: [
      {
        label: "Actual (recorded)",
        data: data.actuals.slice(),
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
        data: data.projected.slice(),
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
        label: `Budget (${data.budget})`,
        data: Array(data.labels.length).fill(data.budget),
        borderColor: TOKENS.red,
        borderWidth: 2,
        borderDash: [2, 3],
        fill: false,
        pointRadius: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: TOKENS.ink,
        titleColor: TOKENS.surface,
        bodyColor: TOKENS.surface,
        titleFont: { family: FONT_MONO, size: 11, weight: 400 },
        bodyFont: { family: FONT_MONO, size: 12 },
        padding: 10,
        borderWidth: 0,
        cornerRadius: 2,
        displayColors: true,
      },
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
          callback: function (this: unknown, _val: unknown, index: number) {
            const label = data.labels[index];
            if (!label) return "";
            return label.slice(5, 10); // MM-DD
          },
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: Math.max(data.budget + 2, projectedTotal + 2),
        grid: { color: `${TOKENS.edge}66`, drawTicks: false },
        border: { display: false },
        ticks: {
          color: TOKENS.inkTertiary,
          font: { family: FONT_MONO, size: 10 },
          stepSize: 5,
          callback: function (this: unknown, val: unknown) {
            return `${val}d`;
          },
        },
      },
    },
    animation: {
      duration: 800,
      easing: "easeOutCubic" as const,
    },
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>tp-scroll · burndown</span>
          <h1 className={styles.title}>How much of the year is already spent.</h1>
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

      <div className={styles.chartFrame}>
        <Line data={chartData} options={chartOptions} />
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.lineSwatch} />
          actual — leave already used
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.lineSwatch} ${styles.dashed}`} />
          projected — including planned trips
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.lineSwatch} ${styles.budget}`} />
          budget — cycle.totalDays
        </span>
      </div>

      <p className={styles.note}>
        Each step is a trip's return day — that's when leave is charged.
      </p>
    </main>
  );
};
