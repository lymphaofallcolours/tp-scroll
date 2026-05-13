import { useMemo, useState } from "react";

import {
  computeBucketBalances,
  computeTripCost,
  type Session,
} from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";

import { DayPopover } from "./DayPopover.js";
import { MonthGrid } from "./MonthGrid.js";
import { buildYearView, type DayCell } from "./calendar-data.js";
import styles from "./Calendar.module.css";

type Props = {
  readonly session: Session;
  readonly holidays: ReadonlyArray<Holiday>;
  readonly homeHolidays?: ReadonlyArray<Holiday>;
};

export const Calendar = ({ session, holidays, homeHolidays = [] }: Props): JSX.Element => {
  const months = useMemo(
    () => buildYearView(session, holidays, homeHolidays),
    [session, holidays, homeHolidays],
  );
  const [openCell, setOpenCell] = useState<{ cell: DayCell; rect: DOMRect } | null>(null);
  const balances = useMemo(
    () => computeBucketBalances(session, new Set(holidays.map((h) => h.day))),
    [session, holidays],
  );
  // The "annual" balance is the planning bucket — prefer kind="annual" (v2.5),
  // fall back to the first bucket if no annual exists.
  const annual =
    balances.find((b) => session.buckets.find((sb) => sb.id === b.bucketId)?.kind === "annual") ??
    balances[0];

  const tripDays = useMemo(() => {
    const holidaySet = new Set(holidays.map((h) => h.day));
    return session.trips.reduce((sum, t) => {
      const cost = computeTripCost(t, session, holidaySet);
      return sum + cost.awayDays;
    }, 0);
  }, [session, holidays]);

  const cycleYear = months[0]?.year ?? new Date().getUTCFullYear();

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div>
          <span className={styles.brandKicker}>tp-scroll · annual leave plot</span>
          <h1 className={styles.brand}>
            a calendar
            <br />
            for time away
          </h1>
        </div>
        <div className={styles.sessionMeta}>
          <div className={styles.sessionName}>{session.name}</div>
          <div className={styles.sessionRoute}>
            <em title="Residence (where you live and work)">{session.residenceCountry}</em>
            &nbsp;→&nbsp;
            <em title="Home (the country you're trying to spend more time in)">{session.homeCountry}</em>
            <br />
            cycle&nbsp;{cycleYear}
          </div>
        </div>
      </header>

      <div className={styles.legend} role="region" aria-label="Legend">
        <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchResidence}`} /> residence weekday</span>
        <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchWeekend}`} /> weekend</span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchHoliday}`} />{" "}
          {session.residenceCountry} public holiday
          <span className={styles.legendCount}>({holidays.length})</span>
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchHomeHoliday}`} />{" "}
          {session.homeCountry} public holiday
          <span className={styles.legendCount}>({homeHolidays.length})</span>
        </span>
        <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchBlocked}`} /> blocked</span>
        <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchActual}`} /> trip · actual</span>
        <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchPlanned}`} /> trip · planned</span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchAnchor}`} />
          anchor day
          <span className={styles.legendCount}>({session.anchors.length})</span>
        </span>
      </div>

      <section className={styles.summary} aria-label="Cycle summary">
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Cycle</span>
          <span className={styles.summaryValue}>
            {session.cycle.totalDays}
            <span className={styles.summaryUnit}>days</span>
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Consumed</span>
          <span className={styles.summaryValue}>
            {annual ? annual.balance.consumed : 0}
            <span className={styles.summaryUnit}>days</span>
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Remaining</span>
          <span className={styles.summaryValue}>
            {annual ? annual.balance.remaining : session.cycle.totalDays}
            <span className={styles.summaryUnit}>days</span>
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Away-days</span>
          <span className={styles.summaryValue}>
            {tripDays}
            <span className={styles.summaryUnit}>days</span>
          </span>
        </div>
      </section>

      <div className={styles.months}>
        {months.map((m) => (
          <MonthGrid
            key={`${m.year}-${m.month}`}
            view={m}
            onCellClick={(cell, rect) => setOpenCell({ cell, rect })}
          />
        ))}
      </div>

      <p className={styles.footnote}>
        “Some places are so far you only see them by going home.”
      </p>

      {openCell !== null && (
        <DayPopover
          cell={openCell.cell}
          anchorRect={openCell.rect}
          session={session}
          onClose={() => setOpenCell(null)}
        />
      )}
    </main>
  );
};
