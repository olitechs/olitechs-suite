/**
 * Order entry zone — the heart of version 1.
 *
 * Layout: context strip (order type, table, covers, waiter) → search + barcode
 * → category chips → product grid; the ticket panel sits on the right (or
 * becomes a sheet on phones) and owns computed totals.
 *
 * Rules enforced here:
 * - Totals come from computeTotals() only — nothing is typed in.
 * - Sent lines are immutable: changes go through a void with reason + manager
 *   PIN (audit trail), never a silent edit.
 * - Touch targets are 48px throughout; money is KES, two decimals, tabular.
 */
import {
  Check,
  ChefHat,
  Pencil,
  Pause,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Wine,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AREAS,
  CATEGORIES,
  MODIFIER_GROUPS,
  ORDER_TYPES,
  PRODUCTS,
  PROPERTY,
  TABLES,
  WAITERS,
  type OrderType,
  type Product,
} from "./data";
import {
  displayName,
  formatElapsed,
  formatKES,
  lineGross,
  round2,
  type LineModifier,
  type OrderLine,
} from "./lib";
import {
  ActionButton,
  Kbd,
  Money,
  QuantityStepper,
  SegmentedControl,
  StatusBadge,
} from "./primitives";
import { usePos } from "./store";

/* ------------------------------------------------------------ helpers */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="max-w-[36ch] text-[13px] leading-5 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function TotalRow({
  label,
  sub,
  value,
  negative,
  prefixPlus,
  strong,
}: {
  label: string;
  sub?: string;
  value: number;
  negative?: boolean;
  prefixPlus?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "text-[13px] text-muted-foreground",
          strong && "text-foreground font-medium",
        )}
      >
        {label}
        {sub ? <span className="ml-1 text-[11px]">({sub})</span> : null}
      </span>
      <span
        className={cn(
          "money tnum",
          strong ? "text-[15px] font-semibold" : "text-[13px] font-medium",
        )}
      >
        {prefixPlus ? "+" : negative ? "−" : ""}
        {formatKES(value)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------- context strip */

export function OrderContextBar({ onPickTable }: { onPickTable: () => void }) {
  const { state, dispatch, table } = usePos();
  const ticket = state.ticket;

  const typeLabel =
    ORDER_TYPES.find((t) => t.id === ticket.orderType)?.label ?? "Dine-in";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5 md:px-6">
      <SegmentedControl<OrderType>
        ariaLabel="Order type"
        value={ticket.orderType}
        onChange={(orderType) =>
          dispatch({ type: "set-order-type", orderType })
        }
        options={ORDER_TYPES.map((t) => ({ value: t.id, label: t.label }))}
      />

      <button
        type="button"
        onClick={onPickTable}
        disabled={ticket.orderType !== "dine-in"}
        className="inline-flex h-12 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        title={
          ticket.orderType === "dine-in"
            ? "Change or transfer this table"
            : "Tables only apply to dine-in orders"
        }
      >
        {table ? (
          <>
            <ReceiptText
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            {table.name}
            <span className="text-muted-foreground">· {table.seats} seats</span>
          </>
        ) : (
          <>
            <Plus className="size-4 text-muted-foreground" aria-hidden="true" />
            Choose table
          </>
        )}
      </button>

      <div className="inline-flex h-12 items-center overflow-hidden rounded-md border border-border bg-card">
        <button
          type="button"
          aria-label="Fewer covers"
          onClick={() =>
            dispatch({ type: "set-covers", covers: ticket.covers - 1 })
          }
          className="grid size-12 place-items-center text-foreground hover:bg-secondary"
        >
          −
        </button>
        <span className="tnum w-16 border-x border-border text-center text-[13px] font-medium">
          {ticket.covers} covers
        </span>
        <button
          type="button"
          aria-label="More covers"
          onClick={() =>
            dispatch({ type: "set-covers", covers: ticket.covers + 1 })
          }
          className="grid size-12 place-items-center text-foreground hover:bg-secondary"
        >
          +
        </button>
      </div>

      <label className="inline-flex h-12 items-center gap-2 rounded-md border border-border bg-card pl-3 text-[13px] text-muted-foreground">
        Waiter
        <select
          value={ticket.waiterId}
          onChange={(e) =>
            dispatch({ type: "set-waiter", waiterId: e.target.value })
          }
          aria-label="Assigned waiter"
          className="h-full rounded-r-md border-l border-border bg-secondary px-2 text-[13px] font-medium text-foreground outline-none"
        >
          {WAITERS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>

      <span className="ml-auto hidden text-[12px] text-muted-foreground lg:inline">
        {typeLabel} · course control lives on the ticket — hold, then fire
      </span>
    </div>
  );
}

