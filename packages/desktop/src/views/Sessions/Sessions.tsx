import { useEffect, useState } from "react";
import {
  bucketKindColor,
  dayIntFromIso,
  fromDayInt,
  isoFromDayInt,
  type BlockedPeriod,
  type BucketKind,
  type DepartureMode,
  type FlightConstraints,
  type RegionOverride,
  type Session,
} from "@tp-scroll/core";

import { bridge } from "../../api/bridge.js";
import type { FlightCredentialsStatus } from "../../api/types.js";
import { Hint } from "../../components/Hint.js";
import { useSessionStore } from "../../state/session.js";
import styles from "./Sessions.module.css";

const KIND_HINTS: Record<BucketKind, string> = {
  annual: "Your standard vacation allowance. The optimizer plans against this bucket by default.",
  sick: "Sick days. Tracked after-the-fact; the optimizer never plans into this bucket.",
  parental: "Parental leave. Longer absences, separately budgeted.",
  conference: "Work travel — usually requires manual approval; separate budget so it doesn't eat vacation.",
  other: "Anything else (jury duty, study leave, bereavement).",
};

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
  const setTripBounds = useSessionStore((s) => s.setTripBounds);
  const addBlocked = useSessionStore((s) => s.addBlocked);
  const deleteBlocked = useSessionStore((s) => s.deleteBlocked);
  const addRegion = useSessionStore((s) => s.addRegion);
  const deleteRegion = useSessionStore((s) => s.deleteRegion);
  const setCycleRules = useSessionStore((s) => s.setCycleRules);
  const setDepartureMode = useSessionStore((s) => s.setDepartureMode);

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

          {session && (
            <>
              <SectionHeader title="Cycle rules" subtitle="how leave is counted across the active cycle" />
              {!isDemo && (
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

              <CycleRulesCard
                session={session}
                onSetRules={async (patch) => setCycleRules(patch)}
                onSetDepartureMode={async (mode) => setDepartureMode(mode)}
              />

              <BucketsCard
                session={session}
                onAdd={async (input) => addBucket(input)}
              />

              <SectionHeader title="Trip rules" subtitle="what the optimizer is allowed to suggest" />

              <TripBoundsCard
                session={session}
                onSave={async (input) => setTripBounds(input)}
              />

              <RegionOverridesCard
                session={session}
                onAdd={async (input) => addRegion(input)}
                onDelete={async (id) => deleteRegion(id)}
              />

              <SectionHeader title="Constraints" subtitle="things that always apply" />

              <HomePeriodsCard
                session={session}
                onAdd={async (input) => addBlocked(input)}
                onDelete={async (start, end) => deleteBlocked(start, end)}
              />

              <FlightConstraintsCard
                constraints={session.flightConstraints ?? null}
                onSave={async (next) => setFlightConstraints(next)}
              />

              <SectionHeader title="Data" subtitle="external providers, stored locally" />

              <AmadeusCredentialsCard />
            </>
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
                <span className={styles.fieldLabel}>
                  Residence
                  <Hint text="ISO-3166 alpha-2 code of the country where you currently live and work. This is where your annual-leave contract is, where weekends/public holidays apply, and where trips depart FROM." />
                </span>
                <input
                  type="text"
                  className={styles.input}
                  maxLength={2}
                  value={createResidence}
                  onChange={(e) => setCreateResidence(e.target.value.toUpperCase())}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  Home
                  <Hint text="ISO-3166 alpha-2 code of the country you go HOME to — where your family/origin is. The optimizer's whole purpose is to maximise time here. Its public holidays appear as a teal corner marker on the calendar." />
                </span>
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

const SectionHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}): JSX.Element => (
  <div className={styles.sectionHeader}>
    <span className={styles.sectionHeaderTitle}>{title}</span>
    <span className={styles.sectionHeaderSubtitle}>{subtitle}</span>
  </div>
);

const CycleRulesCard = ({
  session,
  onSetRules,
  onSetDepartureMode,
}: {
  session: Session;
  onSetRules: (patch: {
    countWeekends?: boolean;
    countHolidays?: boolean;
    halfDaysAllowed?: boolean;
    bufferAtEnd?: number;
    carryover?: Session["cycle"]["carryover"];
  }) => Promise<void>;
  onSetDepartureMode: (mode: DepartureMode) => Promise<void>;
}): JSX.Element => {
  const { cycle, departureMode } = session;
  const [buffer, setBuffer] = useState(String(cycle.bufferAtEnd));
  const [carryMax, setCarryMax] = useState(
    cycle.carryover.mode === "cumulative" ? String(cycle.carryover.maxDays) : "5",
  );
  const [error, setError] = useState<string | null>(null);

  const handle = async (fn: () => Promise<void>): Promise<void> => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.columnTitle}>
        Cycle rules
        <Hint text="How leave consumption is counted day-by-day. Toggles take effect immediately for both the calendar view and the optimizer." />
      </h2>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={cycle.countWeekends}
          onChange={(e) => void handle(() => onSetRules({ countWeekends: e.target.checked }))}
        />
        <span>
          Count weekends as leave
          <Hint text="When on, Saturday/Sunday within a trip consume a leave-day. Most users keep this OFF — weekends are free." />
        </span>
      </label>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={cycle.countHolidays}
          onChange={(e) => void handle(() => onSetRules({ countHolidays: e.target.checked }))}
        />
        <span>
          Count public holidays as leave
          <Hint text="When on, residence-country public holidays inside a trip consume a leave-day. OFF (default) means holidays are free." />
        </span>
      </label>

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={cycle.halfDaysAllowed}
          onChange={(e) => void handle(() => onSetRules({ halfDaysAllowed: e.target.checked }))}
        />
        <span>
          Half-days allowed
          <Hint text="Enables the 'half day' override in the trip editor — charge 0.5 instead of 1 for a specific day. Useful when your employer supports half-day vacation." />
        </span>
      </label>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Departure mode
            <Hint text="last-home-day: departure day is your last day at residence (an evening flight). first-away-day: departure day starts at the destination. Affects Schengen day-counting but not leave accounting." />
          </span>
          <select
            className={styles.input}
            value={departureMode}
            onChange={(e) => void handle(() => onSetDepartureMode(e.target.value as DepartureMode))}
          >
            <option value="last-home-day">last-home-day</option>
            <option value="first-away-day">first-away-day</option>
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Buffer at end (days)
            <Hint text="Days reserved at the end of the cycle that the optimizer cannot plan into. Keeps a tail of leave-days unspent for emergencies." />
          </span>
          <input
            type="number"
            className={styles.input}
            min={0}
            max={cycle.totalDays}
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            onBlur={() => {
              const n = Number(buffer);
              if (Number.isFinite(n) && n >= 0 && n !== cycle.bufferAtEnd) {
                void handle(() => onSetRules({ bufferAtEnd: Math.floor(n) }));
              }
            }}
          />
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Carryover mode
            <Hint text="What happens to unused leave at cycle end. lose: forfeit. cumulative: roll over up to maxDays into the next cycle." />
          </span>
          <select
            className={styles.input}
            value={cycle.carryover.mode}
            onChange={(e) => {
              const mode = e.target.value as "lose" | "cumulative";
              const carryover =
                mode === "cumulative"
                  ? { mode: "cumulative" as const, maxDays: Number(carryMax) || 0 }
                  : { mode: "lose" as const };
              void handle(() => onSetRules({ carryover }));
            }}
          >
            <option value="lose">lose</option>
            <option value="cumulative">cumulative</option>
          </select>
        </div>
        {cycle.carryover.mode === "cumulative" && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Max carryover (days)
              <Hint text="Cap on how many unused days carry into the next cycle." />
            </span>
            <input
              type="number"
              className={styles.input}
              min={0}
              value={carryMax}
              onChange={(e) => setCarryMax(e.target.value)}
              onBlur={() => {
                const n = Number(carryMax);
                if (
                  Number.isFinite(n) &&
                  n >= 0 &&
                  cycle.carryover.mode === "cumulative" &&
                  n !== cycle.carryover.maxDays
                ) {
                  void handle(() =>
                    onSetRules({
                      carryover: { mode: "cumulative", maxDays: Math.floor(n) },
                    }),
                  );
                }
              }}
            />
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

const HomePeriodsCard = ({
  session,
  onAdd,
  onDelete,
}: {
  session: Session;
  onAdd: (input: BlockedPeriod) => Promise<void>;
  onDelete: (start: number, end: number) => Promise<void>;
}): JSX.Element => {
  const cycleStartIso = isoFromDayInt(session.cycle.start);
  const cycleEndIso = isoFromDayInt(session.cycle.end);

  const [fromIso, setFromIso] = useState(cycleStartIso);
  const [toIso, setToIso] = useState(cycleStartIso);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onAddClick = async (): Promise<void> => {
    setError(null);
    if (reason.trim().length === 0) {
      setError("give it a short label so you remember why");
      return;
    }
    try {
      await onAdd({
        start: dayIntFromIso(fromIso),
        end: dayIntFromIso(toIso),
        reason: reason.trim(),
      });
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const sorted = [...(session.blocked ?? [])].sort((a, b) => a.start - b.start);

  return (
    <div className={styles.card}>
      <h2 className={styles.columnTitle}>
        Mandatory home periods
        <Hint text="Days you've already committed to being home — family events, exams, blocked-by-teaching weeks. The optimizer will not plan any trip that overlaps these periods, but the days still count as home days in the score." />
      </h2>
      <p className={styles.cycleSummary} style={{ borderBottom: "none", paddingBottom: 0 }}>
        Cycle <strong>{cycleStartIso} → {cycleEndIso}</strong>. Add a range you know you'll be home for.
      </p>

      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          {sorted.map((b) => (
            <div
              key={`${b.start}-${b.end}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
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
              <span style={{ color: "var(--ink-primary)" }}>{b.reason}</span>
              <span style={{ color: "var(--ink-tertiary)", fontFeatureSettings: "'tnum' 1" }}>
                {isoFromDayInt(b.start)} → {isoFromDayInt(b.end)} · {b.end - b.start + 1}d
              </span>
              <button
                type="button"
                className={`${styles.linkBtn} ${styles.danger}`}
                onClick={() => void onDelete(b.start, b.end)}
              >
                delete
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>From</span>
          <input
            type="date"
            className={styles.input}
            value={fromIso}
            min={cycleStartIso}
            max={cycleEndIso}
            onChange={(e) => setFromIso(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>To</span>
          <input
            type="date"
            className={styles.input}
            value={toIso}
            min={cycleStartIso}
            max={cycleEndIso}
            onChange={(e) => setToIso(e.target.value)}
          />
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Why</span>
        <input
          type="text"
          className={styles.input}
          value={reason}
          placeholder="e.g. winter break at home"
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <button type="button" className={styles.primaryBtn} onClick={() => void onAddClick()}>
        Add period
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

const RegionOverridesCard = ({
  session,
  onAdd,
  onDelete,
}: {
  session: Session;
  onAdd: (input: RegionOverride) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}): JSX.Element => {
  const cycleStartIso = isoFromDayInt(session.cycle.start);
  const cycleEndIso = isoFromDayInt(session.cycle.end);

  const [name, setName] = useState("");
  const [fromIso, setFromIso] = useState(cycleStartIso);
  const [toIso, setToIso] = useState(cycleStartIso);
  const [minLen, setMinLen] = useState("");
  const [maxLen, setMaxLen] = useState("");
  const [error, setError] = useState<string | null>(null);

  const numOrUndef = (s: string): number | undefined => {
    if (s.trim().length === 0) return undefined;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
  };

  const onAddClick = async (): Promise<void> => {
    setError(null);
    if (name.trim().length === 0) {
      setError("give the region a name");
      return;
    }
    const id =
      `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${fromIso}`;
    try {
      const min = numOrUndef(minLen);
      const max = numOrUndef(maxLen);
      const region: RegionOverride = {
        id,
        name: name.trim(),
        start: dayIntFromIso(fromIso),
        end: dayIntFromIso(toIso),
        ...(min !== undefined ? { minTripDays: min } : {}),
        ...(max !== undefined ? { maxTripDays: max } : {}),
      };
      await onAdd(region);
      setName("");
      setMinLen("");
      setMaxLen("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const sorted = [...(session.regions ?? [])].sort((a, b) => a.start - b.start);

  return (
    <div className={styles.card}>
      <h2 className={styles.columnTitle}>
        Region overrides
        <Hint text="Time windows where trip-length bounds differ from the session defaults. Useful for 'allow 3-week trips during summer' or 'only 5+ day trips during exam season'. Leave a field blank to keep the session default for that bound. Gap and flight rules still apply globally." />
      </h2>
      <p className={styles.cycleSummary} style={{ borderBottom: "none", paddingBottom: 0 }}>
        Defaults: trips <strong>{session.minTripDays}–{session.maxTripDays}</strong> days.
      </p>

      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          {sorted.map((r) => {
            const minTxt = r.minTripDays !== undefined ? r.minTripDays : "·";
            const maxTxt = r.maxTripDays !== undefined ? r.maxTripDays : "·";
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
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
                <span style={{ color: "var(--ink-primary)" }}>{r.name}</span>
                <span style={{ color: "var(--ink-tertiary)", fontFeatureSettings: "'tnum' 1" }}>
                  {isoFromDayInt(r.start)} → {isoFromDayInt(r.end)}
                </span>
                <span style={{ color: "var(--ink-secondary)", fontFeatureSettings: "'tnum' 1" }}>
                  trips {minTxt}–{maxTxt}d
                </span>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.danger}`}
                  onClick={() => void onDelete(r.id)}
                >
                  delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          type="text"
          className={styles.input}
          value={name}
          placeholder="e.g. summer break"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>From</span>
          <input
            type="date"
            className={styles.input}
            value={fromIso}
            min={cycleStartIso}
            max={cycleEndIso}
            onChange={(e) => setFromIso(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>To</span>
          <input
            type="date"
            className={styles.input}
            value={toIso}
            min={cycleStartIso}
            max={cycleEndIso}
            onChange={(e) => setToIso(e.target.value)}
          />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Min trip (days)
            <Hint text="Leave blank to keep the session default. Optimizer will skip candidate trips shorter than this within the region." />
          </span>
          <input
            type="number"
            className={styles.input}
            min={1}
            value={minLen}
            placeholder={String(session.minTripDays)}
            onChange={(e) => setMinLen(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Max trip (days)
            <Hint text="Leave blank to keep the session default. Optimizer will consider candidate trips up to this length within the region — set higher than the global max to allow long summer trips." />
          </span>
          <input
            type="number"
            className={styles.input}
            min={1}
            value={maxLen}
            placeholder={String(session.maxTripDays)}
            onChange={(e) => setMaxLen(e.target.value)}
          />
        </div>
      </div>
      <button type="button" className={styles.primaryBtn} onClick={() => void onAddClick()}>
        Add region
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

const AmadeusCredentialsCard = (): JSX.Element => {
  const [status, setStatus] = useState<FlightCredentialsStatus | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const s = await bridge.flights.credentials.status();
        setStatus(s);
      } catch {
        // bridge unavailable (outside Electron) — leave status null
      }
    })();
  }, []);

  const onSave = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const next = await bridge.flights.credentials.set(clientId.trim(), clientSecret);
      setStatus(next);
      setClientId("");
      setClientSecret("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onClear = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const next = await bridge.flights.credentials.clear();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const sourceLabel = (() => {
    if (status === null) return "(loading)";
    if (status.offline === true) return "offline — provider disabled by TP_SCROLL_NETWORK=off";
    if (status.source === "env") return `env vars (${status.clientIdMasked ?? "•••"})`;
    if (status.source === "file") return `saved on disk (${status.clientIdMasked ?? "•••"})`;
    return "none — using mock prices";
  })();

  return (
    <div className={styles.card}>
      <h2 className={styles.columnTitle}>
        Flight provider credentials
        <Hint text="Real flight prices come from Amadeus Self-Service — a free developer plan with ample monthly quota. Paste your test-environment client id and secret here. They're stored in ~/.tp-scroll/flights.json with 0600 permissions and never leave your machine except to call the Amadeus API." />
      </h2>
      <p className={styles.cycleSummary} style={{ borderBottom: "none", paddingBottom: 0 }}>
        Provider: <strong>{status?.providerName ?? "…"}</strong> · Source:{" "}
        <strong>{sourceLabel}</strong>
      </p>

      {status?.source === "env" && (
        <p className={styles.cycleSummary} style={{ borderBottom: "none", paddingBottom: 0 }}>
          Environment variables are set, so they take precedence. To use UI-saved credentials
          instead, unset <code>TP_SCROLL_AMADEUS_CLIENT_ID</code> and restart.
        </p>
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          Client ID
          <Hint text="From dashboard.amadeus.com → My Self-Service Workspace → App → API Key" />
        </span>
        <input
          type="text"
          className={styles.input}
          autoComplete="off"
          spellCheck={false}
          value={clientId}
          placeholder="paste API key"
          disabled={busy || status?.source === "env"}
          onChange={(e) => setClientId(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          Client Secret
          <Hint text="From the same Amadeus app page. Stored on disk with 0600 permissions; never printed in logs." />
        </span>
        <input
          type={showSecret ? "text" : "password"}
          className={styles.input}
          autoComplete="off"
          spellCheck={false}
          value={clientSecret}
          placeholder="paste API secret"
          disabled={busy || status?.source === "env"}
          onChange={(e) => setClientSecret(e.target.value)}
        />
        <button
          type="button"
          className={styles.linkBtn}
          style={{ alignSelf: "flex-start", marginTop: 4 }}
          onClick={() => setShowSecret((v) => !v)}
        >
          {showSecret ? "hide" : "show"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy || status?.source === "env" || clientId.trim().length === 0 || clientSecret.length === 0}
          onClick={() => void onSave()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {status?.source === "file" && (
          <button
            type="button"
            className={styles.linkBtn}
            disabled={busy}
            onClick={() => void onClear()}
            style={{ alignSelf: "center" }}
          >
            clear stored credentials
          </button>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

const TripBoundsCard = ({
  session,
  onSave,
}: {
  session: Session;
  onSave: (input: {
    minTripDays: number;
    maxTripDays: number;
    minGapDays: number;
    maxGapDays: number;
  }) => Promise<void>;
}): JSX.Element => {
  const [minLen, setMinLen] = useState(String(session.minTripDays));
  const [maxLen, setMaxLen] = useState(String(session.maxTripDays));
  const [minGap, setMinGap] = useState(String(session.minGapDays));
  const [maxGap, setMaxGap] = useState(String(session.maxGapDays));
  const [error, setError] = useState<string | null>(null);

  const onApply = async (): Promise<void> => {
    setError(null);
    try {
      await onSave({
        minTripDays: Number(minLen),
        maxTripDays: Number(maxLen),
        minGapDays: Number(minGap),
        maxGapDays: Number(maxGap),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.columnTitle}>
        Trip bounds
        <Hint text="Shape what the optimizer considers a reasonable trip — both the length of each trip and the spacing between them." />
      </h2>
      <p className={styles.cycleSummary} style={{ borderBottom: "none", paddingBottom: 0 }}>
        Trips <strong>{session.minTripDays}–{session.maxTripDays}</strong> days,
        spaced <strong>{session.minGapDays}–{session.maxGapDays}</strong> days apart.
      </p>

      <div className={styles.subhead}>
        Length
        <Hint text="The optimizer only considers candidate trips within this length range. Tighten to avoid one-day overnighters or three-week absences; widen to let the planner consider both." />
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Min days
            <Hint text="The optimizer skips candidate trips shorter than this." />
          </span>
          <input
            type="number"
            className={styles.input}
            min={1}
            value={minLen}
            onChange={(e) => setMinLen(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Max days
            <Hint text="The optimizer skips candidate trips longer than this." />
          </span>
          <input
            type="number"
            className={styles.input}
            min={1}
            value={maxLen}
            onChange={(e) => setMaxLen(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.subhead}>
        Gap between trips
        <Hint text="Calendar days strictly between consecutive trips. A gap of 0 allows back-to-back; a gap of 5 means a full workweek at home between them. Applies only between trips — never to the cycle's start or end." />
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Min gap
            <Hint text="Minimum home-days between trips. Set to e.g. 14 to forbid back-to-back trips and give yourself recovery time." />
          </span>
          <input
            type="number"
            className={styles.input}
            min={0}
            value={minGap}
            onChange={(e) => setMinGap(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Max gap
            <Hint text="Maximum home-days between trips. Set to e.g. 90 to forbid long stretches without a break. Use 365 (default) to disable." />
          </span>
          <input
            type="number"
            className={styles.input}
            min={0}
            value={maxGap}
            onChange={(e) => setMaxGap(e.target.value)}
          />
        </div>
      </div>

      <button type="button" className={styles.primaryBtn} onClick={() => void onApply()}>
        Apply
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
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
      <h2 className={styles.columnTitle}>
        Buckets
        <Hint text="A bucket is a separate allowance of leave days. Most people only need one (annual). Add more if your employer tracks sick days, parental leave, or conference travel separately." />
      </h2>
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
              <span className={styles.fieldLabel}>
                Kind
                <Hint text={KIND_HINTS[bKind]} />
              </span>
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
      <h2 className={styles.columnTitle}>
        Flight constraints
        <Hint text="Tells the price-aware planner which flights are acceptable. Set max duration to drop long-haul routes, depart-after to skip dawn flights, arrive-before to be home for dinner." />
      </h2>
      <p className={styles.cycleSummary} style={{ borderBottom: "none", paddingBottom: 0 }}>
        Optional. Used by the price-aware planner to drop or down-rank candidates whose flights
        don't fit your travel preferences.
      </p>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Max duration (min)
            <Hint text="Maximum flight length in minutes for either leg of any trip. 240 = 4 hours. Leave blank for no limit." />
          </span>
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
          <span className={styles.fieldLabel}>
            Combine
            <Hint text="AND requires every set constraint to pass. OR requires at least one — useful for 'I'd accept a late departure OR an early arrival'." />
          </span>
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
          <span className={styles.fieldLabel}>
            Depart after (hour)
            <Hint text="0-23, local time. Only flights departing at or after this hour pass. 18 = leave only on evening flights." />
          </span>
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
          <span className={styles.fieldLabel}>
            Arrive before (hour)
            <Hint text="0-23, local time. Only flights arriving strictly before this hour pass. 10 = home before mid-morning." />
          </span>
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
