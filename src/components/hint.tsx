import { CircleHelp } from "lucide-react";
import { useState } from "react";

export function Hint({ children, label = "More information" }: { children: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="hint-wrap relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-grid size-5 place-items-center rounded-full text-muted hover:bg-mist hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
      >
        <CircleHelp className="size-4" />
      </button>
      <span role="tooltip" className={`hint-popover absolute left-1/2 top-full z-40 mt-2 w-60 -translate-x-1/2 border border-border bg-bg-elevated p-3 text-left text-xs leading-relaxed text-fg shadow-lg ${open ? "is-open" : ""}`}>
        {children}
      </span>
    </span>
  );
}