/* ------------------------------------------------------ product zone */

export function ProductZone({
  onAddRequested,
  barcodeRef,
}: {
  onAddRequested: (product: Product) => void;
  barcodeRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [barcode, setBarcode] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const errorTimer = useRef<number | null>(null);

  /* Cache hydration: shows the skeleton state exactly once on entry. */
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      if (e.key === "F2" || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () => () => {
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    },
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      const inCategory = category === "All" || p.category === category;
      const matches =
        !q ||
        `${p.name} ${p.variant ?? ""} ${p.sku} ${p.category}`
          .toLowerCase()
          .includes(q);
      return inCategory && matches;
    });
  }, [query, category]);

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = barcode.trim();
    if (!value) return;
    const found = PRODUCTS.find(
      (p) => p.barcode === value || p.sku.toLowerCase() === value.toLowerCase(),
    );
    if (found) {
      onAddRequested(found);
      setBarcode("");
      setBarcodeError(null);
      return;
    }
    setBarcodeError(`No item matches “${value}” — check the SKU or barcode.`);
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setBarcodeError(null), 4000);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search + barcode */}
      <div className="flex flex-col gap-2 border-b border-border bg-card px-4 py-2.5 md:flex-row md:px-6">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, SKU or category"
            aria-label="Search items"
            className="h-12 rounded-md pl-9 pr-16"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Kbd>F2</Kbd>
          </span>
        </div>
        <form onSubmit={handleBarcodeSubmit} className="md:w-[260px]">
          <Input
            ref={barcodeRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Barcode / SKU + Enter"
            aria-label="Barcode or SKU"
            aria-invalid={!!barcodeError}
            className={cn(
              "h-12 rounded-md",
              barcodeError && "border-[var(--danger)]",
            )}
          />
          {barcodeError ? (
            <p role="alert" className="mt-1 text-[12px] text-[var(--danger)]">
              {barcodeError}
            </p>
          ) : null}
        </form>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2.5 md:px-6">
        {["All", ...CATEGORIES].map((c) => {
          const active = c === category;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(c)}
              className={cn(
                "h-12 shrink-0 rounded-md border px-3.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] shadow-shallow"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No items match"
            description={`Nothing in this category matches “${query}”. Clear the search or scan the barcode instead.`}
            action={
              <Button
                variant="outline"
                className="h-12"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
              >
                Clear search
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={onAddRequested} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product) => void;
}) {
  const hasOptions = product.modifierGroupIds.length > 0;
  const Icon = product.dept === "Kitchen" ? ChefHat : Wine;
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      className={cn(
        "flex min-h-[132px] flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-all",
        "hover:border-[var(--strong-border)] hover:shadow-shallow active:scale-[0.99]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="tnum text-[11px] text-muted-foreground">
          {product.sku}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight">
          {product.name}
        </p>
        {product.variant ? (
          <p className="truncate text-[12px] text-muted-foreground">
            {product.variant}
          </p>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <Money value={product.price} className="text-[15px] font-semibold" />
        {hasOptions ? (
          <span className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
            <SlidersHorizontal className="size-3" aria-hidden="true" />
            options
          </span>
        ) : null}
      </div>
    </button>
  );
}

/* ------------------------------------------------------- ticket panel */

export function TicketPanel({
  onOpenPayment,
  onOpenDiscount,
  onVoidLine,
  onEditLine,
  onFocusBarcode,
  onClose,
}: {
  onOpenPayment: () => void;
  onOpenDiscount: () => void;
  onVoidLine: (line: OrderLine) => void;
  onEditLine: (line: OrderLine) => void;
  onFocusBarcode?: () => void;
  /** Phone only: closes the full-screen ticket overlay. */
  onClose?: () => void;
}) {
  const { state, dispatch, totals, table, pendingCount } = usePos();
  const ticket = state.ticket;
  const [confirmReset, setConfirmReset] = useState(false);

  const waiter = WAITERS.find((w) => w.id === ticket.waiterId);
  const typeLabel =
    ORDER_TYPES.find((t) => t.id === ticket.orderType)?.label ?? "Dine-in";
  const title =
    ticket.orderType === "dine-in"
      ? `${table?.name ?? "No table"} · Order ${ticket.id}`
      : `${typeLabel} · Order ${ticket.id}`;

  const sentCount = ticket.lines.filter((l) => l.status === "sent").length;
  const settled = ticket.status === "settled";
  const hasSent = sentCount > 0;

  const status =
    ticket.status === "settled"
      ? "settled"
      : ticket.status === "bill-printed"
        ? "bill-printed"
        : ticket.status === "held"
          ? "held"
          : "open";

  const handleSend = () => {
    if (pendingCount === 0) return;
    dispatch({
      type: "send-to-kitchen",
      label: `Send ${pendingCount} item${pendingCount > 1 ? "s" : ""} to kitchen`,
    });
    if (state.sync.online) {
      toast.success(
        `Fired ${pendingCount} item${pendingCount > 1 ? "s" : ""} to the stations`,
        { description: "Kitchen and bar displays updated." },
      );
    } else {
      toast.info("Order queued — fires when the connection returns", {
        description: "Saved on this device; no work is lost.",
      });
    }
  };

  const handlePreBill = () => {
    dispatch({ type: "pre-bill", label: `Print pre-bill for ${ticket.id}` });
    toast.success(`Pre-bill printed for ${ticket.id}`, {
      description: "Counter printer (local agent) · guest copy.",
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Title — matches the content it heads */}
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display truncate text-[16px] font-semibold leading-tight">
            {title}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={status as "open"} />
            <span className="text-[12px] text-muted-foreground">
              {ticket.covers} covers · {waiter?.name ?? "—"}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onClose ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close ticket"
              className="h-10 gap-1.5 px-2 text-[12px] text-muted-foreground"
            >
              <X className="size-4" aria-hidden="true" />
              Close
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmReset(true)}
            disabled={ticket.lines.length === 0 || settled || hasSent}
            title={
              hasSent
                ? "Void sent items one by one first (audit trail)"
                : "Discard this ticket"
            }
            className="h-10 gap-1.5 px-2 text-[12px] text-muted-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset order
          </Button>
        </div>
      </div>

      {/* Lines */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ticket.lines.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No items yet"
            description={`Order ${ticket.id} is open. Tap a product, or scan a barcode to start.`}
            action={
              onFocusBarcode ? (
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={onFocusBarcode}
                >
                  Focus barcode field
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {ticket.lines.map((line) => (
              <TicketLine
                key={line.id}
                line={line}
                locked={settled}
                onEdit={() => onEditLine(line)}
                onVoid={() => onVoidLine(line)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Totals — computed from lines, tax rules and the discount */}
      <div className="space-y-1.5 border-t border-border px-4 py-3">
        <TotalRow
          label="Subtotal"
          sub={totals.inclusive ? "tax incl." : "tax added below"}
          value={totals.gross}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-muted-foreground">
            Discount
            {ticket.discount ? (
              <span className="ml-1 text-[11px] text-muted-foreground">
                · {ticket.discount.reason}
              </span>
            ) : null}
          </span>
          <div className="flex items-center gap-2">
            {ticket.discount ? (
              <>
                <Money
                  value={totals.discount}
                  className="text-[13px] font-medium text-[var(--warning-text)]"
                />
                <button
                  type="button"
                  aria-label="Remove discount"
                  onClick={() =>
                    dispatch({
                      type: "set-discount",
                      discount: null,
                      label: "Remove discount",
                    })
                  }
                  className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenDiscount}
                disabled={ticket.lines.length === 0 || settled}
                className="h-9 gap-1 px-2 text-[12px]"
              >
                <Plus className="size-3" aria-hidden="true" />
                Add
              </Button>
            )}
          </div>
        </div>
        {totals.taxes.map((t) => (
          <TotalRow
            key={t.id}
            label={t.name}
            sub={`${(t.rate * 100).toFixed(0)}%${totals.inclusive ? " included" : ""}`}
            value={t.amount}
            prefixPlus={!totals.inclusive}
          />
        ))}
        <p className="pt-0.5 text-[11px] leading-4 text-muted-foreground">
          {totals.inclusive
            ? "Displayed prices include tax — per property setting (KRA/ETR)."
            : "Tax is added on top of prices — per property setting (KRA/ETR)."}
        </p>

        <div className="mt-1 border-t border-dashed border-[var(--strong-border)] pt-2">
          <div
            className="flex items-baseline justify-between gap-3"
            aria-live="polite"
          >
            <span className="text-[14px] font-semibold">Total</span>
            <Money value={totals.total} className="text-[20px] font-semibold" />
          </div>
        </div>
        {totals.paid > 0 ? (
          <>
            <TotalRow label="Paid" value={totals.paid} />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium">Balance due</span>
              <Money
                value={totals.balance}
                className={cn(
                  "text-[14px] font-semibold",
                  totals.balance > 0
                    ? "text-[var(--warning-text)]"
                    : "text-[var(--success-text)]",
                )}
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-border px-4 pb-4 pt-3">
        {settled ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-12 flex-1 gap-2 text-[14px]"
              onClick={() =>
                toast.success(`Receipt printed for ${ticket.id}`, {
                  description: state.sync.online
                    ? "Counter printer · ETR invoice registered."
                    : "Local print agent worked offline — ETR registration queued.",
                })
              }
            >
              <ReceiptText className="size-4" aria-hidden="true" />
              Print receipt
            </Button>
            <ActionButton
              className="h-12 flex-1 gap-2 text-[14px]"
              onClick={() =>
                dispatch({
                  type: "new-order",
                  label: `Start ${nextOrderHint(ticket.id)}`,
                })
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              New order
            </ActionButton>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                aria-pressed={ticket.status === "held"}
                onClick={() =>
                  dispatch({
                    type: "toggle-hold",
                    label:
                      ticket.status === "held" ? "Release hold" : "Hold order",
                  })
                }
                className={cn(
                  "h-12 flex-1 gap-1.5 text-[13px]",
                  ticket.status === "held" &&
                    "border-[var(--warning)] text-[var(--warning-text)]",
                )}
                title="Course control: pause sending this ticket"
              >
                <Pause className="size-4" aria-hidden="true" />
                {ticket.status === "held" ? "Release hold" : "Hold"}
              </Button>
              <Button
                variant="outline"
                onClick={handlePreBill}
                disabled={ticket.lines.length === 0}
                className="h-12 flex-1 gap-1.5 text-[13px]"
                title="Print the guest's bill without settling"
              >
                <ReceiptText className="size-4" aria-hidden="true" />
                Pre-bill
              </Button>
              <Button
                variant="outline"
                onClick={handleSend}
                disabled={pendingCount === 0}
                className="h-12 flex-1 gap-1.5 text-[13px]"
                title="Fire all pending items to kitchen/bar displays"
              >
                <Send className="size-4" aria-hidden="true" />
                Send{pendingCount > 0 ? ` (${pendingCount})` : ""}
              </Button>
            </div>
            <ActionButton
              onClick={onOpenPayment}
              disabled={ticket.lines.length === 0}
              className="h-12 w-full text-[15px]"
            >
              Pay {formatKES(totals.balance)}
            </ActionButton>
          </>
        )}
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset order {ticket.id}?</DialogTitle>
            <DialogDescription>
              All {ticket.lines.length} line items and any discount will be
              discarded. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-12"
              onClick={() => setConfirmReset(false)}
            >
              Keep order
            </Button>
            <Button
              variant="destructive"
              className="h-12"
              onClick={() => {
                dispatch({ type: "reset-ticket", label: `Reset ${ticket.id}` });
                setConfirmReset(false);
                toast.info(`Order ${ticket.id} reset`);
              }}
            >
              Reset order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function nextOrderHint(currentId: string): string {
  const n = parseInt(currentId.split("-")[1] ?? "1042", 10);
  return `A-${n + 1}`;
}

function TicketLine({
  line,
  locked,
  onEdit,
  onVoid,
}: {
  line: OrderLine;
  locked: boolean;
  onEdit: () => void;
  onVoid: () => void;
}) {
  const { dispatch } = usePos();
  const Icon = line.dept === "Kitchen" ? ChefHat : Wine;
  const editable = line.status === "pending" && !locked;

  const statusLabel =
    line.status === "sent" ? `Sent · ${line.dept}` : undefined;

  return (
    <li className="px-4 py-3 transition-colors hover:bg-secondary/60">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14px] font-medium leading-tight">
              {line.name}
              {line.variant ? (
                <span className="text-muted-foreground"> · {line.variant}</span>
              ) : null}
            </p>
            <Money
              value={lineGross(line)}
              className="text-[14px] font-semibold"
            />
          </div>

          {line.modifiers.length > 0 ? (
            <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
              {line.modifiers
                .map(
                  (m) =>
                    `${m.name}${m.prep && m.prep !== "normal" ? ` (${m.prep})` : ""}${
                      m.price > 0 ? ` +${formatKES(m.price)}` : ""
                    }`,
                )
                .join(" · ")}
            </p>
          ) : null}
          {line.note ? (
            <p className="mt-1 text-[12px] italic leading-4 text-muted-foreground">
              “{line.note}”
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={line.status} label={statusLabel} />
            <span className="tnum text-[12px] text-muted-foreground">
              {formatKES(line.unitPrice)} each
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <QuantityStepper
          value={line.qty}
          ariaLabel={displayName(line)}
          disabled={!editable}
          onStep={(delta) =>
            dispatch({
              type: "inc-qty",
              id: line.id,
              delta,
              label: `${delta > 0 ? "Add" : "Remove"} ${displayName(line)}`,
            })
          }
        />
        <div className="ml-auto flex items-center gap-1">
          {editable ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${displayName(line)}`}
                title="Edit modifiers and notes"
                className="grid size-12 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: "remove-line",
                    id: line.id,
                    label: `Remove ${displayName(line)}`,
                  })
                }
                aria-label={`Remove ${displayName(line)}`}
                title="Remove item"
                className="grid size-12 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : locked ? (
            <span
              title="Settled tickets change only through refunds (arrives after version 1)"
              className="grid size-12 place-items-center rounded-md border border-border bg-secondary text-muted-foreground"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </span>
          ) : (
            <button
              type="button"
              onClick={onVoid}
              aria-label={`Void ${displayName(line)}`}
              title="Already sent — void needs a manager PIN"
              className="grid size-12 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------ modifier sheet */

type Prep = "less" | "normal" | "more";

export function ModifierSheet({
  product,
  existingLine,
  open,
  onClose,
}: {
  product: Product | null;
  existingLine?: OrderLine | null;
  open: boolean;
  onClose: () => void;
}) {
  const { dispatch, addToOrder } = usePos();
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    if (!product) return {};
    const sel: Record<string, string[]> = {};
    for (const gid of product.modifierGroupIds) sel[gid] = [];
    if (existingLine) {
      for (const m of existingLine.modifiers) {
        const gid = product.modifierGroupIds.find((gid2) =>
          MODIFIER_GROUPS.find((g) => g.id === gid2)?.options.some(
            (o) => o.id === m.id,
          ),
        );
        if (gid) sel[gid] = [...(sel[gid] ?? []), m.id];
      }
    }
    return sel;
  });
  const [preps, setPreps] = useState<Record<string, Prep>>(() => {
    const prp: Record<string, Prep> = {};
    if (existingLine && product) {
      for (const m of existingLine.modifiers) {
        if (m.prep) prp[m.id] = m.prep;
      }
    }
    return prp;
  });
  const [note, setNote] = useState(existingLine?.note ?? "");
  const [showErrors, setShowErrors] = useState(false);

  if (!product) return null;

  const groups = product.modifierGroupIds
    .map((gid) => MODIFIER_GROUPS.find((g) => g.id === gid))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const missing = groups.filter(
    (g) => g.min > 0 && (selections[g.id]?.length ?? 0) < g.min,
  );
  const valid = missing.length === 0;

  const chosen: LineModifier[] = groups.flatMap((g) =>
    (selections[g.id] ?? []).map((oid) => {
      const opt = g.options.find((o) => o.id === oid)!;
      return {
        id: opt.id,
        name: opt.name,
        price: opt.price,
        prep: g.allowPrep ? (preps[oid] ?? "normal") : undefined,
      };
    }),
  );
  const unitTotal = round2(
    product.price + chosen.reduce((s, m) => s + m.price, 0),
  );
  const surcharge = round2(chosen.reduce((s, m) => s + m.price, 0));

  function toggle(group: (typeof groups)[number], optionId: string) {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      const has = current.includes(optionId);
      if (group.max === 1) {
        if (has && group.min === 0) return { ...prev, [group.id]: [] };
        if (has) return prev;
        return { ...prev, [group.id]: [optionId] };
      }
      if (has)
        return { ...prev, [group.id]: current.filter((x) => x !== optionId) };
      if (current.length >= group.max) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  const handleConfirm = () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    if (existingLine) {
      dispatch({
        type: "update-line",
        id: existingLine.id,
        patch: { modifiers: chosen, note: note.trim() || undefined },
        label: `Update ${product.name}`,
      });
      toast.success(`${product.name} updated`);
    } else {
      addToOrder(product.id, chosen, note);
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-border bg-card p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="font-display text-[16px]">
            {existingLine ? "Edit" : "Choose options"} · {product.name}
            {product.variant ? ` ${product.variant}` : ""}
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            {product.sku} · required choices are marked · surcharges update the
            line total
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {groups.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No options for this item — add a kitchen note below.
            </p>
          ) : null}

          {groups.map((g) => {
            const selected = selections[g.id] ?? [];
            const showError =
              showErrors && g.min > 0 && selected.length < g.min;
            return (
              <section key={g.id}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-[13px] font-semibold">{g.name}</h3>
                  <span
                    className={cn(
                      "text-[11px]",
                      g.min > 0
                        ? "font-medium text-[var(--warning-text)]"
                        : "text-muted-foreground",
                    )}
                  >
                    {g.min > 0 ? "Required · choose 1" : "Optional"}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {g.options.map((o) => {
                    const on = selected.includes(o.id);
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(g, o.id)}
                          className={cn(
                            "flex min-h-12 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                            on
                              ? "border-[var(--strong-border)] bg-secondary"
                              : "border-border bg-card hover:bg-secondary/60",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded border",
                              on
                                ? "border-transparent bg-[var(--primary)] text-[var(--action-foreground)]"
                                : "border-[var(--strong-border)] bg-card",
                            )}
                          >
                            {on ? (
                              <Check className="size-3.5" aria-hidden="true" />
                            ) : null}
                          </span>
                          <span className="flex-1 text-[14px]">{o.name}</span>
                          {o.price > 0 ? (
                            <span className="tnum text-[13px] font-medium">
                              +{formatKES(o.price)}
                            </span>
                          ) : null}
                        </button>
                        {on && g.allowPrep ? (
                          <div className="mt-1 pl-8">
                            <SegmentedControl<Prep>
                              ariaLabel={`Preparation for ${o.name}`}
                              value={preps[o.id] ?? "normal"}
                              onChange={(v) =>
                                setPreps((p) => ({ ...p, [o.id]: v }))
                              }
                              options={[
                                { value: "less", label: "Less" },
                                { value: "normal", label: "Normal" },
                                { value: "more", label: "More" },
                              ]}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {showError ? (
                  <p
                    role="alert"
                    className="mt-1.5 text-[12px] text-[var(--danger)]"
                  >
                    Choose {g.min} option{g.min > 1 ? "s" : ""} in {g.name} to
                    continue.
                  </p>
                ) : null}
              </section>
            );
          })}

          <div className="space-y-1.5">
            <Label htmlFor="line-note" className="text-[13px]">
              Note for kitchen{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="line-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. no onions, serve first"
              className="min-h-[64px] resize-none text-[14px]"
            />
          </div>
        </div>

        <SheetFooter className="border-t border-border px-4 py-3">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="text-[12px] leading-4 text-muted-foreground">
              {surcharge > 0 ? (
                <span>Options add {formatKES(surcharge)}</span>
              ) : (
                <span>No options selected</span>
              )}
              <br />
              <span className="tnum text-[13px] font-semibold text-foreground">
                {formatKES(unitTotal)} each
              </span>
            </div>
            <ActionButton
              onClick={handleConfirm}
              className="h-12 flex-1 text-[14px]"
            >
              {existingLine ? "Save changes" : "Add to order"}
              {" · "}
              {formatKES(
                existingLine ? unitTotal * existingLine.qty : unitTotal,
              )}
            </ActionButton>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------- discount dialog */

export function DiscountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, dispatch, totals } = usePos();
  const existing = state.ticket.discount;
  const [kind, setKind] = useState<"percent" | "amount">(
    existing?.kind ?? "percent",
  );
  const [value, setValue] = useState(existing ? String(existing.value) : "");
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const numeric = parseFloat(value);
  const needsApproval = kind === "percent" && numeric > 10;
  const valid =
    !Number.isNaN(numeric) &&
    numeric > 0 &&
    (kind === "amount" ? numeric <= totals.gross : numeric <= 100) &&
    reason.trim().length >= 3 &&
    (!needsApproval || pin.length >= 4);

  const preview = Number.isNaN(numeric)
    ? 0
    : kind === "percent"
      ? round2((totals.gross * Math.min(numeric, 100)) / 100)
      : Math.min(numeric, totals.gross);
  const newTotal = round2(totals.gross - preview);

  const apply = () => {
    if (!valid) {
      setError(
        Number.isNaN(numeric) || numeric <= 0
          ? "Enter a discount value greater than zero."
          : reason.trim().length < 3
            ? "A reason is required — discounts are audited."
            : needsApproval && pin !== PROPERTY.managerPin
              ? "Incorrect PIN. Discounts above 10% need the manager on duty."
              : null,
      );
      return;
    }
    dispatch({
      type: "set-discount",
      discount: {
        kind,
        value: numeric,
        reason: reason.trim(),
        approvedBy: needsApproval ? "Manager on duty" : undefined,
      },
      label: `Discount ${kind === "percent" ? `${numeric}%` : formatKES(numeric)}`,
    });
    toast.success(`Discount applied · ${formatKES(preview)}`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Order discount</DialogTitle>
          <DialogDescription>
            Applied to the whole ticket. Everything here is computed from line
            totals — nothing is typed into the total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <SegmentedControl<"percent" | "amount">
            ariaLabel="Discount kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: "percent", label: "Percent" },
              { value: "amount", label: "Amount (KES)" },
            ]}
          />

          <div className="grid gap-1.5">
            <Label htmlFor="disc-value">
              {kind === "percent" ? "Percentage" : "Amount in KES"}
            </Label>
            <Input
              id="disc-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === "percent" ? "10" : "200"}
              className="tnum h-12"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="disc-reason">Reason (required)</Label>
            <Input
              id="disc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. regular guest, service recovery"
              className="h-12"
            />
          </div>

          {needsApproval ? (
            <div className="grid gap-1.5 rounded-md border border-border bg-secondary p-3">
              <Label htmlFor="disc-pin">
                Manager PIN{" "}
                <span className="text-muted-foreground">
                  (&gt;10% approval)
                </span>
              </Label>
              <Input
                id="disc-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="tnum h-12"
              />
              <p className="text-[11px] text-muted-foreground">
                Prototype PIN: 1234
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-md border border-dashed border-[var(--strong-border)] px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">Preview</span>
            <span className="tnum font-medium">
              −{formatKES(preview)} → <strong>{formatKES(newTotal)}</strong>
            </span>
          </div>

          {error ? (
            <p role="alert" className="text-[12px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {existing ? (
            <Button
              variant="outline"
              className="h-12 text-[var(--danger)]"
              onClick={() => {
                dispatch({
                  type: "set-discount",
                  discount: null,
                  label: "Remove discount",
                });
                onClose();
              }}
            >
              Remove discount
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="h-12" onClick={onClose}>
              Cancel
            </Button>
            <ActionButton className="h-12" onClick={apply} disabled={!valid}>
              Apply discount
            </ActionButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------- void dialog */

export function VoidDialog({
  line,
  onClose,
}: {
  line: OrderLine | null;
  onClose: () => void;
}) {
  const { dispatch, state } = usePos();
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!line) return null;

  const valid = reason.trim().length >= 3 && pin.length >= 4;

  const confirm = () => {
    if (reason.trim().length < 3) {
      setError("A reason is required — voids are written to the audit trail.");
      return;
    }
    if (pin !== PROPERTY.managerPin) {
      setError("Incorrect PIN. Ask the manager on duty to approve this void.");
      return;
    }
    dispatch({
      type: "remove-line",
      id: line.id,
      label: `Void ${displayName(line)} — ${reason.trim()}`,
    });
    toast.success(`${displayName(line)} voided`, {
      description: `Reason recorded · ${reason.trim()}${
        state.sync.online ? "" : " · queued for sync"
      }`,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Void sent item</DialogTitle>
          <DialogDescription>
            {displayName(line)} was already fired to the{" "}
            {line.dept.toLowerCase()}. Changing it needs a reason and a manager
            PIN — both are kept in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">Line value</span>
            <Money value={lineGross(line)} className="font-semibold" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="void-reason">Reason (required)</Label>
            <Input
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. guest changed order"
              className="h-12"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="void-pin">Manager PIN</Label>
            <Input
              id="void-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="tnum h-12"
            />
            <p className="text-[11px] text-muted-foreground">
              Prototype PIN: 1234
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-[12px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-12" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="h-12"
            disabled={!valid}
            onClick={confirm}
          >
            Void item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------ table picker */

export function TablePickerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, dispatch, table } = usePos();
  const [area, setArea] = useState<string>("all");

  const tables = TABLES.filter((t) => area === "all" || t.area === area);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Choose a table</DialogTitle>
          <DialogDescription>
            Free tables can take this order. Occupied tables belong to another
            ticket until it settles.
          </DialogDescription>
        </DialogHeader>

        <SegmentedControl<string>
          ariaLabel="Area"
          value={area}
          onChange={setArea}
          options={[
            { value: "all", label: "All areas" },
            ...AREAS.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />

        <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {tables.map((t) => {
            const isCurrent = t.id === table?.id;
            const selectable = isCurrent || t.status === "free";
            const label =
              t.status === "occupied"
                ? "Occupied by another order"
                : t.status === "reserved"
                  ? "Reserved — seat from the floor plan (arrives after v1)"
                  : undefined;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!selectable}
                title={label}
                onClick={() => {
                  dispatch({
                    type: "set-table",
                    tableId: t.id,
                    label: `Move to ${t.name}`,
                  });
                  toast.success(`${t.name} assigned to ${state.ticket.id}`);
                  onClose();
                }}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all",
                  isCurrent
                    ? "border-[var(--info)] bg-secondary"
                    : "border-border bg-card hover:shadow-shallow",
                  !selectable && "cursor-not-allowed opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold">{t.name}</span>
                  <StatusBadge status={t.status} className="h-5 px-1.5" />
                </div>
                <span className="text-[12px] text-muted-foreground">
                  {t.seats} seats ·{" "}
                  {t.elapsedMin
                    ? `seated ${formatElapsed(t.elapsedMin)}`
                    : "not seated"}
                </span>
                {t.amount ? (
                  <Money value={t.amount} className="text-[13px] font-medium" />
                ) : null}
                {isCurrent ? (
                  <span className="text-[11px] font-medium text-[var(--info)]">
                    Current table
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-12" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
