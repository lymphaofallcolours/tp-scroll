import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  readonly fallback?: (error: Error, reset: () => void) => ReactNode;
  readonly children: ReactNode;
};

type State = { readonly error: Error | null };

/**
 * Tiny boundary so a render crash in one view does not leave the user staring
 * at a blank page. The message is shown verbatim, plus a stack-trace excerpt
 * — what we want during development. In production the message field could be
 * sanitised, but this app has no remote rendering surface.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfacing to console means it lands in our renderer→main log forwarder.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error !== null) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <main style={{ padding: 48, maxWidth: 720 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--ink-tertiary)",
              marginBottom: 8,
            }}
          >
            tp-scroll · runtime error
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 32,
              fontWeight: 380,
              color: "var(--ink-primary)",
              marginBottom: 16,
            }}
          >
            Something just broke while rendering this view.
          </h1>
          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--accent-blocked)",
              background: "var(--surface-sunk)",
              padding: 16,
              borderRadius: 4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error.message}
            {this.state.error.stack ? `\n\n${this.state.error.stack.split("\n").slice(0, 6).join("\n")}` : null}
          </pre>
          <button
            type="button"
            onClick={this.reset}
            style={{
              marginTop: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "10px 18px",
              background: "var(--ink-primary)",
              color: "var(--surface-page)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            try again
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
