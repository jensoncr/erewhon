"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { STORES, storeByKey } from "@/lib/erewhon";
import {
  getIdentityServerSnapshot,
  getIdentitySnapshot,
  saveIdentity,
  subscribeIdentity,
} from "@/lib/identity";
import {
  btnPrimary,
  btnSecondary,
  eyebrow,
  inputBase,
  StatusBadge,
} from "@/components/ui";

export default function CreateOrderPage() {
  const router = useRouter();
  const createOrder = useMutation(api.orders.create);
  const saved = useSyncExternalStore(
    subscribeIdentity,
    getIdentitySnapshot,
    getIdentityServerSnapshot,
  );
  const orderHistory = usePaginatedQuery(
    api.orders.listForOrganizer,
    saved ? { token: saved.token } : "skip",
    { initialNumItems: 12 },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const yourName = String(form.get("yourName") ?? "").trim();
    const orderName = String(form.get("orderName") ?? "").trim();
    const storeKey = String(form.get("storeKey") ?? "GROVE");
    const deadlineRaw = String(form.get("deadline") ?? "");
    if (!yourName) return;
    setError(null);
    setBusy(true);
    try {
      const identity = saveIdentity(yourName);
      const deadlineMs = deadlineRaw ? new Date(deadlineRaw).getTime() : NaN;
      const code = await createOrder({
        name: orderName || "Office order",
        storeKey,
        organizerName: identity.name,
        token: identity.token,
        deadline: Number.isFinite(deadlineMs) ? deadlineMs : undefined,
      });
      router.push(`/o/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-5 py-14">
      <div className="w-full max-w-md">
        <p className={eyebrow}>Internal tool</p>
        <h1 className="font-display text-display mt-1.5 text-balance">
          Erewhon Group Cart
        </h1>
        <p className="text-text-muted mt-2.5">
          Start a group order, share the link in Slack, and everyone adds their
          items to one shared cart. When it locks, one person places the
          combined order on erewhon.com — one delivery fee, no marketplace
          markup.
        </p>

        <form
          onSubmit={handleCreate}
          className="mt-8 bg-surface-raised border border-border rounded-xl p-5 flex flex-col gap-5"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-text-muted">
              Order name
            </span>
            <input
              name="orderName"
              placeholder="Friday office order"
              className={inputBase}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-text-muted">
              Store
            </span>
            <select name="storeKey" defaultValue="GROVE" className={inputBase}>
              {STORES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-text-muted">
              Your name
            </span>
            <input
              name="yourName"
              key={saved ? "prefilled" : "blank"}
              defaultValue={saved?.name ?? ""}
              required
              placeholder="Jenson"
              className={inputBase}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-text-muted">
              Deadline{" "}
              <span className="text-text-faint font-normal normal-case">
                (optional)
              </span>
            </span>
            <input type="datetime-local" name="deadline" className={inputBase} />
            <span className="text-caption text-text-faint">
              After the deadline the cart locks automatically.
            </span>
          </label>

          {error && (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`${btnPrimary} px-4 py-2.5`}
          >
            {busy ? "Creating…" : "Create group order"}
          </button>
        </form>

        <p className="text-caption text-text-faint mt-5 leading-relaxed">
          Live catalog, prices, and photos come from erewhon.com&apos;s own
          public product search. This site never asks for your Erewhon login or
          places orders. The organizer&apos;s Chrome extension uses their existing
          Erewhon session to fill their cart, and they check out on erewhon.com.
        </p>

        {saved && (
          <section className="mt-10 border-t border-border pt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className={eyebrow}>Organizer history</p>
                <h2 className="font-display text-h1 mt-1">Your orders</h2>
              </div>
              {orderHistory.results.length > 0 && (
                <span className="text-caption text-text-faint">
                  Newest first
                </span>
              )}
            </div>

            {orderHistory.status === "LoadingFirstPage" ? (
              <p className="text-small text-text-muted mt-5">Loading orders…</p>
            ) : orderHistory.results.length === 0 ? (
              <p className="text-small text-text-muted mt-5 rounded-lg border border-border bg-surface-raised px-4 py-3">
                No orders created from this browser yet.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {orderHistory.results.map((order) => (
                  <OrderHistoryLink key={order._id} order={order} />
                ))}
              </div>
            )}

            {(orderHistory.status === "CanLoadMore" ||
              orderHistory.status === "LoadingMore") && (
              <button
                type="button"
                disabled={orderHistory.status === "LoadingMore"}
                onClick={() => orderHistory.loadMore(12)}
                className={`${btnSecondary} mt-4 w-full px-4 py-2`}
              >
                {orderHistory.status === "LoadingMore"
                  ? "Loading…"
                  : "Load older orders"}
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

type OrderHistoryItem = FunctionReturnType<
  typeof api.orders.listForOrganizer
>["page"][number];

function OrderHistoryLink({ order }: { order: OrderHistoryItem }) {
  return (
    <Link
      href={`/o/${order.code}`}
      className="rounded-lg border border-border bg-surface-raised px-4 py-3.5 hover:bg-surface-hover transition-colors duration-120"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-small font-medium truncate">{order.name}</p>
          <p className="text-caption text-text-faint mt-1">
            {storeByKey(order.storeKey).name} ·{" "}
            {new Date(order._creationTime).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>
    </Link>
  );
}
