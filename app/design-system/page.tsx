import type { Metadata } from "next";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputBase,
  Spinner,
} from "@/components/ui";
import { Orbs } from "@/components/Orbs";

export const metadata: Metadata = {
  title: "Design system · Erewhon Group Cart",
  description:
    "Tokens and components — paper light theme with forest greens.",
};

/* Showcase for app/design-system.css. Theme is paper light with
   forest greens and an orange accent. Light-only by design — this page
   renders on its own surface tokens regardless of OS color scheme. */

const SECTIONS = [
  ["color", "Color"],
  ["typography", "Typography"],
  ["spacing", "Spacing"],
  ["shape", "Shape & depth"],
  ["motion", "Motion"],
  ["components", "Components"],
] as const;

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-surface text-text text-body font-sans">
      <header className="sticky top-0 z-10 h-14 bg-surface/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-4xl h-full px-6 flex items-center justify-between">
          <span className="text-h3 font-semibold">
            Erewhon <span className="text-text-muted">design system</span>
          </span>
          <nav className="flex items-center gap-4">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-small text-text-muted hover:text-text transition-colors duration-120"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <section className="pt-16 pb-4">
          <h1 className="font-display text-display">
            Paper, forest, one flame.
          </h1>
          <p className="mt-4 max-w-xl text-text-muted">
            Warm, quiet, engineered. Forest greens as the ink and the action
            color on warm paper, hairline borders instead of
            shadows, serif display type for the editorial moments, and one
            orange accent spent sparingly. Numbers are the heroes — money and
            counts get the mono treatment; chrome stays green and silent.
          </p>
          <p className="mt-3 text-caption text-text-faint">
            Tokens live in <Code>app/design-system.css</Code>. Use tokens, never
            raw hex or px. Light-only; dark is a later drop-in.
          </p>
        </section>

        {/* ============ COLOR ============ */}
        <Section id="color" title="Color">
          <SubHead>Surfaces — the paper ramp</SubHead>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Swatch name="surface" hex="#f8f7f2" className="bg-surface" />
            <Swatch
              name="surface-raised"
              hex="#fdfcf9"
              className="bg-surface-raised"
            />
            <Swatch
              name="surface-sunken"
              hex="#efeee6"
              className="bg-surface-sunken"
            />
            <Swatch
              name="surface-hover"
              hex="#ecebe2"
              className="bg-surface-hover"
            />
          </div>

          <SubHead>Ink — forest green, three strengths</SubHead>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Swatch name="text" hex="#1a3930" className="bg-text" />
            <Swatch
              name="text-muted"
              hex="#52645c"
              className="bg-text-muted"
            />
            <Swatch
              name="text-faint"
              hex="#5e7268"
              className="bg-text-faint"
            />
            <Swatch
              name="border / -strong"
              hex="#e2e3da / #c9cec3"
              className="bg-border"
            />
          </div>

          <SubHead>Brand — the one orange, and the green CTA fill</SubHead>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Swatch name="brand" hex="#e75a2e" className="bg-brand" />
            <Swatch
              name="brand-text"
              hex="#bc4218"
              className="bg-brand-text"
            />
            <Swatch name="brand-bg" hex="#fbe9e0" className="bg-brand-bg" />
            <Swatch name="invert" hex="#1a3930" className="bg-invert" />
          </div>

          <SubHead>Semantic pairs</SubHead>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SemanticSwatch
              name="success"
              className="bg-success-bg text-success border-success"
            />
            <SemanticSwatch
              name="warning"
              className="bg-warning-bg text-warning border-warning"
            />
            <SemanticSwatch
              name="danger"
              className="bg-danger-bg text-danger border-danger"
            />
            <SemanticSwatch
              name="info"
              className="bg-info-bg text-info border-info"
            />
          </div>

          <SubHead>Data ramp — mint to forest, magnitude only</SubHead>
          <div className="flex rounded-lg overflow-hidden border border-border">
            {["bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4", "bg-heat-5"].map(
              (c) => (
                <div key={c} className={`h-10 flex-1 ${c}`} />
              ),
            )}
          </div>

          <Rules
            items={[
              "Orange appears at most once per view region — an active state, a link, a key highlight. Never large fills, never button backgrounds.",
              "CTAs are the forest-green invert pill, not orange.",
              "Never pure #000 or decorative semantic colors; depth comes from the surface ramp plus hairline borders.",
              "All fg/bg pairs pass WCAG AA — brand-colored text always uses brand-text (#bc4218), never raw brand orange.",
            ]}
          />
        </Section>

        {/* ============ TYPOGRAPHY ============ */}
        <Section id="typography" title="Typography">
          <div className="flex flex-col gap-5">
            <TypeRow spec="display · 32/38 · 590 · Fraunces">
              <p className="font-display text-display">One cart, one delivery</p>
            </TypeRow>
            <TypeRow spec="h1 · 24/30 · 590 · Fraunces">
              <p className="font-display text-h1">Friday office order</p>
            </TypeRow>
            <TypeRow spec="h2 · 18/24 · 590">
              <p className="text-h2 font-semibold">Section heading</p>
            </TypeRow>
            <TypeRow spec="h3 · 15/21 · 590">
              <p className="text-h3 font-semibold">Card and panel titles</p>
            </TypeRow>
            <TypeRow spec="body · 14/21 · 400">
              <p className="text-body">
                Default UI text. Share the link in Slack and everyone adds their
                items to one shared cart.
              </p>
            </TypeRow>
            <TypeRow spec="small · 13/19 · 400">
              <p className="text-small">
                Table cells, dense UI, buttons — the working size.
              </p>
            </TypeRow>
            <TypeRow spec="caption · 12/16 · 400">
              <p className="text-caption text-text-faint">
                Meta, timestamps, axis labels
              </p>
            </TypeRow>
            <TypeRow spec="mono · money & counts · 680 when key">
              <p className="font-mono text-body font-bold">
                $128.40 <span className="font-normal text-text-muted">· 23 items · #ORD-4821</span>
              </p>
            </TypeRow>
          </div>
          <Rules
            items={[
              "Two families: Fraunces (serif) for display and h1 only — the editorial moment; Geist for everything else.",
              "Sentence case everywhere. All-caps only for table column headers (caption size, +0.04em, text-faint).",
              "Money and counts always mono, weight 680 when they are the row's point.",
              "Fixed ramp — do not invent sizes. Weights: 400 body, 510 labels, 590 headings, 680 key numerals.",
            ]}
          />
        </Section>

        {/* ============ SPACING ============ */}
        <Section id="spacing" title="Spacing">
          <div className="flex items-end gap-3">
            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <div
                  className="w-6 bg-success-bg border border-success/40 rounded-sm"
                  style={{ height: `${n * 4}px` }}
                />
                <span className="text-caption text-text-faint font-mono">
                  {n * 4}
                </span>
              </div>
            ))}
          </div>
          <Rules
            items={[
              "4px base unit; layout spacing uses ramp multiples only: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.",
              "Card padding 16px · dialog 20px · page gutters 24px · section gaps 32px · table cells 8×12px · chips 2×8px.",
              "Compact-dashboard density: generous gaps between panels, dense inside them.",
            ]}
          />
        </Section>

        {/* ============ SHAPE & DEPTH ============ */}
        <Section id="shape" title="Shape & depth">
          <div className="flex flex-wrap items-center gap-6">
            {(
              [
                ["rounded-sm", "4px · badges"],
                ["rounded-lg", "8px · cards, inputs"],
                ["rounded-xl", "12px · dialogs"],
                ["rounded-full", "pill · buttons"],
              ] as const
            ).map(([cls, label]) => (
              <div key={cls} className="flex flex-col items-center gap-2">
                <div
                  className={`size-16 bg-surface-raised border border-border ${cls}`}
                />
                <span className="text-caption text-text-faint">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 grid sm:grid-cols-3 gap-6">
            {(
              [
                ["shadow-sm", "sticky headers"],
                ["shadow-md", "menus, popovers"],
                ["shadow-lg", "dialogs"],
              ] as const
            ).map(([cls, label]) => (
              <div
                key={cls}
                className={`rounded-lg bg-surface-raised border border-border p-4 ${cls}`}
              >
                <p className="text-h3 font-semibold font-mono">{cls}</p>
                <p className="text-caption text-text-faint mt-1">{label}</p>
              </div>
            ))}
          </div>
          <Rules
            items={[
              "Borders first: flat fills off the paper ramp with 1px hairlines are the entire depth system for in-flow UI.",
              "Shadows are a budget spent only on things that float — menus, popovers, dialogs. A card in the page flow never has a shadow.",
              "Focus: 2px brand-orange outline, offset 2px, on every focusable element. Disabled: opacity 0.45, no pointer events.",
            ]}
          />
        </Section>

        {/* ============ MOTION ============ */}
        <Section id="motion" title="Motion">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-small">
              <thead>
                <tr className="bg-surface-raised text-left">
                  <Th>Token</Th>
                  <Th>Value</Th>
                  <Th>Used for</Th>
                </tr>
              </thead>
              <tbody>
                <MotionRow t="ease-out-quad" v=".25,.46,.45,.94" u="hovers, presses, color shifts" />
                <MotionRow t="ease-out-quart" v=".25,1,.5,1" u="entrances: menus, popovers, rows" />
                <MotionRow t="duration-fast" v="120ms" u="hover color and border swaps" />
                <MotionRow t="duration-base" v="160ms" u="buttons, menus, toggles" />
                <MotionRow t="duration-slow" v="240ms" u="dialogs, drawers, panel slides" />
                <MotionRow t="animate-rise-in" v="4px rise + fade" u="the signature entrance" />
              </tbody>
            </table>
          </div>
          <Rules
            items={[
              "Animate transform, opacity, and color only — never layout. No springs, no bounces, no scroll-triggered effects.",
              "Press = scale(0.97) on all buttons. Hover is a flat color swap — no lift.",
              "Everything respects prefers-reduced-motion.",
            ]}
          />
        </Section>

        {/* ============ COMPONENTS ============ */}
        <Section id="components" title="Components">
          <SubHead>Buttons — pill, 13px/510, press scale(.97)</SubHead>
          <div className="flex flex-wrap items-center gap-3">
            <BtnPrimary>Place group order</BtnPrimary>
            <BtnSecondary>Copy link</BtnSecondary>
            <button className={`${btnGhost} px-4 py-2`}>Ghost</button>
            <button className={`${btnDanger} px-4 py-2`}>Remove item</button>
            <button disabled className={`${btnPrimary} px-4 py-2`}>
              Disabled
            </button>
            <button className={`${btnPrimary} px-4 py-2`}>
              <Spinner onDark />
              Placing…
            </button>
          </div>

          <SubHead>Badges & chips — 22px, caption size, semantic tint + dot</SubHead>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-surface-raised border-border text-text-muted">
              Neutral
            </Badge>
            <Badge className="bg-brand-bg border-brand text-brand-text">
              Organizer
            </Badge>
            <Badge dot className="bg-success-bg border-success text-success">
              Open
            </Badge>
            <Badge dot className="bg-warning-bg border-warning text-warning">
              Closing soon
            </Badge>
            <Badge dot className="bg-danger-bg border-danger text-danger">
              Locked
            </Badge>
            <Badge dot className="bg-info-bg border-info text-info">
              Placing
            </Badge>
            <button className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-sm text-caption border bg-surface-raised border-border text-text-muted hover:bg-surface-hover transition-colors duration-120 cursor-pointer">
              Grove store <span aria-hidden>×</span>
            </button>
          </div>

          <SubHead>Inputs & select</SubHead>
          <div className="grid sm:grid-cols-3 gap-5 max-w-2xl">
            <Field label="Order name">
              <input placeholder="Friday office order" className={inputBase} />
            </Field>
            <Field label="Deadline" error="Deadline must be in the future.">
              <input
                defaultValue="Yesterday, 4:00 PM"
                className={`${inputBase} border-danger`}
              />
            </Field>
            <Field label="Store">
              <select className={inputBase} defaultValue="grove">
                <option value="grove">Grove</option>
                <option value="venice">Venice</option>
                <option value="studio-city">Studio City</option>
              </select>
            </Field>
          </div>
          <p className="mt-4 text-body">
            Inline links use brand-text:{" "}
            <a
              href="#components"
              className="text-brand-text hover:text-brand-hover hover:underline transition-colors duration-120"
            >
              view the shared cart
            </a>
            .
          </p>

          <SubHead>Card & alert</SubHead>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="rounded-lg bg-surface-raised border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-h3 font-semibold">Friday office order</p>
                  <p className="text-caption text-text-faint mt-0.5">
                    Grove · closes today 3:00 PM
                  </p>
                </div>
                <Badge dot className="bg-success-bg border-success text-success">
                  Open
                </Badge>
              </div>
              <p className="mt-3 text-small text-text-muted">
                8 people · <span className="font-mono font-bold text-text">$342.75</span>
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Alert
                className="bg-success-bg border-success"
                title="Order placed"
                titleClass="text-success"
                body="Confirmation #ORD-4821 from erewhon.com."
              />
              <Alert
                className="bg-warning-bg border-warning"
                title="Cart closes in 10 minutes"
                titleClass="text-warning"
                body="Items added after the deadline won't make it in."
              />
            </div>
          </div>

          <SubHead>Tabs</SubHead>
          <div className="flex gap-5 border-b border-border">
            {["Cart", "People", "History"].map((t, i) => (
              <button
                key={t}
                className={`pb-2 text-small font-medium -mb-px transition-colors duration-120 ${
                  i === 0
                    ? "text-text border-b-2 border-brand"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <SubHead>Data table — mono money, hover rows, brand-edge selection</SubHead>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-small">
              <thead>
                <tr className="bg-surface-raised text-left">
                  <Th>Person</Th>
                  <Th>Items</Th>
                  <Th right>Subtotal</Th>
                </tr>
              </thead>
              <tbody>
                <PersonRow name="Maya K." items={6} subtotal="$84.20" />
                <PersonRow name="Jenson C." items={4} subtotal="$61.15" selected />
                <PersonRow name="Priya S." items={9} subtotal="$128.40" />
                <PersonRow name="Tom R." items={3} subtotal="$42.00" />
              </tbody>
            </table>
          </div>

          <SubHead>Meter, avatar, tooltip</SubHead>
          <div className="grid sm:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-3 max-w-xs">
              <Meter label="Minimum for free delivery" value={0.86} barClass="bg-success" pct="86%" />
              <Meter label="Cold-pack capacity" value={0.52} barClass="bg-warning" pct="52%" />
              <Meter label="Time remaining" value={0.14} barClass="bg-danger" pct="14%" />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex -space-x-2">
                {["MK", "JC", "PS"].map((i) => (
                  <span
                    key={i}
                    className="size-8 rounded-full bg-surface-hover border border-border flex items-center justify-center text-caption font-medium text-text-muted"
                  >
                    {i}
                  </span>
                ))}
              </div>
              <span className="rounded-sm bg-surface-sunken border border-border px-2 py-1 text-caption shadow-md">
                3 people have added items
              </span>
            </div>
          </div>

          <SubHead>Thinking orbs — staged waits</SubHead>
          <div className="grid sm:grid-cols-3 gap-5">
            {(
              [
                ["thinking", "Thinking", "Slow drift + merge. Waiting on something external."],
                ["working", "Working", "Directional relay. Measurable progress underway."],
                ["done", "Done", "Orbs collapse into the success check."],
              ] as const
            ).map(([mode, label, use]) => (
              <div
                key={mode}
                className="rounded-lg border border-border bg-surface-raised p-4 flex flex-col items-center gap-1.5"
              >
                <Orbs mode={mode} />
                <p className="text-small font-medium">{label}</p>
                <p className="text-caption text-text-faint text-center">{use}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-small text-text-muted">
            For waits over a couple of seconds, pair the orbs with a status line
            that names the actual stage (see the order room&apos;s Erewhon
            transfer). The small size replaces the spinner where the wait is
            ambient, like catalog search.
          </p>

          <SubHead>Empty state, skeleton, spinner</SubHead>
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="rounded-lg border border-border bg-surface-raised py-8 px-4 text-center">
              <p className="text-h3 font-semibold">No items yet</p>
              <p className="text-small text-text-muted mt-1">
                Share the link to get the cart going.
              </p>
              <div className="mt-4 flex justify-center">
                <BtnSecondary>Copy link</BtnSecondary>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-4 flex flex-col gap-3">
              {["w-3/4", "w-1/2", "w-2/3", "w-1/3"].map((w) => (
                <div
                  key={w}
                  className={`h-3 rounded-sm bg-surface-hover animate-skeleton ${w}`}
                />
              ))}
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-4 flex items-center gap-2">
              <Spinner />
              <span className="text-caption text-text-muted">Loading…</span>
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-6 text-caption text-text-faint">
          Tokens in <Code>app/design-system.css</Code>
        </div>
      </footer>
    </div>
  );
}

/* ---------- helpers (recipes imported from components/ui.tsx) ---------- */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="pt-14 mt-2 border-t border-border first:border-0">
      <h2 className="font-display text-h1">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-caption font-medium uppercase tracking-[0.04em] text-text-faint mt-8 mb-3 first:mt-0">
      {children}
    </h3>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-caption bg-surface-sunken border border-border rounded-sm px-1 py-0.5">
      {children}
    </code>
  );
}

function Rules({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-1.5">
      {items.map((r) => (
        <li key={r} className="text-small text-text-muted flex gap-2">
          <span className="text-brand shrink-0" aria-hidden>
            —
          </span>
          {r}
        </li>
      ))}
    </ul>
  );
}

function Swatch({
  name,
  hex,
  className,
}: {
  name: string;
  hex: string;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className={`h-14 ${className}`} />
      <div className="px-2.5 py-1.5 bg-surface-raised border-t border-border">
        <p className="text-caption font-medium">{name}</p>
        <p className="text-caption text-text-faint font-mono">{hex}</p>
      </div>
    </div>
  );
}

function SemanticSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-small font-medium ${className}`}
    >
      {name} <span className="font-normal opacity-80">on {name}-bg</span>
    </div>
  );
}

function TypeRow({
  spec,
  children,
}: {
  spec: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid sm:grid-cols-[180px_1fr] gap-x-6 gap-y-1 items-baseline">
      <span className="text-caption text-text-faint font-mono">{spec}</span>
      {children}
    </div>
  );
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-3 py-2 text-caption font-medium uppercase tracking-[0.04em] text-text-faint ${right ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function MotionRow({ t, v, u }: { t: string; v: string; u: string }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono">{t}</td>
      <td className="px-3 py-2 font-mono text-text-muted">{v}</td>
      <td className="px-3 py-2 text-text-muted">{u}</td>
    </tr>
  );
}

function PersonRow({
  name,
  items,
  subtotal,
  selected,
}: {
  name: string;
  items: number;
  subtotal: string;
  selected?: boolean;
}) {
  return (
    <tr
      className={`border-t border-border transition-colors duration-120 ${
        selected
          ? "bg-brand-bg border-l-2 border-l-brand"
          : "hover:bg-surface-hover"
      }`}
    >
      <td className="px-3 py-2">{name}</td>
      <td className="px-3 py-2 text-text-muted">{items}</td>
      <td className="px-3 py-2 text-right font-mono font-bold">{subtotal}</td>
    </tr>
  );
}

function Badge({
  children,
  className,
  dot,
}: {
  children: React.ReactNode;
  className: string;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-sm text-caption border ${className}`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-text-muted">{label}</span>
      {children}
      {error && <span className="text-caption text-danger">{error}</span>}
    </label>
  );
}

function Alert({
  className,
  title,
  titleClass,
  body,
}: {
  className: string;
  title: string;
  titleClass: string;
  body: string;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${className}`}>
      <p className={`text-small font-medium ${titleClass}`}>{title}</p>
      <p className="text-small text-text-muted mt-0.5">{body}</p>
    </div>
  );
}

function Meter({
  label,
  value,
  barClass,
  pct,
}: {
  label: string;
  value: number;
  barClass: string;
  pct: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-caption text-text-muted">{label}</span>
        <span className="text-small font-mono font-bold">{pct}</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-surface-sunken">
        <div
          className={`h-1 rounded-full ${barClass}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

function BtnPrimary({ children }: { children: React.ReactNode }) {
  return <button className={`${btnPrimary} px-4 py-2`}>{children}</button>;
}

function BtnSecondary({ children }: { children: React.ReactNode }) {
  return <button className={`${btnSecondary} px-4 py-2`}>{children}</button>;
}
