/* Shared class recipes from the design system.
   Tokens: app/design-system.css · showcase: /design-system.
   Buttons take a size at the callsite (px-4 py-2 default, px-3 py-1.5 mini). */

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full text-small font-medium transition-[color,background-color,border-color,transform] duration-160 ease-out-quad active:scale-97 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 disabled:opacity-45 disabled:pointer-events-none";

export const btnPrimary = `${btnBase} bg-invert text-invert-text hover:bg-invert-hover`;
export const btnSecondary = `${btnBase} bg-surface-raised border border-border hover:bg-surface-hover`;
export const btnGhost = `${btnBase} text-text-muted hover:bg-surface-hover hover:text-text`;
export const btnDanger = `${btnBase} text-danger border border-danger hover:bg-danger-bg`;

export const inputBase =
  "w-full rounded-lg bg-surface-sunken border border-border-strong px-3 py-2 text-small outline-none transition-colors duration-120 focus:border-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2";

export const eyebrow =
  "text-caption font-medium uppercase tracking-[0.04em] text-text-faint";

export const badgeBase =
  "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-sm text-caption border";

export type OrderStatus = "open" | "locked" | "placed";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const styles = {
    open: "bg-success-bg border-success text-success",
    locked: "bg-surface-raised border-border text-text-muted",
    placed: "bg-brand-bg border-brand text-brand-text",
  }[status];
  const label = { open: "Open", locked: "Locked", placed: "Placed" }[status];
  return (
    <span className={`${badgeBase} ${styles}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export function Spinner({ onDark }: { onDark?: boolean }) {
  return (
    <span
      className={`size-4 rounded-full border-2 animate-spinner ${
        onDark
          ? "border-invert-text/30 border-t-invert-text"
          : "border-border border-t-brand"
      }`}
      aria-hidden
    />
  );
}
