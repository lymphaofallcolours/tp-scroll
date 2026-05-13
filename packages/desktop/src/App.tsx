import { useEffect } from "react";

import { Nav } from "./components/Nav.js";
import { useSessionStore } from "./state/session.js";
import { useUiStore } from "./state/ui.js";
import { Burndown } from "./views/Burndown/Burndown.js";
import { Calendar } from "./views/Calendar/Calendar.js";
import { Plan } from "./views/Plan/Plan.js";
import { Sessions } from "./views/Sessions/Sessions.js";
import { Trips } from "./views/Trips/Trips.js";

export const App = (): JSX.Element => {
  const status = useSessionStore((s) => s.status);
  const session = useSessionStore((s) => s.session);
  const holidays = useSessionStore((s) => s.holidays);
  const homeHolidays = useSessionStore((s) => s.homeHolidays);
  const errorMessage = useSessionStore((s) => s.errorMessage);
  const init = useSessionStore((s) => s.init);
  const view = useUiStore((s) => s.view);

  useEffect(() => {
    void init();
  }, [init]);

  if (status === "loading" || status === "idle") {
    return (
      <main style={{ padding: 48, fontFamily: "var(--font-mono)", color: "var(--ink-tertiary)" }}>
        loading…
      </main>
    );
  }
  if (status === "error" || !session) {
    return (
      <main style={{ padding: 48 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>Something went wrong</h1>
        <pre style={{ fontFamily: "var(--font-mono)", color: "var(--accent-blocked)" }}>
          {errorMessage ?? "session unavailable"}
        </pre>
      </main>
    );
  }

  return (
    <>
      <Nav />
      {view === "calendar" && (
        <Calendar session={session} holidays={holidays} homeHolidays={homeHolidays} />
      )}
      {view === "trips" && <Trips />}
      {view === "plan" && <Plan />}
      {view === "burndown" && <Burndown />}
      {view === "sessions" && <Sessions />}
    </>
  );
};
