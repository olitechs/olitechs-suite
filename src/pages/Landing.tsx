// OliTechs PMS + POS — landing page.
// Theme: black + yellow, slate-tinted neutrals, quiet surfaces, one accent.
// No gradients, no glassmorphism: hierarchy comes from type, spacing and rules.
import { motion } from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  Check,
  ReceiptText,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router";
import { ActionButton } from "@/pos/primitives";
import { PRODUCTS } from "@/pos/data";
import { computeTotals, formatKES, type OrderLine } from "@/pos/lib";

function previewLine(productId: string, qty: number): OrderLine {
  const p = PRODUCTS.find((x) => x.id === productId)!;
  return {
    id: `prev-${p.id}`,
    productId: p.id,
    name: p.name,
    variant: p.variant,
    sku: p.sku,
    dept: p.dept,
    qty,
    unitPrice: p.price,
    modifiers: [],
    course: 1,
    status: "pending",
  };
}

/* Every figure on this page is computed from the same catalogue the POS uses. */
const PREVIEW_LINES = [
  previewLine("p-chips-masala-large", 1),
  previewLine("p-nyama", 1),
  previewLine("p-tusker", 2),
];
const previewTotals = computeTotals({
  lines: PREVIEW_LINES,
  discount: null,
  paid: 0,
});

const FEATURES = [
  {
    icon: WifiOff,
    title: "Offline is the default, not the error",
    body: "Orders, tenders and folio charges are written to the device first. The queue shows “Offline, N changes queued” and flushes once when the connection returns — conflicts are surfaced, never overwritten.",
  },
  {
    icon: BedDouble,
    title: "Restaurant bill to the room folio",
    body: "A guest's dinner posts straight to their room with one search on room or name. Front desk sees it on the folio the moment it lands, and checkout stays blocked until the balance settles.",
  },
  {
    icon: ReceiptText,
    title: "KRA/ETR invoicing that adds up",
    body: "Tax is computed per rate from line items and the property's tax-inclusive or exclusive setting. Every receipt shows VAT and levy separately, in KES, with two decimals — audit-ready by design.",
  },
];

const TARGETS = [
  { value: "1", label: "tap to add an item" },
  { value: "2", label: "taps to fire an order" },
  { value: "3", label: "taps to settle in cash" },
  { value: "48px", label: "touch targets everywhere" },
];

