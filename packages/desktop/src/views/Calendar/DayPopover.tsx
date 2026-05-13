import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fromDayInt, isoFromDayInt, type DayInt, type Session } from "@tp-scroll/core";

import { useSessionStore } from "../../state/session.js";
import { useUiStore } from "../../state/ui.js";

import type { DayCell } from "./calendar-data.js";
import styles from "./DayPopover.module.css";

type Props = {
  readonly cell: DayCell;
  readonly anchorRect: DOMRect;
  readonly session: Session;
  readonly onClose: () => void;
};

/**
 * Floating panel that appears next to a clicked calendar cell. Contextual
 * actions are inferred from the cell's `kind` — empty weekday gets "add trip",
 * trip days get "open in trips tab", blocked days get a "remove block" button,
 * holiday days are read-only with the name.
 *
 * Positioning: we render via a portal anchored to document.body, then read the
 * passed-in DOMRect to place the panel below the cell (flipped to above when
 * the cell is near the viewport bottom). Horizontal centre is clamped to the
 * viewport edges so the panel never gets cut off.
 */
export const DayPopover = ({ cell, anchorRect, session, onClose }: Props): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const setView = useUiStore((s) => s.setView);
  const openTripEditor = useUiStore((s) => s.openTripEditor);
  const addAnchor = useSessionStore((s) => s.addAnchor);
  const deleteAnchor = useSessionStore((s) => s.deleteAnchor);
  const addBlocked = useSessionStore((s) => s.addBlocked);
  const deleteBlocked = useSessionStore((s) => s.deleteBlocked);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Position after first render so we can measure the panel and flip if
  // necessary.
  useEffect(() => {
    if (ref.current === null) return;
    const rect = ref.current.getBoundingClientRect();
    const margin = 8;
    let top = anchorRect.bottom + margin;
    if (top + rect.height > window.innerHeight - margin) {
      top = anchorRect.top - margin - rect.height;
    }
    let left = anchorRect.left + anchorRect.width / 2 - rect.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - rect.width));
    setPos({ top, left });
  }, [anchorRect]);

  const dateLabel = fromDayInt(cell.day).toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isAnchor = session.anchors.some((a) => a.day === cell.day);
  const blockedAtDay = session.blocked.find(
    (b) => cell.day >= b.start && cell.day <= b.end,
  );
  const tripAtDay = session.trips.find(
    (t) => cell.day >= t.departure && cell.day <= t.return,
  );

  const onAddTrip = (): void => {
    const bucket =
      session.buckets.find((b) => b.kind === "annual")?.id ?? session.buckets[0]?.id;
    if (!bucket) return;
    openTripEditor("new", {
      departure: cell.day as DayInt,
      return: cell.day as DayInt,
      bucketId: bucket,
      isActual: false,
    });
    setView("trips");
    onClose();
  };

  const onToggleAnchor = (): void => {
    if (isAnchor) {
      void deleteAnchor(cell.day);
    } else {
      void addAnchor({ day: cell.day as DayInt, preferIn: "home", weight: 5 });
    }
    onClose();
  };

  const onBlock = (): void => {
    void addBlocked({
      start: cell.day as DayInt,
      end: cell.day as DayInt,
      reason: `block ${isoFromDayInt(cell.day)}`,
    });
    onClose();
  };

  const onUnblock = (): void => {
    if (!blockedAtDay) return;
    void deleteBlocked(blockedAtDay.start, blockedAtDay.end);
    onClose();
  };

  const onOpenTrip = (): void => {
    if (!tripAtDay) return;
    openTripEditor(tripAtDay.id);
    setView("trips");
    onClose();
  };

  const panel = (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        ref={ref}
        className={styles.panel}
        role="dialog"
        aria-label={`Actions for ${dateLabel}`}
        style={pos !== null ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.kicker}>{isoFromDayInt(cell.day)}</div>
          <div className={styles.date}>{dateLabel}</div>
          {cell.holidayName && (
            <div className={styles.holidayName}>
              <em>“{cell.holidayName}”</em>
              {cell.homeHoliday === true ? ` · ${session.homeCountry} holiday` : ` · ${session.residenceCountry} holiday`}
            </div>
          )}
          {blockedAtDay && (
            <div className={styles.blockedNote}>
              blocked: <em>{blockedAtDay.reason}</em>
              {" · "}
              {isoFromDayInt(blockedAtDay.start)} → {isoFromDayInt(blockedAtDay.end)}
            </div>
          )}
          {tripAtDay && (
            <div className={styles.tripNote}>
              {tripAtDay.isActual ? "actual" : "planned"} trip:{" "}
              <em>{tripAtDay.notes ?? tripAtDay.id}</em>
              {" · "}
              {isoFromDayInt(tripAtDay.departure)} → {isoFromDayInt(tripAtDay.return)}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {tripAtDay ? (
            <button type="button" className={styles.actionBtn} onClick={onOpenTrip}>
              Open trip in Trips tab
            </button>
          ) : blockedAtDay ? (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={onUnblock}
            >
              Remove block
            </button>
          ) : (
            <>
              <button type="button" className={styles.actionBtn} onClick={onAddTrip}>
                Add trip from here
              </button>
              <button type="button" className={styles.actionBtn} onClick={onBlock}>
                Block this day
              </button>
            </>
          )}
          {!tripAtDay && !blockedAtDay && (
            <button type="button" className={styles.actionBtn} onClick={onToggleAnchor}>
              {isAnchor ? "Remove anchor" : "Mark as anchor"}
            </button>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
};
