/* Thinking orbs — the design system's staged loading indicator.
   Styles live in app/design-system.css; showcase at /design-system.
   thinking = waiting on something external · working = measurable progress
   underway · done = orbs collapse into the success check. */

export type OrbMode = "thinking" | "working" | "done";

export function Orbs({
  mode,
  size = "md",
}: {
  mode: OrbMode;
  size?: "md" | "sm";
}) {
  const check = size === "sm" ? 14 : 20;
  return (
    <span className={`goo-${size}`}>
      <span className={`orbs orbs-${size} orbs-${mode}`} aria-hidden>
        <span className="orb" />
        <span className="orb" />
        <span className="orb" />
        {mode === "done" && (
          <span className="orb-check">
            <svg width={check} height={check} viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="9" className="fill-success" />
              <path
                d="M6 10.2l2.6 2.6L14 7.4"
                className="stroke-success-bg"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </span>
      <GooDefs />
    </span>
  );
}

/* SVG alpha filters for the goo effect. Duplicate ids from multiple Orbs
   instances are harmless — browsers resolve the first match. */
function GooDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <filter id="ds-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix
            in="blur"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
        <filter id="ds-goo-sm">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
