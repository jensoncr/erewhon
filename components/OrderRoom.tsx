"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  browseMenuSection,
  currentMeal,
  dietaryTags,
  effectivePrice,
  getProductOptions,
  menuSectionCounts,
  money,
  ProductUnavailableError,
  randomProductUnder,
  searchProducts,
  sectionsForMeal,
  storeByKey,
  type ItemConfiguration,
  type ModifierGroup,
  type ProductHit,
  type ProductOptions,
  type SearchResult,
} from "@/lib/erewhon";
import {
  getIdentityServerSnapshot,
  getIdentitySnapshot,
  saveIdentity,
  subscribeIdentity,
  type Identity,
} from "@/lib/identity";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  eyebrow,
  inputBase,
  StatusBadge,
} from "@/components/ui";
import { Orbs, type OrbMode } from "@/components/Orbs";

type OrderData = NonNullable<FunctionReturnType<typeof api.orders.get>>;
type OrderItem = OrderData["items"][number];

type MergedEntry = {
  key: string;
  productId: string;
  productName: string;
  category: string;
  size: string;
  price: number;
  qty: number;
  configuration: string;
  people: string[];
  notes: string[];
};

function configurationSummary(
  configuration: ItemConfiguration | undefined,
): string {
  if (!configuration) return "";
  return [
    configuration.modifierSize?.label,
    ...configuration.selections.map(
      (selection) =>
        `${selection.optionLabel}${selection.quantity > 1 ? ` ×${selection.quantity}` : ""}`,
    ),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function OrderRoom({ code }: { code: string }) {
  const me = useSyncExternalStore(
    subscribeIdentity,
    getIdentitySnapshot,
    getIdentityServerSnapshot,
  );

  const data = useQuery(
    api.orders.get,
    me ? { code, token: me.token } : "skip",
  );

  if (!me) {
    return (
      <JoinGate
        onJoin={(name) => {
          saveIdentity(name);
        }}
      />
    );
  }
  if (data === undefined) return <Shell>Loading order…</Shell>;
  if (data === null) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="font-display text-h1 text-text">Order not found</h1>
          <p className="text-text-muted mt-2">
            This link doesn&apos;t match any group order. Check the URL or ask
            the organizer for a fresh link.
          </p>
        </div>
      </Shell>
    );
  }
  return <Room me={me} data={data} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-14 text-text-muted">
      {children}
    </main>
  );
}

function JoinGate({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-14">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onJoin(name);
        }}
        className="w-full max-w-sm bg-surface-raised border border-border rounded-xl p-5 flex flex-col gap-4"
      >
        <div>
          <h1 className="font-display text-h1">Join the group order</h1>
          <p className="text-small text-text-muted mt-1">
            Your name labels the items you add — no account needed.
          </p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoFocus
          className={inputBase}
        />
        <button type="submit" className={`${btnPrimary} px-4 py-2.5`}>
          Join order
        </button>
      </form>
    </main>
  );
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatRemaining(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function Room({ me, data }: { me: Identity; data: OrderData }) {
  const { order, items, isOrganizer } = data;
  const router = useRouter();
  const store = storeByKey(order.storeKey);
  const setStatus = useMutation(api.orders.setStatus);
  const deleteOrder = useMutation(api.orders.deleteOrder);
  const now = useNow(30_000);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deadlinePassed =
    order.deadline !== undefined && now > order.deadline;
  const isOpen = order.status === "open" && !deadlinePassed;

  const showError = useCallback((err: unknown) => {
    const raw = err instanceof Error ? err.message : "Something went wrong";
    // Convex prefixes app errors with call metadata; keep the readable tail.
    const msg = raw.includes("Error:")
      ? raw.slice(raw.lastIndexOf("Error:") + 7)
      : raw;
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteOrder({ orderId: order._id, token: me.token });
      router.replace("/");
    } catch (error) {
      setDeleting(false);
      showError(error);
    }
  }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border bg-surface-raised">
        <div className="max-w-7xl mx-auto px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 w-full sm:w-auto sm:flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-h1 truncate">{order.name}</h1>
              <StatusBadge status={isOpen ? "open" : order.status === "placed" ? "placed" : "locked"} />
            </div>
            <p className="text-small text-text-muted mt-0.5">
              Erewhon {store.name} · organized by {order.organizerName}
              {order.deadline !== undefined && isOpen && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-brand-text font-medium">
                    locks in {formatRemaining(order.deadline - now)}
                  </span>
                </>
              )}
              {deadlinePassed && order.status === "open" && (
                <> · deadline passed</>
              )}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Link href="/" className={`${btnSecondary} px-3 py-1.5`}>
              All orders
            </Link>
            <button
              type="button"
              onClick={copyLink}
              className={`${btnSecondary} px-3 py-1.5`}
            >
              {copied ? "Copied!" : "Copy invite link"}
            </button>
            {isOrganizer && order.status === "open" && (
              <button
                type="button"
                onClick={() =>
                  setStatus({
                    orderId: order._id,
                    token: me.token,
                    status: "locked",
                  }).catch(showError)
                }
                className={`${btnPrimary} px-3 py-1.5`}
              >
                Lock order
              </button>
            )}
            {isOrganizer && order.status === "locked" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setStatus({
                      orderId: order._id,
                      token: me.token,
                      status: "open",
                    }).catch(showError)
                  }
                  className={`${btnSecondary} px-3 py-1.5`}
                >
                  Reopen
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setStatus({
                      orderId: order._id,
                      token: me.token,
                      status: "placed",
                    }).catch(showError)
                  }
                  className={`${btnPrimary} px-3 py-1.5`}
                >
                  Mark placed
                </button>
              </>
            )}
            {isOrganizer && (
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                className={`${btnDanger} px-3 py-1.5`}
              >
                Delete order
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <section className="min-w-0">
          {isOpen ? (
            <MenuPanel
              orderId={order._id}
              storeKey={order.storeKey}
              storeIndex={store.index}
              me={me}
              onError={showError}
            />
          ) : (
            <TransferList
              code={order.code}
              items={items}
              token={me.token}
              status={order.status}
              isOrganizer={isOrganizer}
            />
          )}
        </section>

        <aside className="lg:sticky lg:top-6">
          <SharedCart
            items={items}
            me={me}
            isOrganizer={isOrganizer}
            editable={isOpen || isOrganizer}
            onError={showError}
          />
          <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-small text-text-muted">
              Order total ({items.length} item{items.length === 1 ? "" : "s"})
            </span>
            <span className="font-mono text-h3 font-bold">{money(total)}</span>
          </div>
        </aside>
      </main>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-invert text-invert-text text-small px-4 py-2.5 rounded-lg shadow-lg animate-rise-in"
        >
          {toast}
        </div>
      )}
      {showDeleteDialog && (
        <DeleteOrderDialog
          orderName={order.name}
          deleting={deleting}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function DeleteOrderDialog({
  orderName,
  deleting,
  onCancel,
  onConfirm,
}: {
  orderName: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleting, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-scrim px-5 py-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-order-title"
        aria-describedby="delete-order-description"
        className="w-full max-w-md rounded-xl border border-border bg-surface-raised p-5 shadow-lg animate-rise-in"
      >
        <p className="text-caption font-medium uppercase tracking-[0.04em] text-danger">
          Permanent action
        </p>
        <h2
          id="delete-order-title"
          className="font-display text-h1 text-balance break-words mt-1.5"
        >
          Delete “{orderName}”?
        </h2>
        <p
          id="delete-order-description"
          className="text-small text-text-muted mt-2"
        >
          This removes the invite link and every item in the shared cart. It
          cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            disabled={deleting}
            onClick={onCancel}
            className={`${btnSecondary} px-4 py-2`}
          >
            Keep order
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="inline-flex items-center rounded-full bg-danger text-surface text-small font-medium px-4 py-2 transition-[background-color,transform] duration-160 ease-out-quad hover:opacity-90 active:scale-97 disabled:opacity-45 disabled:pointer-events-none"
          >
            {deleting ? "Deleting…" : "Delete order"}
          </button>
        </div>
      </div>
    </div>
  );
}

const SURPRISE_MAX_PRICE = 30;

type SectionState = {
  hits: ProductHit[];
  nbHits: number;
  loadedPages: number;
  loading: boolean;
};

/** Group a section's products under their SubCategory, honouring the
 *  section's preferred heading order and appending anything unexpected. */
function groupBySubCategory(
  hits: ProductHit[],
  subOrder: string[] | undefined,
): Array<[string, ProductHit[]]> {
  const groups = new Map<string, ProductHit[]>();
  for (const hit of hits) {
    const key = hit.SubCategory || hit.Category || "More";
    const list = groups.get(key) ?? [];
    list.push(hit);
    groups.set(key, list);
  }
  const order = subOrder ?? [];
  return [...groups.entries()].sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return b[1].length - a[1].length;
  });
}

