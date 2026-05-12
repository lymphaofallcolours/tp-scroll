import { useEffect, useState } from "react";

import { bridge } from "./api/bridge.js";

export const App = (): JSX.Element => {
  const [status, setStatus] = useState<string>("loading…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const today = await bridge.clock.today();
        const sessions = await bridge.sessions.list();
        if (cancelled) return;
        const lines = [
          `today: day ${today}`,
          `sessions: ${sessions.length === 0 ? "none yet" : sessions.map((s) => s.name).join(", ")}`,
        ];
        setStatus(lines.join("\n"));
      } catch (err) {
        if (cancelled) return;
        setStatus(`bridge error: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-line" }}>
      <h1 style={{ fontWeight: 400, fontSize: 32, marginBottom: 16 }}>tp-scroll</h1>
      <pre style={{ fontFamily: "inherit", margin: 0 }}>{status}</pre>
    </main>
  );
};
