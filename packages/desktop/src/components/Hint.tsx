import { useState } from "react";

import styles from "./Hint.module.css";

type Props = {
  readonly text: string;
};

/**
 * Tiny help marker — a circled `?` next to a label that reveals a tooltip on
 * hover/focus. Used wherever a UI term needs explanation (bucket kinds,
 * "diverse", "price-aware", flight constraints, etc.).
 *
 * Implemented as a CSS-positioned tooltip rather than a portal so it composes
 * cleanly inside form labels, table headers, and chip captions.
 */
export const Hint = ({ text }: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={styles.wrapper}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="note"
      aria-label={text}
    >
      <span className={styles.marker}>?</span>
      {open && <span className={styles.tooltip}>{text}</span>}
    </span>
  );
};
