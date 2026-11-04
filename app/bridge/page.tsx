import Link from "next/link";
import { btnSecondary, eyebrow } from "@/components/ui";

export default function BridgePage() {
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-14">
      <div className="w-full max-w-xl bg-surface-raised border border-border rounded-xl p-5">
        <p className={eyebrow}>One-time setup</p>
        <h1 className="font-display text-h1 mt-2">
          Set up Jenson&apos;s Second Lunch
        </h1>
        <p className="text-small text-text-muted mt-2">
          Erewhon does not expose a cart-import link, so Chrome needs the
          Jenson&apos;s Second Lunch extension to move the verified cart created
          by the group-order page into your Erewhon cart.
        </p>

        <p className="mt-4 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-small">
          Current version: <strong>0.5.0</strong>. If an older copy is already
          installed, replace or reload it before transferring combo plates,
          burritos, or other products with options.
        </p>

        <ol className="mt-6 space-y-3 text-small list-decimal pl-5">
          <li>
            <a
              href="/erewhon-cart-bridge.zip"
              download
              className="font-medium text-brand-text hover:text-brand-hover hover:underline transition-colors duration-120"
            >
              Download Jenson&apos;s Second Lunch
            </a>{" "}
            and unzip it.
          </li>
          <li>
            Open{" "}
            <code className="font-mono text-caption bg-surface-sunken border border-border rounded-sm px-1.5 py-0.5">
              chrome://extensions
            </code>
            , turn on Developer mode, and choose <strong>Load unpacked</strong>.
          </li>
          <li>
            Select the unzipped folder, or reload the existing unpacked copy,
            then return to the order. The bridge connects automatically,
            including to order tabs that are already open.
          </li>
        </ol>

        <p className="text-caption text-text-faint mt-6 leading-relaxed">
          When you are signed in, the bridge uses your own Erewhon session — on
          your machine only — to add the group order to your cart, and talks to
          no one but Erewhon. It never sees your address, payment methods, or
          browsing history, and checkout stays in your hands. Its source is
          included in the download.
        </p>

        <Link href="/" className={`${btnSecondary} mt-6 px-4 py-2`}>
          Back to group orders
        </Link>
      </div>
    </main>
  );
}
