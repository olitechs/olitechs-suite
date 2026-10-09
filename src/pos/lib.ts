/**
 * Money and time helpers.
 *
 * Rule: every total on screen is computed from line items, tax rules and
 * discounts — never typed in. Amounts are KES; we round at the boundary and
 * format with two decimals, the KES prefix and tabular numerals.
 */
import { PROPERTY, type TaxRule } from "./data";

export interface LineModifier {
  id: string;
  name: string;
  price: number;
  prep?: "less" | "normal" | "more";
}

export type LineStatus = "pending" | "sent" | "held" | "cancelled";

export interface OrderLine {
  id: string;
  productId: string;
  /** Unique per SKU: "Name · Variant". */
  name: string;
  variant?: string;
  sku: string;
  dept: "Kitchen" | "Bar";
  qty: number;
  /** Price captured when the line was added (price changes raise conflicts). */
  unitPrice: number;
  modifiers: LineModifier[];
  note?: string;
  course: 1 | 2 | 3;
  status: LineStatus;
  sentAt?: number;
}

export interface Tender {
  id: string;
  method: "cash" | "mpesa" | "card" | "bank" | "room";
  methodLabel: string;
  amount: number;
  reference?: string;
  room?: string;
  guest?: string;
  at: number;
  queued: boolean;
}

export type TenderMethod = Tender["method"];

export interface Discount {
  kind: "percent" | "amount";
  value: number;
  reason: string;
  approvedBy?: string;
}

const nf = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** "KES 1,850.00" — prefix, two decimals, never "$0.0". */
export function formatKES(amount: number): string {
  return `KES ${nf.format(round2(amount))}`;
}

/** "1,850.00" for cells that render the KES prefix in their own header. */
export function formatAmount(amount: number): string {
  return nf.format(round2(amount));
}

export function lineGross(line: OrderLine): number {
  const unit = line.unitPrice + line.modifiers.reduce((s, m) => s + m.price, 0);
  return round2(unit * line.qty);
}

export function displayName(line: OrderLine): string {
  return line.variant ? `${line.name} · ${line.variant}` : line.name;
}

export interface Totals {
  gross: number;
  discount: number;
  taxable: number;
  net: number;
  taxes: { id: string; name: string; rate: number; amount: number }[];
  total: number;
  paid: number;
  balance: number;
  inclusive: boolean;
}

export interface TotalsInput {
  lines: OrderLine[];
  discount: Discount | null;
  paid: number;
}

/**
 * Tax maths:
 * - inclusive property: price already contains every rule, so
 *   net = taxable / (1 + Σrates) and each tax = net × rate (they sum back
 *   exactly to the taxable amount).
 * - exclusive property: tax is added on top of the net.
 */
export function computeTotals({ lines, discount, paid }: TotalsInput): Totals {
  const gross = round2(
    lines
      .filter((l) => l.status !== "cancelled")
      .reduce((s, l) => s + lineGross(l), 0),
  );

  let discountAmount = 0;
  if (discount) {
    discountAmount =
      discount.kind === "percent"
        ? round2((gross * Math.min(Math.max(discount.value, 0), 100)) / 100)
        : round2(Math.min(Math.max(discount.value, 0), gross));
  }

  const taxable = round2(gross - discountAmount);
  const rules = PROPERTY.taxRules as readonly TaxRule[];
  const sumRates = rules.reduce((s, r) => s + r.rate, 0);

  let net: number;
  let taxes: Totals["taxes"];
  let total: number;

  if (PROPERTY.taxInclusive) {
    net = round2(taxable / (1 + sumRates));
    taxes = rules.map((r) => ({
      id: r.id,
      name: r.name,
      rate: r.rate,
      amount: round2(net * r.rate),
    }));
    total = taxable;
  } else {
    net = taxable;
    taxes = rules.map((r) => ({
      id: r.id,
      name: r.name,
      rate: r.rate,
      amount: round2(taxable * r.rate),
    }));
    total = round2(taxable + taxes.reduce((s, t) => s + t.amount, 0));
  }

  const paidR = round2(paid);
  return {
    gross,
    discount: discountAmount,
    taxable,
    net,
    taxes,
    total,
    paid: paidR,
    balance: round2(total - paidR),
    inclusive: PROPERTY.taxInclusive,
  };
}

/* --------------------------------------------------------------- time */

const clockFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: PROPERTY.timezone,
});

export function formatClock(ts: number): string {
  return clockFmt.format(new Date(ts));
}

export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function minutesSince(ts: number): number {
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

/** Idempotency key for payment submissions (prevents duplicate charges). */
export function idempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

let seq = 0;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}
