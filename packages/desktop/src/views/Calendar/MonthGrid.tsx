import { bucketKindColor, type BucketKind } from "@tp-scroll/core";

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

const tripStyleFor = (cell: DayCell): React.CSSProperties | undefined => {
  if (cell.kind !== "trip-actual" && cell.kind !== "trip-planned") return undefined;
  const kind: BucketKind = cell.bucketKind ?? "annual";
  // Compose a CSS custom property reference; tokens.css holds the values.
  const main = `var(${bucketKindColor(kind)})`;
  const soft = `var(${bucketKindColor(kind)}-soft)`;
  if (cell.kind === "trip-actual") {
    return { background: main, color: "var(--surface-card)" };
  }
  return { background: soft, color: "var(--ink-primary)", borderColor: main };
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
            const homeCls = cell.homeHoliday === true ? ` ${styles.cellHomeHoliday}` : "";
            const style = tripStyleFor(cell);
            const titleParts = [cell.date.toString(), cell.kind];
            if (cell.bucketKind) titleParts.push(cell.bucketKind);
            if (cell.holidayName) titleParts.push(`“${cell.holidayName}”`);
            const title = titleParts.join(" — ");
            return (
              <div
                key={`c-${wIdx}-${dIdx}`}
                className={`${styles.cell} ${cls}${homeCls}`}
                {...(style !== undefined ? { style } : {})}
                title={title}
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
