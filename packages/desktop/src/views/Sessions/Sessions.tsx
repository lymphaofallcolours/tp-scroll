import { useState } from "react";
import {
  bucketKindColor,
  dayIntFromIso,
  fromDayInt,
  isoFromDayInt,
  type BucketKind,
  type FlightConstraints,
  type Session,
} from "@tp-scroll/core";

import { useSessionStore } from "../../state/session.js";
import styles from "./Sessions.module.css";

const BUCKET_KINDS: ReadonlyArray<BucketKind> = [
  "annual",
  "sick",
  "parental",
  "conference",
  "other",
];

export const Sessions = (): JSX.Element | null => {
  const session = useSessionStore((s) => s.session);
  const summaries = useSessionStore((s) => s.summaries);
  const isDemo = useSessionStore((s) => s.isDemo);
  const createSession = useSessionStore((s) => s.createSession);
  const switchSession = useSessionStore((s) => s.switchSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const rollActiveCycle = useSessionStore((s) => s.rollActiveCycle);
  const setFlightConstraints = useSessionStore((s) => s.setFlightConstraints);
  const addBucket = useSessionStore((s) => s.addBucket);

  const [createName, setCreateName] = useState("");
  const [createResidence, setCreateResidence] = useState("DE");
  const [createHome, setCreateHome] = useState("ES");
  const [createError, setCreateError] = useState<string | null>(null);

  const cycleStartIso = session ? isoFromDayInt(session.cycle.start) : "";
  const cycleEndIso = session ? isoFromDayInt(session.cycle.end) : "";
  const cycleStartYear = session ? fromDayInt(session.cycle.start).year : new Date().getUTCFullYear();
  const nextYear = cycleStartYear + 1;

  const [rollFrom, setRollFrom] = useState(`${nextYear}-01-01`);
  const [rollTo, setRollTo] = useState(`${nextYear}-12-31`);
  const [rollDays, setRollDays] = useState(session?.cycle.totalDays ?? 25);
  const [rollError, setRollError] = useState<string | null>(null);

  const onCreate = async (): Promise<void> => {
    setCreateError(null);
    if (createName.trim().length === 0) {
      setCreateError("name is required");
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(createResidence) || !/^[A-Za-z]{2}$/.test(createHome)) {
      setCreateError("country codes must be 2 letters (ISO-3166-1 alpha-2)");
      return;
    }
    try {
      await createSession({
        name: createName.trim(),
        residenceCountry: createResidence,
        homeCountry: createHome,
      });
      setCreateName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  };

  const onRoll = async (): Promise<void> => {
    setRollError(null);
    try {
      await rollActiveCycle({
        name: `${nextYear} cycle`,
        start: dayIntFromIso(rollFrom),
        end: dayIntFromIso(rollTo),
        totalDays: Math.max(0, Number(rollDays)),
      });
    } catch (err) {
      setRollError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>tp-scroll · sessions</span>
        <h1 className={styles.title}>Each year you live abroad is its own scroll.</h1>
      </header>

      <div className={styles.grid}>
        <section className={styles.column}>
          <h2 className={styles.columnTitle}>Your sessions</h2>
          {summaries.length === 0 && isDemo ? (
            <div className={styles.empty}>
              You haven't saved a session yet. Use the form on the right to make one — the demo
              steps aside as soon as you do.
            </div>
          ) : (
            <div className={styles.sessionList}>
              {summaries.map((s) => {
                const isActive = !isDemo && session?.id === s.id;
                return (
                  <div
                    key={s.id}
                    className={`${styles.sessionRow} ${isActive ? styles.sessionRowActive : ""}`}
                  >
                    <span className={isActive ? styles.activeDot : styles.inactiveDot} />
                    <div className={styles.sessionName}>
                      <span className={styles.sessionNameMain}>{s.name}</span>
                      <span className={styles.sessionNameSub}>
                        {s.id} · updated {s.updatedAt.slice(0, 10)}
                      </span>
                    </div>
                    {!isActive ? (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => void switchSession(s.id)}
                      >
                        switch
                      </button>
                    ) : (
                      <span className={styles.linkBtn} style={{ color: "var(--accent-trip)" }}>
                        active
                      </span>
                    )}
                    <button
                      type="button"
                      className={`${styles.linkBtn} ${styles.danger}`}
                      onClick={() => void deleteSession(s.id)}
                    >
                      delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {session && !isDemo && (
            <div className={styles.card}>
              <h2 className={styles.columnTitle}>Roll the cycle</h2>
              <p className={styles.cycleSummary}>
                Active cycle: <strong>{cycleStartIso} → {cycleEndIso}</strong>
                {" · "}
                <strong>{session.cycle.totalDays}d</strong>
                {" · "}
                carryover&nbsp;
                <strong>{session.cycle.carryover.mode}</strong>
              </p>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>New start</span>
                  <input
                    type="date"
                    className={styles.input}
                    value={rollFrom}
                    onChange={(e) => setRollFrom(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>New end</span>
                  <input
                    type="date"
                    className={styles.input}
                    value={rollTo}
                    onChange={(e) => setRollTo(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Total days for the new cycle</span>
                <input
                  type="number"
                  className={styles.input}
                  min={0}
                  value={rollDays}
                  onChange={(e) => setRollDays(Number(e.target.value))}
                />
              </div>
              <button type="button" className={styles.primaryBtn} onClick={() => void onRoll()}>
                Roll cycle
              </button>
              {rollError && <p className={styles.error}>{rollError}</p>}
            </div>
          )}

          {session && (
            <FlightConstraintsCard
              constraints={session.flightConstraints ?? null}
              onSave={async (next) => setFlightConstraints(next)}
            />
          )}

          {session && (
            <BucketsCard
              session={session}
              onAdd={async (input) => addBucket(input)}
            />
          )}
        </section>

        <section className={styles.column}>
          <h2 className={styles.columnTitle}>New session</h2>
          <div className={styles.card}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Name</span>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. 2026 PhD year"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Residence</span>
                <input
                  type="text"
                  className={styles.input}
                  maxLength={2}
                  value={createResidence}
                  onChange={(e) => setCreateResidence(e.target.value.toUpperCase())}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Home</span>
                <input
                  type="text"
                  className={styles.input}
                  maxLength={2}
                  value={createHome}
                  onChange={(e) => setCreateHome(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <button type="button" className={styles.primaryBtn} onClick={() => void onCreate()}>
              Create session
            </button>
            {createError && <p className={styles.error}>{createError}</p>}
          </div>
        </section>
      </div>
    </main>
  );
};

const BucketsCard = ({
  session,
  onAdd,
}: {
  session: Session;
  onAdd: (input: { id: string; name: string; totalDays: number; kind: BucketKind }) => Promise<void>;
}): JSX.Element => {
  const [showForm, setShowForm] = useState(false);
  const [bId, setBId] = useState("");
  const [bName, setBName] = useState("");
  const [bDays, setBDays] = useState("");
  const [bKind, setBKind] = useState<BucketKind>("sick");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (): Promise<void> => {
    setError(null);
    if (bId.trim().length === 0 || bName.trim().length === 0) {
      setError("id and name are required");
      return;
    }
    const days = Number(bDays);
    if (!Number.isFinite(days) || days < 0) {
      setError("totalDays must be a non-negative number");
      return;
    }
    try {
      await onAdd({ id: bId.trim(), name: bName.trim(), totalDays: days, kind: bKind });
      setBId("");
      setBName("");
      setBDays("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const totals = session.buckets.reduce((s, b) => s + b.totalDays, 0);
  const cycleTotal = session.cycle.totalDays;
  const balanced = totals === cycleTotal;

  return (
    <div className={styles.card}>
      <h2 className={styles.columnTitle}>Buckets</h2>
      <p className={styles.cycleSummary} style={{ borderBottom: "none", paddingBottom: 0 }}>
        Each bucket has a kind so the optimizer can default to "annual" and the
        UI can colour-code your time off. Totals must add up to your cycle's
        <strong> {cycleTotal} days</strong>.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {session.buckets.map((b) => {
          const color = `var(${bucketKindColor(b.kind)})`;
          return (
            <div
              key={b.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto",
                gap: "var(--space-3)",
                alignItems: "center",
                padding: "var(--space-2) var(--space-3)",
                background: "var(--surface-page)",
                border: "1px solid var(--surface-edge)",
                borderRadius: "var(--radius-cell)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--type-mono)",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: color,
                  display: "inline-block",
                }}
              />
              <span>{b.name} <span style={{ color: "var(--ink-tertiary)" }}>({b.id})</span></span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--type-mono-sm)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--ink-secondary)",
                  padding: "2px 6px",
                  background: `var(${bucketKindColor(b.kind)}-soft)`,
                  borderRadius: 2,
                }}
              >
                {b.kind}
              </span>
              <span style={{ color: "var(--ink-primary)", fontFeatureSettings: "'tnum' 1" }}>
                {b.totalDays}d
              </span>
            </div>
          );
        })}
      </div>
      <p
        className={styles.cycleSummary}
        style={{ borderTop: "1px solid var(--surface-edge)", paddingTop: "var(--space-3)", marginTop: "var(--space-3)", marginBottom: "var(--space-3)", borderBottom: "none", paddingBottom: 0 }}
      >
        sum&nbsp;
        <strong style={{ color: balanced ? "var(--accent-trip)" : "var(--accent-blocked)" }}>
          {totals}d
        </strong>
        &nbsp;/&nbsp;<strong>{cycleTotal}d</strong>
        {balanced ? " ✓" : " — sum must equal cycle total to save"}
      </p>
      {!showForm ? (
        <button type="button" className={styles.linkBtn} onClick={() => setShowForm(true)}>
          + add bucket
        </button>
      ) : (
        <>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Id</span>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. sick"
                value={bId}
                onChange={(e) => setBId(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Display name</span>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. Sick days"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Total days</span>
              <input
                type="number"
                className={styles.input}
                min={0}
                placeholder="e.g. 10"
                value={bDays}
                onChange={(e) => setBDays(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Kind</span>
              <select
                className={styles.input}
                value={bKind}
                onChange={(e) => setBKind(e.target.value as BucketKind)}
              >
                {BUCKET_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button type="button" className={styles.primaryBtn} onClick={() => void onSubmit()}>
              Add bucket
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              style={{ alignSelf: "center" }}
            >
              cancel
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </>
      )}
    </div>
  );
};

const FlightConstraintsCard = ({
  constraints,
  onSave,
}: {
  constraints: FlightConstraints | null;
  onSave: (next: FlightConstraints | null) => Promise<void>;
}): JSX.Element => {
  const [maxDuration, setMaxDuration] = useState(
    constraints?.maxDurationMinutes !== undefined ? String(constraints.maxDurationMinutes) : "",
  );
  const [departAfter, setDepartAfter] = useState(
    constraints?.departAfterHour !== undefined ? String(constraints.departAfterHour) : "",
  );
  const [arriveBefore, setArriveBefore] = useState(
    constraints?.arriveBeforeHour !== undefined ? String(constraints.arriveBeforeHour) : "",
  );
  const [combineMode, setCombineMode] = useState<"and" | "or">(
    constraints?.combineMode ?? "and",
  );
  const [error, setError] = useState<string | null>(null);

  const onApply = async (): Promise<void> => {
    setError(null);
    const numOrUndef = (s: string): number | undefined => {
      if (s.trim().length === 0) return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    };
    const next: FlightConstraints = {
      ...(numOrUndef(maxDuration) !== undefined ? { maxDurationMinutes: numOrUndef(maxDuration)! } : {}),
      ...(numOrUndef(departAfter) !== undefined ? { departAfterHour: numOrUndef(departAfter)! } : {}),
      ...(numOrUndef(arriveBefore) !== undefined ? { arriveBeforeHour: numOrUndef(arriveBefore)! } : {}),
      combineMode,
    };
    const allEmpty =
      next.maxDurationMinutes === undefined &&
      next.departAfterHour === undefined &&
      next.arriveBeforeHour === undefined;
    try {
      await onSave(allEmpty ? null : next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onClear = async (): Promise<void> => {
    setMaxDuration("");
    setDepartAfter("");
    setArriveBefore("");
    setError(null);
    await onSave(null);
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.columnTitle}>Flight constraints</h2>
      <p className={styles.cycleSummary} style={{ borderBottom: "none", paddingBottom: 0 }}>
        Optional. Used by the price-aware planner to drop or down-rank candidates whose flights
        don't fit your travel preferences.
      </p>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Max duration (min)</span>
          <input
            type="number"
            className={styles.input}
            min={0}
            value={maxDuration}
            placeholder="e.g. 240"
            onChange={(e) => setMaxDuration(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Combine</span>
          <select
            className={styles.input}
            value={combineMode}
            onChange={(e) => setCombineMode(e.target.value as "and" | "or")}
          >
            <option value="and">AND — all must pass</option>
            <option value="or">OR — at least one</option>
          </select>
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Depart after (hour)</span>
          <input
            type="number"
            className={styles.input}
            min={0}
            max={23}
            value={departAfter}
            placeholder="e.g. 18"
            onChange={(e) => setDepartAfter(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Arrive before (hour)</span>
          <input
            type="number"
            className={styles.input}
            min={0}
            max={23}
            value={arriveBefore}
            placeholder="e.g. 10"
            onChange={(e) => setArriveBefore(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button type="button" className={styles.primaryBtn} onClick={() => void onApply()}>
          Apply
        </button>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => void onClear()}
          style={{ alignSelf: "center" }}
        >
          clear
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};
