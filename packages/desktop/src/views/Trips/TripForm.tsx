import { useMemo, useState } from "react";
import {
  dayIntFromIso,
  isoFromDayInt,
  type DayAttribution,
  type Session,
  type Trip,
} from "@tp-scroll/core";

import { DayOverridesEditor } from "./DayOverridesEditor.js";
import styles from "./Trips.module.css";

type Props = {
  readonly session: Session;
  readonly initial: Trip | null; // null = new
  readonly isDemo: boolean;
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
