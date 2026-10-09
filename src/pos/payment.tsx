/**
 * Payment drawer (Stage 2, screen 4) — tenders as rows, split by amount,
 * change due, room charge with room search, and the primary button's
 * disabled / processing / success / failure states.
 *
 * Offline rules: cash always works; M-Pesa, card and bank need a connection;
 * room charge is allowed offline because folios are cached and the posting is
 * queued. Submissions carry an idempotency key so a double tap cannot charge
 * twice.
 */
import {
  Banknote,
  BedDouble,
  CircleCheck,
  CreditCard,
  Landmark,
  Loader2,
  Printer,
  Smartphone,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { IN_HOUSE_ROOMS } from "./data";
import {
  formatKES,
  idempotencyKey,
  round2,
  type Tender,
  type TenderMethod,
} from "./lib";
import {
  ActionButton,
  Money,
  NumericKeypad,
  StatusBadge,
  applyKey,
} from "./primitives";
import { usePos } from "./store";

interface MethodSpec {
  id: TenderMethod;
  label: string;
  hint: string;
  icon: ReactNode;
  needsOnline: boolean;
}

const METHODS: MethodSpec[] = [
  {
    id: "cash",
    label: "Cash",
    hint: "Counts into the drawer",
    icon: <Banknote className="size-4" aria-hidden="true" />,
    needsOnline: false,
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    hint: "STK push to the guest",
    icon: <Smartphone className="size-4" aria-hidden="true" />,
    needsOnline: true,
  },
  {
    id: "card",
    label: "Card",
    hint: "Tap / insert on terminal",
    icon: <CreditCard className="size-4" aria-hidden="true" />,
    needsOnline: true,
  },
  {
    id: "bank",
    label: "Bank transfer",
    hint: "Record the reference",
    icon: <Landmark className="size-4" aria-hidden="true" />,
    needsOnline: true,
  },
  {
    id: "room",
    label: "Room charge",
    hint: "Posts to the guest folio",
    icon: <BedDouble className="size-4" aria-hidden="true" />,
    needsOnline: false,
  },
];

/** Idempotent tender builder — impure work (ids, timestamps) lives here so
 * component render stays pure. */
function buildTender(opts: {
  method: TenderMethod;
  label: string;
  amount: number;
  bankRef: string;
  room: { room: string; guest: string } | null;
  online: boolean;
}): Tender {
  return {
    id: idempotencyKey("tnd"),
    method: opts.method,
    methodLabel: opts.label,
    amount: opts.amount,
    reference:
      opts.method === "mpesa"
        ? `ALG${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : opts.method === "bank"
          ? opts.bankRef.trim().toUpperCase()
          : undefined,
    room: opts.method === "room" ? opts.room?.room : undefined,
    guest: opts.method === "room" ? opts.room?.guest : undefined,
    at: Date.now(),
    queued: !opts.online,
  };
}

/** One selectable tender row: icon + label + hint, colour never alone. */
export function TenderRow({
  spec,
  selected,
  disabled,
  offline,
  onSelect,
}: {
  spec: MethodSpec;
  selected: boolean;
  disabled: boolean;
  offline: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        selected
          ? "border-[var(--info)] bg-secondary"
          : "border-border bg-card hover:bg-secondary/60",
        disabled && "cursor-not-allowed opacity-60 hover:bg-card",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md border border-border",
          selected
            ? "bg-card text-foreground"
            : "bg-secondary text-muted-foreground",
        )}
      >
        {spec.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium leading-tight">
          {spec.label}
        </span>
        <span className="block text-[12px] leading-tight text-muted-foreground">
          {spec.needsOnline && offline ? "Needs a connection" : spec.hint}
        </span>
      </span>
      {spec.needsOnline && offline ? (
        <StatusBadge status="offline" label="Offline" />
      ) : null}
    </button>
  );
}

export function PaymentSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, dispatch, totals } = usePos();
  const online = state.sync.online;
  const balance = totals.balance;

  const [method, setMethod] = useState<TenderMethod>("cash");
  const [amountStr, setAmountStr] = useState(() =>
    round2(Math.max(balance, 0)).toFixed(2),
  );
  const [phone, setPhone] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [room, setRoom] = useState<(typeof IN_HOUSE_ROOMS)[number] | null>(
    null,
  );
  const [roomQuery, setRoomQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "failed">(
    "idle",
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [forceDecline, setForceDecline] = useState(false);
  const [changeDue, setChangeDue] = useState<number | null>(null);
  const attemptRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const settled =
    state.ticket.lines.length > 0 &&
    state.ticket.tenders.length > 0 &&
    balance <= 0;

  /* The drawer is keyed at its call site, so every open starts from a clean
     state — no reset-on-open effect needed. */
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const tenderAmount = round2(parseFloat(amountStr) || 0);
  const spec = METHODS.find((m) => m.id === method)!;
  const methodOfflineBlocked = spec.needsOnline && !online;

  const rooms = IN_HOUSE_ROOMS.filter((r) => {
    const q = roomQuery.trim().toLowerCase();
    return (
      !q ||
      r.room.toLowerCase().includes(q) ||
      r.guest.toLowerCase().includes(q)
    );
  });

  /* Validation decides the disabled state of the primary button. */
  let disabledReason: string | null = null;
  if (tenderAmount <= 0) disabledReason = "Enter an amount";
  else if (methodOfflineBlocked)
    disabledReason = `${spec.label} needs a connection`;
  else if (method !== "cash" && tenderAmount > balance)
    disabledReason = "Amount exceeds the balance due";
  else if (method === "mpesa" && !/^0[17]\d{8}$/.test(phone.replace(/\s/g, "")))
    disabledReason = "Enter a valid Safaricom number (07XX XXX XXX)";
  else if (method === "bank" && bankRef.trim().length < 4)
    disabledReason = "Bank reference is required";
  else if (method === "room" && !room)
    disabledReason = "Choose the room to charge";

  const canCharge = !disabledReason && status !== "processing" && !settled;

  const appliedAmount =
    method === "cash"
      ? Math.min(tenderAmount, Math.max(balance, 0))
      : tenderAmount;
  const cashChange = method === "cash" ? round2(tenderAmount - balance) : 0;

  function finishTender() {
    const applied = round2(appliedAmount);
    if (applied <= 0) return;
    dispatch({
      type: "add-tender",
      tender: buildTender({
        method,
        label: spec.label,
        amount: applied,
        bankRef,
        room,
        online,
      }),
      label: `${spec.label} ${formatKES(applied)}`,
    });

    const remaining = round2(balance - applied);
    if (method === "cash" && cashChange > 0) {
      setChangeDue(cashChange);
      toast.success(`Change due ${formatKES(cashChange)}`, {
        description: "Drawer opens once — count back to the guest.",
      });
    } else {
      setChangeDue(null);
    }

    if (remaining <= 0) {
      toast.success(`Order settled · ${formatKES(totals.total)}`, {
        description: online
          ? "All tenders confirmed · ETR invoice issued."
          : "Tenders queued — they sync when the connection returns.",
      });
      setStatus("idle");
      setFailure(null);
    } else {
      toast.success(`${spec.label} applied · ${formatKES(applied)}`, {
        description: `Balance due ${formatKES(remaining)} — add another tender to finish.`,
      });
      setAmountStr(remaining.toFixed(2));
      setStatus("idle");
      setFailure(null);
    }
    attemptRef.current = false;
  }

  function handleCharge() {
    if (!canCharge || attemptRef.current) return; // idempotent: one tap, one attempt
    attemptRef.current = true;
    setFailure(null);

    if (method === "cash") {
      finishTender();
      return;
    }

    setStatus("processing");
    const latency = method === "mpesa" ? 1700 : method === "card" ? 1400 : 700;
    timerRef.current = window.setTimeout(() => {
      if (forceDecline) {
        setStatus("failed");
        setFailure(
          method === "mpesa"
            ? "M-Pesa request cancelled by customer (code 1032). Ask them to approve, or take another tender."
            : method === "card"
              ? "Card declined by issuer (code 05). Try again or choose another tender."
              : "Could not confirm the transfer with the bank. Record it later or choose another tender.",
        );
        attemptRef.current = false;
        return;
      }
      finishTender();
    }, latency);
  }

  /* ------------------------------------------------------- success view */
  if (settled) {
    const tendered = totals.paid;
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-border bg-card p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="font-display flex items-center gap-2 text-[16px]">
              <CircleCheck
                className="size-5 text-[var(--success-text)]"
                aria-hidden="true"
              />
              Settled in full
            </SheetTitle>
            <SheetDescription className="text-[12px]">
              Order {state.ticket.id} · paid by {state.ticket.tenders.length}{" "}
              tender{state.ticket.tenders.length > 1 ? "s" : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 px-4 py-4">
            <div className="space-y-1.5 rounded-lg border border-border bg-secondary p-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <Money value={totals.total} className="font-semibold" />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tendered</span>
                <Money value={tendered} className="font-medium" />
              </div>
              <div className="flex justify-between border-t border-dashed border-[var(--strong-border)] pt-1.5">
                <span className="font-medium">Change given</span>
                <Money
                  value={changeDue ?? 0}
                  className="font-semibold text-[var(--success-text)]"
                />
              </div>
            </div>

            <ul className="space-y-1.5">
              {state.ticket.tenders.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-[13px]"
                >
                  <span className="font-medium">{t.methodLabel}</span>
                  <span className="flex items-center gap-2">
                    {t.reference ? (
                      <span className="tnum text-[12px] text-muted-foreground">
                        {t.reference}
                      </span>
                    ) : null}
                    <Money value={t.amount} className="font-medium" />
                    <StatusBadge
                      status={t.queued ? "offline" : "paid"}
                      label={t.queued ? "Queued" : "Confirmed"}
                      className="h-5 px-1.5"
                    />
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-[12px] leading-4 text-muted-foreground">
              {online
                ? "KRA/ETR invoice issued for this receipt."
                : "Tenders are queued on this device and will confirm when the connection returns."}
            </p>
          </div>

          <SheetFooter className="gap-2 border-t border-border px-4 py-3">
            <Button
              variant="outline"
              className="h-12 flex-1 gap-2 text-[14px]"
              onClick={() =>
                toast.success(`Receipt printed for ${state.ticket.id}`, {
                  description: "Counter printer (local print agent).",
                })
              }
            >
              <Printer className="size-4" aria-hidden="true" />
              Print receipt
            </Button>
            <ActionButton
              className="h-12 flex-1 text-[14px]"
              onClick={() => {
                dispatch({ type: "new-order", label: "Start next order" });
                onClose();
              }}
            >
              New order
            </ActionButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  /* ---------------------------------------------------------- entry view */
  const quickCash = Array.from(
    new Set(
      [
        round2(Math.max(balance, 0)),
        round2(Math.ceil(Math.max(balance, 0) / 500) * 500),
        round2(Math.ceil(Math.max(balance, 0) / 1000) * 1000),
        10000,
      ].filter((v) => v >= Math.max(balance, 0)),
    ),
  );

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
            Settle · Order {state.ticket.id}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-[12px]">
            Balance due
            <Money
              value={balance}
              className="text-[15px] font-semibold text-foreground"
            />
            {state.ticket.tenders.length > 0 ? (
              <span>
                · split across {state.ticket.tenders.length} tender(s)
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Applied tenders */}
          {state.ticket.tenders.length > 0 ? (
            <ul className="space-y-1.5">
              {state.ticket.tenders.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-[13px]"
                >
                  <span className="font-medium">{t.methodLabel}</span>
                  {t.room ? (
                    <span className="text-muted-foreground">
                      · room {t.room}
                    </span>
                  ) : null}
                  <Money value={t.amount} className="ml-auto font-medium" />
                  <button
                    type="button"
                    aria-label={`Undo ${t.methodLabel} tender`}
                    title="Undo this tender (not yet settled)"
                    onClick={() =>
                      dispatch({
                        type: "undo-tender",
                        id: t.id,
                        label: `Undo ${t.methodLabel} tender`,
                      })
                    }
                    className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-[var(--danger)]"
                  >
                    <Undo2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Tender methods */}
          <div
            role="radiogroup"
            aria-label="Tender method"
            className="space-y-1.5"
          >
            {METHODS.map((m) => (
              <TenderRow
                key={m.id}
                spec={m}
                selected={m.id === method}
                offline={!online}
                disabled={m.needsOnline && !online}
                onSelect={() => {
                  setMethod(m.id);
                  setFailure(null);
                  setStatus("idle");
                }}
              />
            ))}
          </div>

          {/* Method detail */}
          {method === "cash" ? (
            <div className="space-y-2">
              <Label htmlFor="cash-tendered" className="text-[13px]">
                Amount tendered
              </Label>
              <Input
                id="cash-tendered"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="tnum h-12 text-right text-[18px] font-semibold"
              />
              <div className="flex flex-wrap gap-1.5">
                {quickCash.map((v, i) => (
                  <button
                    key={`${v}-${i}`}
                    type="button"
                    onClick={() => setAmountStr(v.toFixed(2))}
                    className="h-12 rounded-md border border-border bg-card px-2.5 text-[12px] font-medium transition-colors hover:bg-secondary"
                  >
                    {i === 0 ? "Exact " : ""}
                    {formatKES(v)}
                  </button>
                ))}
              </div>
              <NumericKeypad
                onKey={(k) => setAmountStr((cur) => applyKey(cur, k))}
                className="mt-1"
              />
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-[13px]">
                <span className="text-muted-foreground">Change due</span>
                <Money
                  value={cashChange > 0 ? cashChange : 0}
                  className={cn(
                    "font-semibold",
                    cashChange > 0
                      ? "text-[var(--success-text)]"
                      : "text-muted-foreground",
                  )}
                />
              </div>
            </div>
          ) : null}

          {method === "mpesa" ? (
            <div className="space-y-1.5">
              <Label htmlFor="mpesa-phone" className="text-[13px]">
                Customer phone
              </Label>
              <Input
                id="mpesa-phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="tnum h-12"
              />
              <p className="text-[12px] text-muted-foreground">
                An STK push is sent for {formatKES(tenderAmount)} — the customer
                enters their PIN to approve.
              </p>
            </div>
          ) : null}

          {method === "card" ? (
            <div className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[13px] text-muted-foreground">
              Present the card on the terminal for {formatKES(tenderAmount)}.
              The terminal confirms before the tender is recorded.
            </div>
          ) : null}

          {method === "bank" ? (
            <div className="space-y-1.5">
              <Label htmlFor="bank-ref" className="text-[13px]">
                Bank reference (required)
              </Label>
              <Input
                id="bank-ref"
                value={bankRef}
                onChange={(e) => setBankRef(e.target.value)}
                placeholder="e.g. FT24109ABC"
                className="h-12 uppercase"
              />
            </div>
          ) : null}

          {method === "room" ? (
            <div className="space-y-2">
              <Label htmlFor="room-search" className="text-[13px]">
                Room or guest
              </Label>
              <Input
                id="room-search"
                value={roomQuery}
                onChange={(e) => setRoomQuery(e.target.value)}
                placeholder="Search in-house rooms"
                className="h-12"
              />
              <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                {rooms.length === 0 ? (
                  <li className="rounded-md border border-dashed border-border px-3 py-3 text-center text-[12px] text-muted-foreground">
                    No in-house room matches “{roomQuery}”.
                  </li>
                ) : (
                  rooms.map((r) => {
                    const active = room?.room === r.room;
                    return (
                      <li key={r.room}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setRoom(active ? null : r)}
                          className={cn(
                            "flex min-h-12 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                            active
                              ? "border-[var(--info)] bg-secondary"
                              : "border-border bg-card hover:bg-secondary/60",
                          )}
                        >
                          <span className="tnum w-9 text-[14px] font-semibold">
                            {r.room}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">
                              {r.guest}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              folio balance {formatKES(r.folioBalance)}
                            </span>
                          </span>
                          {active ? (
                            <CircleCheck
                              className="size-4 text-[var(--info)]"
                              aria-hidden="true"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <p className="text-[12px] text-muted-foreground">
                {online
                  ? "Posts to the folio immediately."
                  : "Folios are cached — this queues and posts on sync."}
              </p>
            </div>
          ) : null}

          {/* Failure state */}
          {failure ? (
            <div
              role="alert"
              className="rounded-md border border-[var(--danger)] bg-card px-3 py-2.5 text-[13px] text-[var(--danger)]"
            >
              <p className="font-medium">Payment failed</p>
              <p className="mt-0.5 leading-5">{failure}</p>
            </div>
          ) : null}

          {/* Prototype control so the failure state can be reviewed */}
          {method !== "cash" && method !== "room" ? (
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
              <input
                type="checkbox"
                checked={forceDecline}
                onChange={(e) => setForceDecline(e.target.checked)}
                className="size-4 accent-[var(--danger)]"
              />
              Simulate the provider declining (prototype control)
            </label>
          ) : null}
        </div>

        <SheetFooter className="flex-col gap-2 border-t border-border px-4 py-3">
          {disabledReason ? (
            <p className="w-full text-center text-[12px] text-muted-foreground">
              {disabledReason}
            </p>
          ) : null}
          <ActionButton
            onClick={handleCharge}
            disabled={!canCharge}
            className="h-12 w-full text-[15px]"
          >
            {status === "processing" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Processing…
              </>
            ) : status === "failed" ? (
              `Retry · ${formatKES(tenderAmount)}`
            ) : (
              `Charge ${formatKES(tenderAmount)}`
            )}
          </ActionButton>
          <p className="w-full text-center text-[11px] text-muted-foreground">
            Split freely: charge part as cash, the rest to M-Pesa — each tender
            reduces the balance due.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
