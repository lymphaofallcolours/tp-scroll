import { useMemo, useState } from "react";
import {
  computeTripCost,
  dayIntFromIso,
  isoFromDayInt,
  type DayAttribution,
  type Session,
  type Trip,
} from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";

import { DayOverridesEditor } from "./DayOverridesEditor.js";
import styles from "./Trips.module.css";

type Props = {
  readonly session: Session;
  readonly initial: Trip | null; // null = new
  readonly isDemo: boolean;
  readonly holidays: ReadonlyArray<Holiday>;
  readonly onSubmit: (trip: Trip) => Promise<void> | void;
  readonly onCancel: () => void;
  readonly onDelete: (() => Promise<void> | void) | null;
};

const cryptoId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

export const TripForm = ({
  session,
  initial,
  isDemo,
  holidays,
  onSubmit,
  onCancel,
  onDelete,
}: Props): JSX.Element => {
  const [from, setFrom] = useState(initial ? isoFromDayInt(initial.departure) : "");
  const [to, setTo] = useState(initial ? isoFromDayInt(initial.return) : "");
  const [isActual, setIsActual] = useState(initial?.isActual ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [bucketId, setBucketId] = useState(
    initial?.bucketId ?? session.buckets[0]?.id ?? "annual",
  );
  const [overrides, setOverrides] = useState<ReadonlyArray<DayAttribution>>(
    initial?.dayOverrides ?? [],
  );

  const parsedFrom = useMemo(() => safeIso(from), [from]);
  const parsedTo = useMemo(() => safeIso(to), [to]);
  const valid =
    parsedFrom !== null && parsedTo !== null && parsedFrom <= parsedTo;

  // Live preview of leave-cost / away-days / travel-days as the form changes.
  // Uses the same computeTripCost the optimizer + balance use, so the number
  // here is exactly what'll be charged on save.
  const preview = useMemo(() => {
    if (!valid || parsedFrom === null || parsedTo === null) return null;
    const draft: Trip = {
      id: initial?.id ?? "preview",
      departure: parsedFrom,
      return: parsedTo,
      bucketId,
      isActual,
      dayOverrides: overrides.filter((o) => o.day >= parsedFrom && o.day <= parsedTo),
    };
    const holidaySet = new Set(holidays.map((h) => h.day));
    return computeTripCost(draft, session, holidaySet);
  }, [valid, parsedFrom, parsedTo, bucketId, isActual, overrides, initial, holidays, session]);

  const totalDaysInTrip = parsedFrom !== null && parsedTo !== null ? parsedTo - parsedFrom + 1 : 0;

  const handleSubmit = (): void => {
    if (!valid || parsedFrom === null || parsedTo === null) return;
    const trip: Trip = {
      id: initial?.id ?? cryptoId(),
      departure: parsedFrom,
      return: parsedTo,
      bucketId,
      isActual,
      dayOverrides: overrides.filter((o) => o.day >= parsedFrom && o.day <= parsedTo),
      ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
    };
    void onSubmit(trip);
  };

  return (
    <>
      {isDemo && (
        <div className={styles.demoBanner}>
          You're viewing a demo session. Changes stay in this window until you create a real
          session.
        </div>
      )}

      <h2 className={styles.panelTitle}>
        {initial ? "Edit trip" : "New trip"}
      </h2>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>From</span>
          <input
            type="date"
            className={styles.input}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>To</span>
          <input
            type="date"
            className={styles.input}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Bucket</span>
          <select
            className={styles.select}
            value={bucketId}
            onChange={(e) => setBucketId(e.target.value)}
          >
            {session.buckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.totalDays} days)
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Kind</span>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={isActual}
              onChange={(e) => setIsActual(e.target.checked)}
            />
            actual (recorded), unchecked = planned
          </label>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Notes</span>
        <input
          type="text"
          className={styles.input}
          value={notes}
          placeholder="e.g. Christmas at home"
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {preview !== null && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            background: "var(--surface-page)",
            border: "1px solid var(--surface-edge)",
            borderRadius: "var(--radius-cell)",
            marginBottom: "var(--space-4)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-3)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--type-mono-sm)",
            color: "var(--ink-secondary)",
          }}
          title="Computed from current dates, weekends, public holidays, and any per-day overrides below"
        >
          <div>
            <span style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-tertiary)" }}>
              total
            </span>
            <span style={{ fontSize: "var(--type-body)", color: "var(--ink-primary)" }}>
              {totalDaysInTrip}d
            </span>
          </div>
          <div>
            <span style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-tertiary)" }}>
              leave cost
            </span>
            <span style={{ fontSize: "var(--type-body)", color: "var(--accent-trip)" }}>
              {preview.leaveCost}d
            </span>
          </div>
          <div>
            <span style={{ display: "block", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-tertiary)" }}>
              away
            </span>
            <span style={{ fontSize: "var(--type-body)", color: "var(--ink-primary)" }}>
              {preview.awayDays}d
            </span>
          </div>
        </div>
      )}

      <DayOverridesEditor
        departure={parsedFrom}
        returnDay={parsedTo}
        halfDaysAllowed={session.cycle.halfDaysAllowed}
        overrides={overrides}
        onChange={setOverrides}
      />

      <div className={styles.formActions}>
        {onDelete && (
          <button type="button" className={styles.dangerBtn} onClick={() => void onDelete()}>
            Delete
          </button>
        )}
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleSubmit}
          disabled={!valid}
        >
          {initial ? "Save" : "Add trip"}
        </button>
      </div>
    </>
  );
};

const safeIso = (s: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  try {
    return dayIntFromIso(s);
  } catch {
    return null;
  }
};
