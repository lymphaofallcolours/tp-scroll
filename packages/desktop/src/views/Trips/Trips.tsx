import { computeTripCost, isoFromDayInt, type Trip } from "@tp-scroll/core";

import { useSessionStore } from "../../state/session.js";
import { useUiStore } from "../../state/ui.js";

import { TripForm } from "./TripForm.js";
import styles from "./Trips.module.css";

const tripDurationDays = (trip: Trip): number => trip.return - trip.departure + 1;

export const Trips = (): JSX.Element | null => {
  const session = useSessionStore((s) => s.session);
  const holidays = useSessionStore((s) => s.holidays);
  const isDemo = useSessionStore((s) => s.isDemo);
  const addTrip = useSessionStore((s) => s.addTrip);
  const updateTrip = useSessionStore((s) => s.updateTrip);
  const deleteTrip = useSessionStore((s) => s.deleteTrip);

  const tripBeingEdited = useUiStore((s) => s.tripBeingEdited);
  const tripPrefill = useUiStore((s) => s.tripPrefill);
  const openTripEditor = useUiStore((s) => s.openTripEditor);
  const closeTripEditor = useUiStore((s) => s.closeTripEditor);

  if (!session) return null;

  const sorted = [...session.trips].sort((a, b) => a.departure - b.departure);
  const holidaySet = new Set(holidays.map((h) => h.day));

  const editingTrip =
    tripBeingEdited === "new"
      ? null
      : tripBeingEdited === null
        ? undefined
        : session.trips.find((t) => t.id === tripBeingEdited) ?? null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>tp-scroll · trips</span>
          <h1 className={styles.title}>Your trips, recorded and imagined.</h1>
        </div>
        <button type="button" className={styles.addBtn} onClick={() => openTripEditor("new")}>
          + Add trip
        </button>
      </header>

      <div className={styles.list}>
        {sorted.length === 0 ? (
          <div className={styles.empty}>No trips yet. Hit "+ Add trip" to plant the first one.</div>
        ) : (
          sorted.map((trip) => {
            const cost = computeTripCost(trip, session, holidaySet);
            return (
              <button
                key={trip.id}
                type="button"
                className={styles.row}
                onClick={() => openTripEditor(trip.id)}
              >
                <div className={styles.rowDate}>
                  <span className={styles.rowDateMain}>
                    {isoFromDayInt(trip.departure)} → {isoFromDayInt(trip.return)}
                  </span>
                  <span className={styles.rowDateSub}>
                    {String(tripDurationDays(trip)).padStart(2, "0")}d · {cost.leaveCost}d leave
                  </span>
                </div>
                <div className={styles.rowNote}>
                  {trip.notes ?? <span style={{ color: "var(--ink-faint)" }}>—</span>}
                </div>
                <span className={trip.isActual ? styles.tagActual : styles.tagPlanned}>
                  {trip.isActual ? "actual" : "planned"}
                </span>
                <span className={styles.rowDateSub}>{trip.bucketId}</span>
                <span className={styles.rowDateSub}>↗</span>
              </button>
            );
          })
        )}
      </div>

      {tripBeingEdited !== null && editingTrip !== undefined && (
        <div className={styles.panelBackdrop} onClick={closeTripEditor}>
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <TripForm
              session={session}
              initial={editingTrip}
              prefill={tripPrefill}
              isDemo={isDemo}
              holidays={holidays}
              onSubmit={async (trip) => {
                if (editingTrip) {
                  await updateTrip(trip);
                } else {
                  await addTrip(trip);
                }
                closeTripEditor();
              }}
              onCancel={closeTripEditor}
              onDelete={
                editingTrip
                  ? async () => {
                      await deleteTrip(editingTrip.id);
                      closeTripEditor();
                    }
                  : null
              }
            />
          </div>
        </div>
      )}
    </main>
  );
};
