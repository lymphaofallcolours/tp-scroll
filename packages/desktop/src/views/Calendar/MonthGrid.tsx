import type { DayCell, MonthView } from "./calendar-data.js";
import { MONTH_NAMES, WEEKDAY_INITIALS } from "./calendar-data.js";
import styles from "./MonthGrid.module.css";

const cellClassFor: Record<DayCell["kind"], string> = {
  blank: styles.cellBlank,
  residence: styles.cellResidence,
  weekend: styles.cellWeekend,
  holiday: styles.cellHoliday,
  blocked: styles.cellBlocked,
  "trip-actual": styles.cellTripActual,
  "trip-planned": styles.cellTripPlanned,
};

type Props = {
  readonly view: MonthView;
};

const countByKind = (view: MonthView): Map<DayCell["kind"], number> => {
  const map = new Map<DayCell["kind"], number>();
  for (const week of view.weeks) {
    for (const cell of week) {
      if (cell === null) continue;
      map.set(cell.kind, (map.get(cell.kind) ?? 0) + 1);
    }
  }
  return map;
};

export const MonthGrid = ({ view }: Props): JSX.Element => {
  const counts = countByKind(view);
  const tripDays = (counts.get("trip-actual") ?? 0) + (counts.get("trip-planned") ?? 0);
  const holidays = counts.get("holiday") ?? 0;

  return (
    <section className={styles.month}>
      <header className={styles.header}>
        <h2 className={styles.title}>{MONTH_NAMES[view.month - 1]}</h2>
        <div className={styles.titleSmall}>
          {String(view.year).padStart(4, "0")} · month {String(view.month).padStart(2, "0")}
        </div>
        <div className={styles.stat}>
          {tripDays > 0 ? `${String(tripDays).padStart(2, "0")} trip-days · ` : ""}
          {String(holidays).padStart(2, "0")} holidays
        </div>
      </header>

      <div className={styles.grid} role="grid" aria-label={MONTH_NAMES[view.month - 1]}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <div key={`wd-${i}`} className={styles.weekdayLabel} aria-hidden="true">
            {d}
          </div>
        ))}
        {view.weeks.flatMap((week, wIdx) =>
          week.map((cell, dIdx) => {
            if (cell === null) {
              return <div key={`b-${wIdx}-${dIdx}`} className={`${styles.cell} ${styles.cellBlank}`} />;
            }
            const cls = cellClassFor[cell.kind];
            return (
              <div
                key={`c-${wIdx}-${dIdx}`}
                className={`${styles.cell} ${cls}`}
                title={`${cell.date.toString()} — ${cell.kind}`}
              >
                {cell.date.day}
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
};