function MenuPanel({
  orderId,
  storeKey,
  storeIndex,
  me,
  onError,
}: {
  orderId: Id<"orders">;
  storeKey: string;
  storeIndex: string;
  me: Identity;
  onError: (err: unknown) => void;
}) {
  const addItem = useMutation(api.orders.addItem);
  const [meal] = useState(currentMeal);
  const sections = useMemo(() => sectionsForMeal(meal), [meal]);

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);

  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [activeKey, setActiveKey] = useState(sections[0].key);
  const [sectionState, setSectionState] = useState<
    Record<string, SectionState>
  >({});
  const requested = useRef(new Set<string>());
  const menuTop = useRef<HTMLDivElement>(null);

  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  // Products Erewhon rejected at add time — retired in place instead of
  // firing a toast, so nobody tries the same dead card twice.
  const [soldOut, setSoldOut] = useState<Record<string, string>>({});
  const [configuring, setConfiguring] = useState<{
    hit: ProductHit;
    options: ProductOptions;
  } | null>(null);
  const [surprising, setSurprising] = useState(false);
  const [surprise, setSurprise] = useState<number | null>(null);

  const browsing = !query.trim();
  const activeSection =
    sections.find((section) => section.key === activeKey) ?? sections[0];
  const visibleSections = counts
    ? sections.filter((section) => (counts[section.key] ?? 0) > 0)
    : sections;

  useEffect(() => {
    const controller = new AbortController();
    menuSectionCounts(storeIndex, controller.signal)
      .then(setCounts)
      .catch(() => {
        // Counts only tune the nav; every section still loads on demand.
      });
    return () => controller.abort();
  }, [storeIndex]);

  // A section this store doesn't stock shouldn't stay selected.
  useEffect(() => {
    if (!counts) return;
    setActiveKey((current) =>
      (counts[current] ?? 0) > 0
        ? current
        : (sections.find((section) => (counts[section.key] ?? 0) > 0)?.key ??
          current),
    );
  }, [counts, sections]);

  // Sections load once and stay cached, so flipping between tabs is instant.
  // `requested` is a ref rather than derived from sectionState: keying the
  // effect off the state it writes would make its own cleanup abort the
  // fetch it just started.
  useEffect(() => {
    const key = activeSection.key;
    if (requested.current.has(key)) return;
    requested.current.add(key);
    const controller = new AbortController();
    let settled = false;

    function forget() {
      requested.current.delete(key);
      setSectionState((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }

    setSectionState((current) => ({
      ...current,
      [key]: { hits: [], nbHits: 0, loadedPages: 0, loading: true },
    }));
    browseMenuSection(storeIndex, activeSection, 0, controller.signal)
      .then((result) => {
        settled = true;
        setSectionState((current) => ({
          ...current,
          [key]: {
            hits: result.hits,
            nbHits: result.nbHits,
            loadedPages: 1,
            loading: false,
          },
        }));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        settled = true;
        forget();
        onError(err);
      });

    return () => {
      if (settled) return;
      controller.abort();
      forget();
    };
  }, [activeSection, storeIndex, onError]);

  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(
      async () => {
        searchAbort.current?.abort();
        if (!q) {
          setSearch(null);
          setSearching(false);
          return;
        }
        setSearching(true);
        const controller = new AbortController();
        searchAbort.current = controller;
        try {
          setSearch(await searchProducts(storeIndex, q, controller.signal));
          setSearching(false);
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            setSearching(false);
            onError(err);
          }
        }
      },
      q ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [query, storeIndex, onError]);

  async function loadMore() {
    const state = sectionState[activeSection.key];
    if (!state || state.loading) return;
    setSectionState((current) => ({
      ...current,
      [activeSection.key]: { ...state, loading: true },
    }));
    try {
      const result = await browseMenuSection(
        storeIndex,
        activeSection,
        state.loadedPages,
      );
      setSectionState((current) => {
        const previous = current[activeSection.key] ?? state;
        return {
          ...current,
          [activeSection.key]: {
            hits: [...previous.hits, ...result.hits],
            nbHits: result.nbHits,
            loadedPages: previous.loadedPages + 1,
            loading: false,
          },
        };
      });
    } catch (err) {
      setSectionState((current) => ({
        ...current,
        [activeSection.key]: { ...state, loading: false },
      }));
      onError(err);
    }
  }

  async function add(
    hit: ProductHit,
    configuration?: ItemConfiguration,
    surpriseItem = false,
  ) {
    try {
      const optionPrice =
        (configuration?.modifierSize?.price || 0) +
        (configuration?.selections.reduce(
          (sum, selection) => sum + selection.price * selection.quantity,
          0,
        ) || 0);
      await addItem({
        orderId,
        token: me.token,
        addedBy: me.name,
        productId: hit.objectID,
        productName: hit.ProductName,
        brand: hit.BrandName ?? "",
        category: hit.Category ?? "Other",
        size: hit.Size ?? "",
        price: effectivePrice(hit) + optionPrice,
        image: hit.ImageFileName ?? "",
        qty: 1,
        configuration,
        surprise: surpriseItem || undefined,
      });
      if (!surpriseItem) {
        setJustAdded(hit.objectID);
        setTimeout(() => setJustAdded(null), 1500);
      }
      return true;
    } catch (err) {
      onError(err);
      return false;
    }
  }

  async function chooseOrAdd(hit: ProductHit) {
    setCheckingId(hit.objectID);
    try {
      const options = await getProductOptions(storeKey, hit.objectID);
      if (options.modifierSizes.length > 0 || options.groups.length > 0) {
        setConfiguring({ hit, options });
      } else {
        await add(hit);
      }
    } catch (err) {
      if (err instanceof ProductUnavailableError) {
        setSoldOut((current) => ({ ...current, [hit.objectID]: err.message }));
      } else {
        onError(err);
      }
    } finally {
      setCheckingId(null);
    }
  }

  async function surpriseMe() {
    setSurprising(true);
    setSurprise(null);
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const hit = await randomProductUnder(storeIndex, SURPRISE_MAX_PRICE);
        if (!hit) continue;
        const options = await getProductOptions(storeKey, hit.objectID).catch(
          (err) => {
            if (err instanceof ProductUnavailableError) return null;
            throw err;
          },
        );
        if (!options || options.requiresSelection) continue;
        // Deliberately keep only the price — the item stays a mystery to
        // everyone but the organizer until the order arrives.
        if (await add(hit, undefined, true)) {
          setSurprise(effectivePrice(hit));
          return;
        }
      }
      throw new Error(
        "Couldn't find a surprise without required choices — try again",
      );
    } catch (err) {
      onError(err);
    } finally {
      setSurprising(false);
    }
  }

  const state = sectionState[activeSection.key];
  const grouped = useMemo(
    () => groupBySubCategory(state?.hits ?? [], activeSection.subOrder),
    [state?.hits, activeSection.subOrder],
  );

  function cardProps(hit: ProductHit) {
    return {
      hit,
      added: justAdded === hit.objectID,
      checking: checkingId === hit.objectID,
      soldOutReason: soldOut[hit.objectID],
      onAdd: () => chooseOrAdd(hit),
    };
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-h2 font-semibold">Add your items</h2>
          <p className="text-caption text-text-faint mt-0.5">
            Live menu for this store — only what&apos;s actually sold today.
          </p>
        </div>
        <button
          type="button"
          onClick={surpriseMe}
          disabled={surprising}
          className={`${btnSecondary} shrink-0 px-3 py-1.5`}
          title={`Adds a random mystery item under ${money(SURPRISE_MAX_PRICE)} to your cart — only the organizer sees what it is`}
        >
          {surprising ? "Rolling…" : "🎲 Surprise me"}
        </button>
      </div>

      <div className="relative mt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the whole store — “avocado”, “kombucha”, “sea moss”…"
          aria-label="Search the Erewhon catalog"
          className={`${inputBase} px-4 py-3 text-body`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 size-7 -translate-y-1/2 rounded-full text-text-muted transition-colors duration-120 hover:bg-surface-hover"
          >
            ×
          </button>
        )}
      </div>

      {surprise !== null && (
        <p className="mt-2 rounded-lg bg-success-bg border border-success text-success text-small px-3 py-2 animate-rise-in">
          🎲 Fate chose a mystery item for{" "}
          <span className="font-mono font-bold">{money(surprise)}</span> —
          it&apos;s in your cart. You&apos;ll find out what it is when the order
          arrives.
        </p>
      )}

      {browsing ? (
        <>
          <div ref={menuTop} aria-hidden />
          <nav
            aria-label="Menu sections"
            className="sticky top-0 z-20 -mx-5 mt-4 border-b border-border bg-surface/85 px-5 py-2.5 backdrop-blur"
          >
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent"
              />
              <div className="scroll-rail flex gap-1.5 overflow-x-auto">
              {visibleSections.map((section) => {
                const active = section.key === activeSection.key;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => {
                      setActiveKey(section.key);
                      menuTop.current?.scrollIntoView({ block: "start" });
                    }}
                    aria-current={active ? "true" : undefined}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-small font-medium transition-[background-color,border-color,color] duration-120 ${
                      active
                        ? "border-invert bg-invert text-invert-text"
                        : "border-border bg-surface-raised text-text-muted hover:bg-surface-hover hover:text-text"
                    }`}
                  >
                    {section.label}
                    {counts?.[section.key] !== undefined && (
                      <span
                        className={`ml-1.5 font-mono text-caption ${active ? "opacity-60" : "text-text-faint"}`}
                      >
                        {counts[section.key]}
                      </span>
                    )}
                  </button>
                );
              })}
              </div>
            </div>
          </nav>

          <div className="mt-4">
            <h3 className="font-display text-h1">{activeSection.label}</h3>
            <p className="text-small text-text-muted mt-0.5">
              {activeSection.blurb}
            </p>
          </div>

          {state?.loading && state.hits.length === 0 ? (
            <MenuSkeleton />
          ) : grouped.length === 0 && !state?.loading ? (
            <p className="mt-6 text-small text-text-muted">
              Nothing from the {activeSection.label.toLowerCase()} is on sale at
              this store today.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-6">
              {grouped.map(([subCategory, hits]) => (
                <section key={subCategory}>
                  {grouped.length > 1 && (
                    <h4 className={`${eyebrow} mb-2`}>{subCategory}</h4>
                  )}
                  <ProductGrid>
                    {hits.map((hit) => (
                      <ProductCard key={hit.objectID} {...cardProps(hit)} />
                    ))}
                  </ProductGrid>
                </section>
              ))}
            </div>
          )}

          {state && state.hits.length < state.nbHits && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={state.loading}
                className={`${btnSecondary} px-4 py-2`}
              >
                {state.loading
                  ? "Loading…"
                  : `Show more (${state.nbHits - state.hits.length} left)`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4">
          {searching && (
            <p className="flex items-center gap-1.5 text-small text-text-muted px-1">
              <Orbs mode="thinking" size="sm" />
              Searching…
            </p>
          )}
          {!searching && search && search.hits.length === 0 && (
            <p className="text-small text-text-muted px-1">
              Nothing available today for “{query.trim()}”.
              {search.hiddenToday > 0 && (
                <>
                  {" "}
                  {search.hiddenToday} matching product
                  {search.hiddenToday === 1 ? " is" : "s are"} in the catalog but
                  not sold today.
                </>
              )}
            </p>
          )}
          {!searching && search && search.hits.length > 0 && (
            <>
              <p className="text-caption text-text-faint px-1 mb-2">
                {search.hits.length} result
                {search.hits.length === 1 ? "" : "s"} available today
                {search.hiddenToday > 0 &&
                  ` · ${search.hiddenToday} hidden (not sold today)`}
              </p>
              <ProductGrid>
                {search.hits.map((hit) => (
                  <ProductCard key={hit.objectID} {...cardProps(hit)} />
                ))}
              </ProductGrid>
            </>
          )}
        </div>
      )}

      {configuring && (
        <ProductOptionsDialog
          key={configuring.hit.objectID}
          hit={configuring.hit}
          options={configuring.options}
          onCancel={() => setConfiguring(null)}
          onConfirm={async (configuration) => {
            const added = await add(configuring.hit, configuration);
            if (added) setConfiguring(null);
            return added;
          }}
        />
      )}
    </div>
  );
}

function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="mt-4">
      <ProductGrid>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-border bg-surface-raised animate-skeleton"
          >
            <div className="aspect-[4/3] bg-surface-sunken" />
            <div className="flex flex-col gap-2 p-3">
              <div className="h-3 rounded-sm bg-surface-sunken" />
              <div className="h-3 w-2/3 rounded-sm bg-surface-sunken" />
            </div>
          </div>
        ))}
      </ProductGrid>
    </div>
  );
}

function ProductCard({
  hit,
  added,
  checking,
  soldOutReason,
  onAdd,
}: {
  hit: ProductHit;
  added: boolean;
  checking: boolean;
  soldOutReason?: string;
  onAdd: () => void;
}) {
  const tags = dietaryTags(hit);
  const meta = [hit.Size, hit.BrandName !== "Erewhon" ? hit.BrandName : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised animate-rise-in ${
        soldOutReason ? "opacity-60" : ""
      }`}
    >
      <div className="relative aspect-[4/3] bg-white">
        <ProductPhoto src={hit.ImageFileName} alt={hit.ProductName} />
        {soldOutReason && (
          <div className="absolute inset-0 grid place-items-center bg-surface/70">
            <span className="rounded-sm border border-border-strong bg-surface-raised px-2 py-1 text-caption font-medium text-text-muted">
              Not available today
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-small font-medium leading-snug line-clamp-2">
          {hit.ProductName}
        </p>
        {meta && (
          <p className="text-caption text-text-faint mt-0.5 truncate">{meta}</p>
        )}
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-success-bg px-1.5 py-0.5 text-caption text-success"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="font-mono text-small font-semibold">
            {money(effectivePrice(hit))}
          </span>
          <button
            type="button"
            onClick={onAdd}
            disabled={checking || Boolean(soldOutReason)}
            title={soldOutReason}
            className={
              added
                ? "inline-flex items-center rounded-full bg-success-bg px-3 py-1.5 text-small font-medium text-success"
                : `${btnPrimary} px-3 py-1.5`
            }
          >
            {soldOutReason
              ? "Sold out"
              : checking
                ? "Checking…"
                : added
                  ? "Added ✓"
                  : hit.has_modifier
                    ? "Choose"
                    : "Add"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="absolute inset-0 bg-surface-sunken" />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(min-width: 1280px) 220px, (min-width: 640px) 290px, 45vw"
      unoptimized
      onError={() => setFailed(true)}
      className="object-cover"
    />
  );
}

function selectionRule(group: ModifierGroup): string {
  if (group.minimum === group.maximum) {
    return `Choose ${group.maximum}`;
  }
  if (group.minimum === 0) return `Choose up to ${group.maximum}`;
  return `Choose ${group.minimum}–${group.maximum}`;
}

function ProductOptionsDialog({
  hit,
  options,
  onCancel,
  onConfirm,
}: {
  hit: ProductHit;
  options: ProductOptions;
  onCancel: () => void;
  onConfirm: (configuration: ItemConfiguration) => Promise<boolean>;
}) {
  const [modifierSizeId, setModifierSizeId] = useState(
    options.modifierSizes[0]?.id || "",
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedSize = options.modifierSizes.find(
    (size) => size.id === modifierSizeId,
  );
  const groups = selectedSize ? selectedSize.groups : options.groups;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, saving]);

  function keyFor(groupId: string, choiceId: string) {
    return `${groupId}:${choiceId}`;
  }

  function groupTotal(group: ModifierGroup, state = quantities) {
    return group.choices.reduce(
      (sum, choice) => sum + (state[keyFor(group.id, choice.id)] || 0),
      0,
    );
  }

  function toggleChoice(group: ModifierGroup, choiceId: string) {
    setQuantities((current) => {
      const next = { ...current };
      const key = keyFor(group.id, choiceId);
      if (group.type === "radio") {
        for (const choice of group.choices) {
          delete next[keyFor(group.id, choice.id)];
        }
        next[key] = 1;
        return next;
      }

      if (current[key]) {
        delete next[key];
      } else if (groupTotal(group, current) < group.maximum) {
        next[key] = 1;
      }
      return next;
    });
  }

  function adjustQuantity(
    group: ModifierGroup,
    choiceId: string,
    choiceMaximum: number,
    delta: number,
  ) {
    setQuantities((current) => {
      const key = keyFor(group.id, choiceId);
      const quantity = current[key] || 0;
      const room = group.maximum - (groupTotal(group, current) - quantity);
      const nextQuantity = Math.max(
        0,
        Math.min(choiceMaximum, room, quantity + delta),
      );
      const next = { ...current };
      if (nextQuantity === 0) delete next[key];
      else next[key] = nextQuantity;
      return next;
    });
  }

  const valid = groups.every((group) => {
    const total = groupTotal(group);
    return total >= group.minimum && total <= group.maximum;
  });
  const optionPrice =
    (selectedSize?.price || 0) +
    groups.reduce(
      (sum, group) =>
        sum +
        group.choices.reduce(
          (choiceSum, choice) =>
            choiceSum +
            choice.price * (quantities[keyFor(group.id, choice.id)] || 0),
          0,
        ),
      0,
    );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) return;

    const configuration: ItemConfiguration = {
      modifierSize: selectedSize
        ? {
            id: selectedSize.id,
            label: selectedSize.label,
            price: selectedSize.price,
          }
        : undefined,
      selections: groups.flatMap((group) =>
        group.choices.flatMap((choice) => {
          const quantity = quantities[keyFor(group.id, choice.id)] || 0;
          return quantity > 0
            ? [
                {
                  groupId: group.id,
                  groupLabel: group.label,
                  optionId: choice.id,
                  optionLabel: choice.label,
                  price: choice.price,
                  quantity,
                },
              ]
            : [];
        }),
      ),
    };

    setSaving(true);
    const added = await onConfirm(configuration);
    if (!added) setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-options-title"
        onSubmit={submit}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface-raised shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface-raised px-5 py-4">
          <div>
            <p className={eyebrow}>Choose your options</p>
            <h2 id="product-options-title" className="font-display text-h1 mt-1">
              {hit.ProductName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close product options"
            className="size-8 rounded-full border border-border text-text-muted hover:bg-surface-hover"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {options.modifierSizes.length > 0 && (
            <fieldset>
              <legend className="text-small font-semibold">Choose one</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {options.modifierSizes.map((size) => (
                  <label
                    key={size.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-small transition-colors ${
                      modifierSizeId === size.id
                        ? "border-brand bg-brand-bg"
                        : "border-border hover:bg-surface-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="modifier-size"
                      checked={modifierSizeId === size.id}
                      onChange={() => {
                        setModifierSizeId(size.id);
                        setQuantities({});
                        setSubmitted(false);
                      }}
                    />
                    <span className="flex-1">{size.label}</span>
                    {size.price > 0 && (
                      <span className="font-mono text-text-muted">
                        +{money(size.price)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {groups.map((group) => {
            const total = groupTotal(group);
            const invalid =
              submitted &&
              (total < group.minimum || total > group.maximum);
            return (
              <fieldset
                key={group.id}
                className={`rounded-lg border p-3 ${invalid ? "border-danger bg-danger-bg" : "border-border"}`}
              >
                <legend className="px-1 text-small font-semibold">
                  {group.label}
                </legend>
                <div className="flex items-center justify-between gap-3 text-caption text-text-muted">
                  <span>{selectionRule(group)}</span>
                  <span className={invalid ? "text-danger" : ""}>
                    {total} / {group.maximum}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.choices.map((choice) => {
                    const key = keyFor(group.id, choice.id);
                    const quantity = quantities[key] || 0;
                    const selected = quantity > 0;
                    const disabled =
                      !selected &&
                      group.type === "checkbox" &&
                      total >= group.maximum;
                    return (
                      <div
                        key={choice.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-small ${
                          selected
                            ? "border-brand bg-brand-bg"
                            : "border-border"
                        }`}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                          <input
                            type={group.type}
                            name={group.id}
                            checked={selected}
                            disabled={disabled}
                            onChange={() => toggleChoice(group, choice.id)}
                          />
                          <span className="min-w-0 flex-1 leading-snug">
                            {choice.label}
                          </span>
                          {choice.price > 0 && (
                            <span className="font-mono text-text-muted">
                              +{money(choice.price)}
                            </span>
                          )}
                        </label>
                        {selected && choice.maximum > 1 && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Decrease ${choice.label}`}
                              onClick={() =>
                                adjustQuantity(
                                  group,
                                  choice.id,
                                  choice.maximum,
                                  -1,
                                )
                              }
                              className="size-6 rounded-sm border border-border"
                            >
                              −
                            </button>
                            <span className="w-5 text-center font-mono">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase ${choice.label}`}
                              onClick={() =>
                                adjustQuantity(
                                  group,
                                  choice.id,
                                  choice.maximum,
                                  1,
                                )
                              }
                              className="size-6 rounded-sm border border-border"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {invalid && (
                  <p className="mt-2 text-caption text-danger">
                    Complete this required choice before adding the item.
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-surface-raised px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={`${btnSecondary} px-4 py-2`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`${btnPrimary} px-4 py-2`}
          >
            {saving
              ? "Adding…"
              : `Add · ${money(effectivePrice(hit) + optionPrice)}`}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductImage({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-lg bg-surface-sunken border border-border shrink-0"
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
      className="rounded-lg object-cover bg-white shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function SharedCart({
  items,
  me,
  isOrganizer,
  editable,
  onError,
}: {
  items: OrderItem[];
  me: Identity;
  isOrganizer: boolean;
  editable: boolean;
  onError: (err: unknown) => void;
}) {
  const updateItem = useMutation(api.orders.updateItem);
  const removeItem = useMutation(api.orders.removeItem);

  const byPerson = useMemo(() => {
    const groups = new Map<string, OrderItem[]>();
    for (const item of items) {
      const list = groups.get(item.addedBy) ?? [];
      list.push(item);
      groups.set(item.addedBy, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="bg-surface-raised border border-border rounded-lg py-8 px-4 text-center">
        <p className="text-h3 font-semibold">The shared cart is empty</p>
        <p className="text-small text-text-muted mt-1">
          Be the first to add something.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h2 font-semibold">Shared cart</h2>
      {byPerson.map(([person, personItems]) => {
        const subtotal = personItems.reduce(
          (sum, i) => sum + i.price * i.qty,
          0,
        );
        return (
          <div
            key={person}
            className="bg-surface-raised border border-border rounded-lg overflow-hidden"
          >
            <div className="flex items-baseline justify-between px-4 py-2.5 bg-surface-sunken border-b border-border">
              <span className="text-small font-medium">
                {person}
                {personItems[0]?.mine && (
                  <span className="text-text-muted font-normal"> (you)</span>
                )}
              </span>
              <span className="text-small font-mono text-text-muted">
                {money(subtotal)}
              </span>
            </div>
            <ul>
              {personItems.map((item) => {
                const canEdit = editable && (item.mine || isOrganizer);
                const configuredAs = configurationSummary(item.configuration);
                return (
                  <li
                    key={item._id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0"
                  >
                    {item.surprise && !item.image ? (
                      <div
                        style={{ width: 36, height: 36 }}
                        className="rounded-lg bg-brand-bg border border-border shrink-0 flex items-center justify-center"
                      >
                        🎁
                      </div>
                    ) : (
                      <ProductImage src={item.image} alt="" size={36} />
                    )}
                    <div className="min-w-0 w-full sm:w-auto sm:flex-1">
                      <p className="text-small font-medium leading-snug">
                        {item.surprise && (
                          <span title="Surprise item — only the organizer can see what it is">
                            🎲{" "}
                          </span>
                        )}
                        {item.productName}
                      </p>
                      <p className="text-caption text-text-faint">
                        {[item.size, money(item.price)]
                          .filter(Boolean)
                          .join(" · ")}
                        {item.note && (
                          <span className="italic"> · “{item.note}”</span>
                        )}
                      </p>
                      {configuredAs && (
                        <p className="text-caption text-text-muted mt-0.5 leading-snug">
                          {configuredAs}
                        </p>
                      )}
                    </div>
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() =>
                            item.qty <= 1
                              ? removeItem({
                                  itemId: item._id,
                                  token: me.token,
                                }).catch(onError)
                              : updateItem({
                                  itemId: item._id,
                                  token: me.token,
                                  qty: item.qty - 1,
                                }).catch(onError)
                          }
                          className="size-6 rounded-sm border border-border text-small leading-none hover:bg-surface-hover transition-colors duration-120"
                        >
                          −
                        </button>
                        <span className="text-small font-mono w-6 text-center">
                          {item.qty}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() =>
                            updateItem({
                              itemId: item._id,
                              token: me.token,
                              qty: item.qty + 1,
                            }).catch(onError)
                          }
                          className="size-6 rounded-sm border border-border text-small leading-none hover:bg-surface-hover transition-colors duration-120"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="text-small font-mono text-text-muted">
                        ×{item.qty}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

const PENDING_HANDOFF_KEY = "erewhon-group-cart:pending-handoff";
const CONFIGURED_CART_BRIDGE_VERSION = "0.5.0";

function bridgeVersionParts(version: unknown): number[] | null {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    return null;
  }
  return version.split(".").map(Number);
}

function compareBridgeVersions(left: string, right: string): number {
  const leftParts = bridgeVersionParts(left);
  const rightParts = bridgeVersionParts(right);
  if (!leftParts || !rightParts) return 0;
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

type PendingHandoff = {
  code: string;
  handoffUrl: string;
  expiresAt: number;
};

function readPendingHandoff(code: string): PendingHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_HANDOFF_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Partial<PendingHandoff>;
    const handoff = new URL(pending.handoffUrl ?? "");
    const params = new URLSearchParams(handoff.hash.slice(1));
    if (
      pending.code !== code ||
      typeof pending.expiresAt !== "number" ||
      pending.expiresAt < Date.now() ||
      handoff.origin !== "https://erewhon.com" ||
      handoff.pathname !== "/cart" ||
      !/^[a-f0-9]{24}$/.test(params.get("group-cart") ?? "")
    ) {
      window.sessionStorage.removeItem(PENDING_HANDOFF_KEY);
      return null;
    }
    return pending as PendingHandoff;
  } catch {
    window.sessionStorage.removeItem(PENDING_HANDOFF_KEY);
    return null;
  }
}

function clearPendingHandoff() {
  window.sessionStorage.removeItem(PENDING_HANDOFF_KEY);
}

function authorizeCartHandoff(handoffUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    let rejectionGrace: number | undefined;
    let rejectionReceived = false;

    function cleanup() {
      window.clearInterval(retry);
      window.clearTimeout(timeout);
      if (rejectionGrace !== undefined) window.clearTimeout(rejectionGrace);
      window.removeEventListener("message", receiveAuthorization);
    }

    function fail() {
      cleanup();
      reject(
        new Error(
          rejectionReceived
            ? "The active bridge copy could not authorize the cart"
            : "The Erewhon Cart Bridge did not respond",
        ),
      );
    }

    function receiveAuthorization(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (
        event.data?.source !== "erewhon-cart-bridge" ||
        event.data?.requestId !== requestId
      ) {
        return;
      }
      if (event.data.type === "handoff-authorized") {
        cleanup();
        resolve();
      }
      if (event.data.type === "handoff-error") {
        // A content script from an extension copy that was reloaded or updated
        // can remain in an already-open tab. Give any current copy a short
        // grace period to win before the page self-recovers with one reload.
        rejectionReceived = true;
        rejectionGrace ??= window.setTimeout(fail, 1_200);
      }
    }

    function requestAuthorization() {
      window.postMessage(
        {
          source: "erewhon-group-order",
          type: "authorize-handoff",
          requestId,
          handoffUrl,
        },
        window.location.origin,
      );
    }

    window.addEventListener("message", receiveAuthorization);
    requestAuthorization();
    const retry = window.setInterval(requestAuthorization, 500);
    const timeout = window.setTimeout(fail, 4_000);
  });
}

function TransferStatus({
  stage,
  recovering,
  itemCount,
  peopleCount,
}: {
  stage: TransferStage;
  recovering: boolean;
  itemCount: number;
  peopleCount: number;
}) {
  const idx = TRANSFER_STAGES.findIndex((s) => s.key === stage);
  const current = TRANSFER_STAGES[idx];
  const line =
    recovering && stage === "authorize"
      ? "Reconnecting to the cart bridge…"
      : current.line;
  const subs: Record<TransferStage, string> = {
    build: `Merging ${itemCount} item${itemCount === 1 ? "" : "s"} from ${peopleCount} ${peopleCount === 1 ? "person" : "people"}`,
    authorize:
      recovering
        ? "Chrome is re-injecting the bridge after an update"
        : "Asking the bridge extension to accept the handoff",
    open: "The bridge takes it from here",
  };
  return (
    <div className="mt-4 max-w-xl rounded-lg border border-border bg-surface-raised p-4 flex items-start gap-4 animate-rise-in">
      <Orbs mode={current.mode} />
      <div className="min-w-0 flex-1">
        <p className="text-h3 font-semibold">{line}</p>
        <p className="text-small text-text-muted mt-0.5">{subs[stage]}</p>
        <ol className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5">
          {TRANSFER_STAGES.map((s, i) => (
            <li
              key={s.key}
              className={`flex items-center gap-2 text-small ${
                i < idx
                  ? "text-text-muted"
                  : i === idx
                    ? "text-text font-medium"
                    : "text-text-faint"
              }`}
            >
              <span className="size-4 grid place-items-center">
                {i < idx || (i === idx && s.mode === "done") ? (
                  <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
                    <path
                      d="M2.5 7l2.6 2.6L10.5 3.6"
                      className="stroke-success"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span
                    className={`size-[7px] rounded-full border-[1.5px] ${
                      i === idx ? "border-text" : "border-border-strong"
                    }`}
                  />
                )}
              </span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

type TransferStage = "build" | "authorize" | "open";

const TRANSFER_STAGES: {
  key: TransferStage;
  label: string;
  line: string;
  mode: OrbMode;
}[] = [
  {
    key: "build",
    label: "Build the combined cart",
    line: "Building the combined cart…",
    mode: "working",
  },
  {
    key: "authorize",
    label: "Authorize the cart bridge",
    line: "Authorizing the cart bridge…",
    mode: "thinking",
  },
  {
    key: "open",
    label: "Open erewhon.com",
    line: "Cart ready — opening erewhon.com…",
    mode: "done",
  },
];

function TransferList({
  code,
  items,
  token,
  status,
  isOrganizer,
}: {
  code: string;
  items: OrderItem[];
  token: string;
  status: "open" | "locked" | "placed";
  isOrganizer: boolean;
}) {
  const [bridgeVersion, setBridgeVersion] = useState<string | null>(null);
  const [stage, setStage] = useState<TransferStage | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [pendingHandoff, setPendingHandoff] =
    useState<PendingHandoff | null>(null);

  useEffect(() => {
    function receiveBridgeMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (
        event.data?.source === "erewhon-cart-bridge" &&
        event.data?.type === "ready"
      ) {
        const announcedVersion = bridgeVersionParts(event.data.version)
          ? event.data.version
          : "0.0.0";
        setBridgeVersion((current) =>
          !current || compareBridgeVersions(announcedVersion, current) > 0
            ? announcedVersion
            : current,
        );
      }
    }

    function pingBridge() {
      window.postMessage(
        { source: "erewhon-group-order", type: "bridge-ping" },
        window.location.origin,
      );
    }

    window.addEventListener("message", receiveBridgeMessage);
    pingBridge();
    const pingInterval = window.setInterval(pingBridge, 1_500);
    return () => {
      window.clearInterval(pingInterval);
      window.removeEventListener("message", receiveBridgeMessage);
    };
  }, []);

  useEffect(() => {
    const readPending = window.setTimeout(() => {
      const pending = readPendingHandoff(code);
      if (!pending) return;
      setPendingHandoff(pending);
      setRecovering(true);
      setStage("authorize");
    }, 0);
    return () => window.clearTimeout(readPending);
  }, [code]);

  useEffect(() => {
    if (!pendingHandoff) return;
    const unavailableTimeout = window.setTimeout(() => {
      clearPendingHandoff();
      setPendingHandoff(null);
      setRecovering(false);
      setStage(null);
      setTransferError(
        "Chrome still cannot reach the cart bridge. Check that one current copy is enabled, then try again.",
      );
    }, 9_000);
    return () => window.clearTimeout(unavailableTimeout);
  }, [pendingHandoff]);

  useEffect(() => {
    if (!pendingHandoff || !bridgeVersion) return;
    let active = true;
    void authorizeCartHandoff(pendingHandoff.handoffUrl)
      .then(() => {
        if (!active) return;
        clearPendingHandoff();
        setStage("open");
        window.location.assign(pendingHandoff.handoffUrl);
      })
      .catch(() => {
        if (!active) return;
        clearPendingHandoff();
        setPendingHandoff(null);
        setRecovering(false);
        setStage(null);
        setTransferError(
          "Chrome found the cart bridge but could not activate it. Check that one current copy is enabled, then try again.",
        );
      });
    return () => {
      active = false;
    };
  }, [bridgeVersion, pendingHandoff]);

  const hasConfiguredItems = items.some(
    (item) => item.configurationKey || item.configuration,
  );
  const bridgeReady = bridgeVersion !== null;
  const bridgeSupportsConfigurations =
    !hasConfiguredItems ||
    (bridgeVersion !== null &&
      compareBridgeVersions(
        bridgeVersion,
        CONFIGURED_CART_BRIDGE_VERSION,
      ) >= 0);

  const merged = useMemo(() => {
    const map = new Map<string, MergedEntry>();
    for (const item of items) {
      const mapKey = `${item.productId}:${item.configurationKey ?? ""}`;
      const entry = map.get(mapKey) ?? {
        key: mapKey,
        productId: item.productId,
        productName: item.productName,
        category: item.category || "Other",
        size: item.size,
        price: item.price,
        qty: 0,
        configuration: configurationSummary(item.configuration),
        people: [],
        notes: [],
      };
      entry.qty += item.qty;
      entry.people.push(`${item.addedBy}${item.qty > 1 ? ` ×${item.qty}` : ""}`);
      if (item.note) entry.notes.push(`${item.addedBy}: ${item.note}`);
      map.set(mapKey, entry);
    }
    const byCategory = new Map<string, MergedEntry[]>();
    for (const entry of map.values()) {
      const list = byCategory.get(entry.category) ?? [];
      list.push(entry);
      byCategory.set(entry.category, list);
    }
    return [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  async function transferAll() {
    if (!bridgeSupportsConfigurations) {
      setTransferError(
        `Update the cart bridge to ${CONFIGURED_CART_BRIDGE_VERSION} or newer so Erewhon keeps every selected option.`,
      );
      return;
    }
    setStage("build");
    setTransferError(null);
    try {
      const response = await fetch("/api/erewhon-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token }),
      });
      const payload = (await response.json()) as {
        error?: string;
        handoffUrl?: string;
      };
      if (!response.ok || !payload.handoffUrl) {
        throw new Error(payload.error || "Could not create the Erewhon cart");
      }
      setStage("authorize");
      try {
        await authorizeCartHandoff(payload.handoffUrl);
        setStage("open");
        window.location.assign(payload.handoffUrl);
      } catch {
        // Installing/reloading an unpacked extension invalidates content
        // scripts in tabs that were already open. Preserve this exact cart,
        // reload once so Chrome injects the current bridge, and resume on mount.
        const pending: PendingHandoff = {
          code,
          handoffUrl: payload.handoffUrl,
          expiresAt: Date.now() + 60_000,
        };
        window.sessionStorage.setItem(
          PENDING_HANDOFF_KEY,
          JSON.stringify(pending),
        );
        setRecovering(true);
        window.location.reload();
      }
    } catch (error) {
      setTransferError(
        error instanceof Error ? error.message : "Could not create the cart",
      );
      setStage(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-h2 font-semibold">
            {status === "placed" ? "Order placed" : "Ready for Erewhon"}
          </h2>
          <p className="text-small text-text-muted mt-0.5 max-w-md">
            {status === "placed"
              ? "The organizer has placed this order on erewhon.com."
              : isOrganizer
                ? "Transfer every product and exact quantity into one Erewhon cart."
                : "The cart is locked while the organizer transfers the combined order to Erewhon."}
          </p>
        </div>
        {isOrganizer && status === "locked" && stage === null &&
          (bridgeReady && bridgeSupportsConfigurations ? (
            <button
              type="button"
              onClick={transferAll}
              disabled={items.length === 0}
              className={`${btnPrimary} px-4 py-2`}
            >
              Transfer all to Erewhon
            </button>
          ) : (
            <Link href="/bridge" className={`${btnPrimary} px-4 py-2`}>
              {bridgeReady ? "Update cart transfer" : "Enable cart transfer"}
            </Link>
          ))}
      </div>

      {stage && (
        <TransferStatus
          stage={stage}
          recovering={recovering}
          itemCount={items.length}
          peopleCount={new Set(items.map((i) => i.addedBy)).size}
        />
      )}

      {transferError && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-small text-danger animate-rise-in"
        >
          {transferError}{" "}
          <Link href="/bridge" className="font-medium underline">
            Check cart-bridge setup
          </Link>
        </p>
      )}

      {isOrganizer &&
        status === "locked" &&
        bridgeReady &&
        !bridgeSupportsConfigurations && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-danger bg-danger-bg px-4 py-3 text-small text-danger"
          >
            This order has product options. Update Jenson&apos;s Second Lunch to
            version {CONFIGURED_CART_BRIDGE_VERSION} or newer before transfer
            so Erewhon keeps every side and selection.{" "}
            <Link href="/bridge" className="font-medium underline">
              Update cart transfer
            </Link>
          </p>
        )}

      <div className="mt-4 flex flex-col gap-5">
        {merged.map(([category, entries]) => (
          <div key={category}>
            <h3 className={`${eyebrow} mb-2`}>{category}</h3>
            <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
              {entries.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
                >
                  <div className="min-w-0 w-full sm:w-auto sm:flex-1">
                    <p className="text-small font-medium">
                      <span className="font-mono">{entry.qty}×</span>{" "}
                      {entry.productName}
                      {entry.size && (
                        <span className="text-text-muted font-normal">
                          {" "}
                          ({entry.size})
                        </span>
                      )}
                    </p>
                    {entry.configuration && (
                      <p className="text-caption text-text-muted mt-0.5 leading-snug">
                        {entry.configuration}
                      </p>
                    )}
                    <p className="text-caption text-text-faint mt-0.5">
                      For {entry.people.join(", ")}
                      {entry.notes.length > 0 && (
                        <span className="italic"> · {entry.notes.join("; ")}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-small font-mono text-text-muted">
                    {money(entry.price * entry.qty)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