const STEPS = [
  "Choose the table, covers and waiter",
  "Add items — scan, tap or search",
  "Hold or fire to kitchen and bar",
  "Take cash, M-Pesa, card or room charge",
  "Count the drawer and close the shift",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <span className="font-display grid size-8 place-items-center rounded-md bg-[var(--action)] text-[15px] font-semibold text-[var(--action-foreground)]">
            O
          </span>
          <div className="leading-tight">
            <p className="text-[14px] font-semibold">OliTechs</p>
            <p className="text-[11px] text-muted-foreground">PMS + POS</p>
          </div>
          <nav className="ml-6 hidden items-center gap-6 text-[13px] text-muted-foreground md:flex">
            <a href="#offline" className="hover:text-foreground">
              Offline-first
            </a>
            <a href="#targets" className="hover:text-foreground">
              Built for service
            </a>
            <a href="#flow" className="hover:text-foreground">
              The flow
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden h-10 items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <ActionButton asChild className="h-10 px-4 text-[13px]">
              <Link to="/auth?returnTo=/pos">
                Open the POS
                <ArrowRight className="ml-1 size-4" aria-hidden="true" />
              </Link>
            </ActionButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[var(--ink)] text-[#f3f4f6]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:items-center md:px-6 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="inline-flex items-center gap-2 rounded-md border border-[#2a313b] px-2.5 py-1 text-[12px] font-medium text-[#9aa4b2]">
              <span
                className="size-1.5 rounded-full bg-[var(--action)]"
                aria-hidden="true"
              />
              Nairobi · KES · Africa/Nairobi · offline-first
            </p>
            <h1 className="font-display mt-5 text-[36px] font-semibold leading-[1.08] tracking-tight md:text-[52px]">
              Front desk to kitchen,
              <br />
              one system that
              <span className="text-[var(--action)]"> never stops</span>.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[16px] leading-7 text-[#9aa4b2]">
              OliTechs PMS + POS runs small and mid-size hotels, lodges and
              restaurants in Kenya — reservations, folios, restaurant orders,
              stock and KRA/ETR invoicing. Built for tablets under pressure and
              for connections that drop.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ActionButton asChild className="h-12 px-6 text-[15px]">
                <Link to="/auth?returnTo=/pos">
                  Open the POS
                  <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </Link>
              </ActionButton>
              <Link
                to="/auth"
                className="inline-flex h-12 items-center rounded-md border border-[#2a313b] px-6 text-[15px] font-medium text-[#f3f4f6] transition-colors hover:bg-[#1f252d]"
              >
                Sign in
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#9aa4b2]">
              {[
                "Cash · M-Pesa · Card · Room charge",
                "Tax per rate, KRA/ETR ready",
                "Works with no internet",
              ].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check
                    className="size-3.5 text-[var(--action)]"
                    aria-hidden="true"
                  />
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Computed ticket preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="rounded-lg border border-[#2a313b] bg-[#161b22]"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between border-b border-[#2a313b] px-4 py-3">
              <p className="text-[14px] font-semibold">
                Table 12 · Order A-1042
              </p>
              <span className="rounded-md border border-[#2a313b] px-2 py-0.5 text-[11px] text-[#9aa4b2]">
                Dine-in · 4 covers
              </span>
            </div>
            <ul className="divide-y divide-[#2a313b] px-4">
              {PREVIEW_LINES.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">
                      {l.name}
                      {l.variant ? ` · ${l.variant}` : ""}
                    </span>
                    <span className="tnum block text-[12px] text-[#9aa4b2]">
                      {l.qty} × {formatKES(l.unitPrice)}
                    </span>
                  </span>
                  <span className="tnum text-[13px] font-semibold">
                    {formatKES(l.qty * l.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-border px-4 py-3">
              <div className="flex justify-between text-[13px] text-[#9aa4b2]">
                <span>Subtotal (tax incl.)</span>
                <span className="tnum">{formatKES(previewTotals.gross)}</span>
              </div>
              {previewTotals.taxes.map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between text-[13px] text-[#9aa4b2]"
                >
                  <span>
                    {t.name} {(t.rate * 100).toFixed(0)}% (included)
                  </span>
                  <span className="tnum">{formatKES(t.amount)}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-dashed border-[#2a313b] pt-2">
                <span className="text-[14px] font-semibold">Total</span>
                <span className="tnum rounded-md bg-[var(--action)] px-2 py-1 text-[15px] font-semibold text-[var(--action-foreground)]">
                  {formatKES(previewTotals.total)}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Targets */}
      <section id="targets" className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border md:grid-cols-4">
          {TARGETS.map((t) => (
            <div key={t.label} className="bg-background px-4 py-6 md:px-6">
              <p className="font-display text-[28px] font-semibold leading-none">
                {t.value}
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {t.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        id="offline"
        className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20"
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Why it holds up
        </p>
        <h2 className="font-display mt-2 max-w-[24ch] text-[28px] font-semibold leading-tight md:text-[32px]">
          Designed for the pressure of service
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-shallow"
            >
              <span className="grid size-10 place-items-center rounded-md border border-border bg-secondary text-[var(--warning-text)]">
                <f.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold leading-snug">
                {f.title}
              </h3>
              <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section id="flow" className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Version 1
          </p>
          <h2 className="font-display mt-2 text-[28px] font-semibold leading-tight md:text-[32px]">
            Order to payment, five moves
          </h2>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className="rounded-lg border border-border bg-card p-4"
              >
                <span className="tnum text-[13px] font-semibold text-[var(--warning-text)]">
                  0{i + 1}
                </span>
                <p className="mt-1.5 text-[14px] font-medium leading-5">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--ink)] text-[#f3f4f6]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <h2 className="font-display text-[26px] font-semibold leading-tight md:text-[30px]">
              Take the first order on the POS
            </h2>
            <p className="mt-2 max-w-[52ch] text-[14px] leading-6 text-[#9aa4b2]">
              The order screen is live for signed-in front desk staff — table,
              covers, waiter, kitchen fire, M-Pesa, room charge and a drawer
              that reconciles at close.
            </p>
          </div>
          <ActionButton asChild className="h-12 shrink-0 px-6 text-[15px]">
            <Link to="/auth?returnTo=/pos">
              Open the POS
              <ArrowRight className="ml-1 size-4" aria-hidden="true" />
            </Link>
          </ActionButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-[12px] text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>© 2026 OliTechs · Hospitality software from Nairobi, Kenya</p>
          <p className="tnum">KES · Africa/Nairobi · PMS + POS</p>
        </div>
      </footer>
    </div>
  );
}
