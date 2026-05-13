import { useMemo } from "react";
import {
  fromDayInt,
  isoFromDayInt,
  resolveAttribution,
  type DayAttribution,
  type DayInt,
  type Session,
  type Trip,
} from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";

import styles from "./Trips.module.css";

type Props = {
  readonly departure: DayInt | null;
  readonly returnDay: DayInt | null;
  readonly halfDaysAllowed: boolean;
  readonly overrides: ReadonlyArray<DayAttribution>;
  readonly onChange: (next: ReadonlyArray<DayAttribution>) => void;
  /**
   * Optional. When supplied, each row shows the resolved leave-cost so the
   * user can see at a glance which days will actually consume a leave-day —
   * the previous UI only showed *override* state, which was easy to misread.
   */
  readonly session?: Session;
  readonly holidays?: ReadonlyArray<Holiday>;
  readonly bucketId?: string;
  readonly isActual?: boolean;
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
  session,
  holidays,
  bucketId,
  isActual,
}: Props): JSX.Element | null => {
  const days = useMemo<DayInt[]>(() => {
    if (departure === null || returnDay === null || departure > returnDay) return [];
    const out: DayInt[] = [];
    for (let d = departure; d <= returnDay; d++) out.push(d);
    return out;
  }, [departure, returnDay]);

  // Build the resolved attribution if we have enough context. We construct a
  // synthetic trip so the same engine code as the cost preview drives the row
  // chips — there is exactly one source of truth for "does this day consume
  // leave".
  const resolved = useMemo(() => {
    if (
      session === undefined ||
      holidays === undefined ||
      departure === null ||
      returnDay === null ||
      departure > returnDay ||
      bucketId === undefined
    ) {
      return null;
    }
    const trip: Trip = {
      id: "preview",
      departure,
      return: returnDay,
      bucketId,
      isActual: isActual ?? false,
      dayOverrides: [...overrides],
    };
    const holidaySet = new Set(holidays.map((h) => h.day));
    const map = new Map<DayInt, ReturnType<typeof resolveAttribution>[number]>();
    for (const r of resolveAttribution(trip, session, holidaySet)) map.set(r.day, r);
    return map;
  }, [session, holidays, departure, returnDay, bucketId, isActual, overrides]);

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

  const setLeaveMode = (day: DayInt, mode: "default" | "leave" | "noleave"): void => {
    const consumesLeave =
      mode === "default" ? undefined : mode === "leave" ? true : false;
    upsert(day, { consumesLeave });
  };

  const costChipFor = (day: DayInt): { text: string; tone: "leave" | "free" | "half" } => {
    const a = resolved?.get(day);
    if (!a) return { text: "—", tone: "free" };
    if (!a.consumesLeave) return { text: "0d", tone: "free" };
    if (a.halfDay) return { text: "½d", tone: "half" };
    return { text: "1d", tone: "leave" };
  };

  const chipColor = (tone: "leave" | "free" | "half"): string =>
    tone === "leave"
      ? "var(--accent-bucket-annual)"
      : tone === "half"
        ? "var(--accent-bucket-conference)"
        : "var(--ink-tertiary)";

  return (
    <section className={styles.overrides}>
      <h3 className={styles.overridesTitle}>per-day overrides</h3>
      <p className={styles.overridesHint}>
        Every working day in the trip consumes a leave-day. Weekends and public holidays don't.
        Use the dropdown to override a single day — for instance, mark a Saturday as a leave day
        if you took it from your annual allowance.
      </p>
      {days.map((day) => {
        const f = flagsOf(overrides, day);
        const date = fromDayInt(day);
        const weekday = date.dayOfWeek;
        const initials = ["M", "T", "W", "T", "F", "S", "S"][weekday - 1];
        const chip = costChipFor(day);
        const mode: "default" | "leave" | "noleave" =
          f.consumesLeave === true ? "leave" : f.consumesLeave === false ? "noleave" : "default";
        return (
          <div key={day} className={styles.overrideRow}>
            <span className={styles.overrideDay}>
              {initials} {isoFromDayInt(day)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--type-mono-sm)",
                color: chipColor(chip.tone),
                fontFeatureSettings: "'tnum' 1",
                minWidth: 28,
                textAlign: "right",
              }}
              title="resolved leave cost for this day"
            >
              {chip.text}
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
            <label className={styles.checkboxRow} style={{ gridColumn: "span 2" }}>
              leave:
              <select
                className={styles.input}
                style={{ marginLeft: 6, padding: "2px 6px" }}
                value={mode}
                onChange={(e) =>
                  setLeaveMode(day, e.target.value as "default" | "leave" | "noleave")
                }
              >
                <option value="default">default</option>
                <option value="leave">consumes leave</option>
                <option value="noleave">no leave</option>
              </select>
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
