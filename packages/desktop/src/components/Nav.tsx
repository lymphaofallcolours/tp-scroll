import { useSessionStore } from "../state/session.js";
import { useUiStore, type View } from "../state/ui.js";

import styles from "./Nav.module.css";

const TABS: ReadonlyArray<{ view: View; label: string }> = [
  { view: "calendar", label: "Calendar" },
  { view: "trips", label: "Trips" },
  { view: "plan", label: "Plan" },
  { view: "insights", label: "Insights" },
  { view: "sessions", label: "Sessions" },
];

export const Nav = (): JSX.Element => {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const isDemo = useSessionStore((s) => s.isDemo);

  return (
    <nav className={styles.nav}>
      <span className={styles.brand}>
        <span className={styles.brandDot} />
        tp-scroll
      </span>
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.view}
            type="button"
            className={`${styles.tab} ${view === tab.view ? styles.tabActive : ""}`}
            onClick={() => setView(tab.view)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {isDemo && <span className={styles.demoFlag}>demo session</span>}
    </nav>
  );
};
