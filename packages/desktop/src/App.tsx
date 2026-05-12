import { useEffect, useState } from "react";
import { fromDayInt, type Session } from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";

import { bridge } from "./api/bridge.js";
import { buildDemoSession } from "./demo/demoSession.js";
import { Calendar } from "./views/Calendar/Calendar.js";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; session: Session; holidays: ReadonlyArray<Holiday>; isDemo: boolean }
  | { status: "error"; message: string };

export const App = (): JSX.Element => {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Try to load the active session.
        const activeId = await bridge.active.get();
        let session: Session | null = null;
        if (activeId !== null) {
          try {
            session = await bridge.sessions.load(activeId);
          } catch {
            session = null;
          }
        }
        if (session === null) {
          // No real session yet — show a beautiful demo so first-run isn't blank.
          const demo = buildDemoSession();
          // Holidays for the demo: try the bridge (works in Electron), fall
          // back to an empty set if running outside.
          let holidays: ReadonlyArray<Holiday> = [];
          try {
            const year = fromDayInt(demo.cycle.start).year;
            holidays = await bridge.holidays.forCountry(demo.residenceCountry, year);
          } catch {
            holidays = [];
          }
          if (!cancelled) setState({ status: "ready", session: demo, holidays, isDemo: true });
          return;
        }

        const year = fromDayInt(session.cycle.start).year;
        const holidays = await bridge.holidays.forCountry(session.residenceCountry, year);
        if (!cancelled) setState({ status: "ready", session, holidays, isDemo: false });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <main style={{ padding: 48, fontFamily: "var(--font-mono)", color: "var(--ink-tertiary)" }}>
        loading…
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main style={{ padding: 48 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>Something went wrong</h1>
        <pre style={{ fontFamily: "var(--font-mono)", color: "var(--accent-blocked)" }}>{state.message}</pre>
      </main>
    );
  }

  return <Calendar session={state.session} holidays={state.holidays} />;
};
