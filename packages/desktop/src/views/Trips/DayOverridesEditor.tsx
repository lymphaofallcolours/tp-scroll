import { useMemo } from "react";
import {
  fromDayInt,
  isoFromDayInt,
  type DayAttribution,
  type DayInt,
} from "@tp-scroll/core";

import styles from "./Trips.module.css";

type Props = {
  readonly departure: DayInt | null;
  readonly returnDay: DayInt | null;
  readonly halfDaysAllowed: boolean;
  readonly overrides: ReadonlyArray<DayAttribution>;
  readonly onChange: (next: ReadonlyArray<DayAttribution>) => void;
};

const flagsOf = (
  list: ReadonlyArray<DayAttribution>,
  day: DayInt,
): DayAttribution => list.find((o) => o.day === day) ?? { day };

export const DayOverridesEditor = ({
  departure,
  returnDay,
  halfDaysAllowed,
  overrides,
  onChange,
}: Props): JSX.Element | null => {
  const days = useMemo<DayInt[]>(() => {
    if (departure === null || returnDay === null || departure > returnDay) return [];
    const out: DayInt[] = [];
    for (let d = departure; d <= returnDay; d++) out.push(d);
    return out;
  }, [departure, returnDay]);

  if (days.length === 0) return null;

  const upsert = (day: DayInt, patch: Partial<DayAttribution>): void => {
    const existing = overrides.find((o) => o.day === day);
    const merged: DayAttribution = { ...(existing ?? { day }), ...patch };
    const cleaned: DayAttribution = { day };
    if (merged.consumesLeave !== undefined) cleaned.consumesLeave = merged.consumesLeave;
    if (merged.isTravelDay !== undefined) cleaned.isTravelDay = merged.isTravelDay;
    if (merged.halfDay !== undefined) cleaned.halfDay = merged.halfDay;
    if (merged.location !== undefined) cleaned.location = merged.location;

    const isEmpty =
      cleaned.consumesLeave === undefined &&
      cleaned.isTravelDay === undefined &&
      cleaned.halfDay === undefined &&
      cleaned.location === undefined;

    const next = overrides.filter((o) => o.day !== day);
    if (!isEmpty) next.push(cleaned);
    onChange(next.sort((a, b) => a.day - b.day));
  };

  return (
    <section className={styles.overrides}>
      <h3 className={styles.overridesTitle}>per-day overrides</h3>
      <p className={styles.overridesHint}>
        Defaults already handle weekends and public holidays. Use these checkboxes only when a day
        differs: e.g. a Friday flight that doesn't count as leave, or a Monday return that does.
      </p>
      {days.map((day) => {
        const f = flagsOf(overrides, day);
        const date = fromDayInt(day);
        const weekday = date.dayOfWeek;
        const initials = ["M", "T", "W", "T", "F", "S", "S"][weekday - 1];
        return (
          <div key={day} className={styles.overrideRow}>
            <span className={styles.overrideDay}>
              {initials} {isoFromDayInt(day)}
            </span>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={f.isTravelDay === true}
                onChange={(e) => upsert(day, { isTravelDay: e.target.checked || undefined })}
              />
              travel day
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={f.consumesLeave === false}
                onChange={(e) => upsert(day, { consumesLeave: e.target.checked ? false : undefined })}
              />
              no leave
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                disabled={!halfDaysAllowed}
                checked={f.halfDay === true}
                onChange={(e) => upsert(day, { halfDay: e.target.checked || undefined })}
              />
              half day{halfDaysAllowed ? "" : " (off)"}
            </label>
          </div>
        );
      })}
    </section>
  );
};
