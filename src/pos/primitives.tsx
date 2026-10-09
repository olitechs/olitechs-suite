/**
 * Shared POS primitives.
 *
 * Every status renders colour + icon + text label (never colour alone).
 * Touch contexts use 48px targets; money is tabular, right-aligned, KES.
 */
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Bookmark,
  CircleCheck,
  Clock,
  Delete,
  Flame,
  Lock,
  LockOpen,
  Minus,
  Pause,
  Plus,
  ReceiptText,
  WifiOff,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatKES } from "./lib";

/* ------------------------------------------------------------ statuses */

export type StatusKey =
  | "free"
  | "occupied"
  | "reserved"
  | "bill-printed"
  | "paid"
  | "pending"
  | "sent"
  | "held"
  | "voided"
  | "cancelled"
  | "settled"
  | "open"
  | "closed"
  | "offline";

const STATUS: Record<
  StatusKey,
  { label: string; icon: LucideIcon; fg: string }
> = {
  free: { label: "Free", icon: CircleCheck, fg: "var(--success-text)" },
  occupied: { label: "Occupied", icon: Clock, fg: "var(--warning-text)" },
  reserved: {
    label: "Reserved",
    icon: Bookmark,
    fg: "var(--muted-foreground)",
  },
  "bill-printed": {
    label: "Bill printed",
    icon: ReceiptText,
    fg: "var(--info)",
  },
  paid: { label: "Paid", icon: CircleCheck, fg: "var(--success-text)" },
  pending: { label: "Not sent", icon: Clock, fg: "var(--muted-foreground)" },
  sent: { label: "Sent", icon: Flame, fg: "var(--info)" },
  held: { label: "Held", icon: Pause, fg: "var(--warning-text)" },
  voided: { label: "Voided", icon: Ban, fg: "var(--danger)" },
  cancelled: { label: "Cancelled", icon: Ban, fg: "var(--danger)" },
  settled: { label: "Settled", icon: CircleCheck, fg: "var(--success-text)" },
  open: { label: "Shift open", icon: LockOpen, fg: "var(--success-text)" },
  closed: { label: "Shift closed", icon: Lock, fg: "var(--muted-foreground)" },
  offline: { label: "Offline", icon: WifiOff, fg: "var(--warning-text)" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusKey;
  /** Overrides the default label, e.g. "Sent 14:22". */
  label?: string;
  className?: string;
}) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[12px] font-medium",
        className,
      )}
      style={{ color: s.fg }}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}

export function statusLabel(status: StatusKey): string {
  return STATUS[status].label;
}

/* --------------------------------------------------------------- money */

export function Money({
  value,
  className,
  prefix = true,
}: {
  value: number;
  className?: string;
  prefix?: boolean;
}) {
  return (
    <span className={cn("money tnum", className)}>
      {prefix ? formatKES(value) : formatKES(value).replace("KES ", "")}
    </span>
  );
}

/* ------------------------------------------------------------- buttons */

/** Primary yellow CTA. Ink text on yellow — never white. */
export function ActionButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className={cn("btn-action rounded-md font-semibold", className)}
      {...props}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border border-border bg-secondary px-1.5 font-sans text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------- segmented control */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  hint?: string;
}

/**
 * Radio-group style switch. `touch` size keeps 48px targets for POS and
 * kitchen screens; `sm` is for compact dialogs.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "touch",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  size?: "touch" | "sm";
  className?: string;
}) {
  const h = size === "touch" ? "h-12" : "h-9";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-stretch gap-1 rounded-lg border border-border bg-secondary p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors",
              h,
              active
                ? "border border-border bg-card text-foreground shadow-shallow"
                : "border border-transparent text-muted-foreground hover:text-foreground",
              opt.disabled &&
                "cursor-not-allowed opacity-50 hover:text-muted-foreground",
            )}
          >
            {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------- quantity stepper */

/** 48px touch targets: add/remove one unit per tap. */
export function QuantityStepper({
  value,
  onStep,
  disabled,
  ariaLabel,
  min = 1,
}: {
  value: number;
  onStep: (delta: number) => void;
  disabled?: boolean;
  ariaLabel: string;
  min?: number;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-12 items-center overflow-hidden rounded-md border border-border bg-card",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={`Decrease quantity of ${ariaLabel}`}
        disabled={disabled || value <= min}
        onClick={() => onStep(-1)}
        className="grid size-12 place-items-center text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span
        className="tnum w-10 text-center text-[16px] font-semibold"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase quantity of ${ariaLabel}`}
        disabled={disabled}
        onClick={() => onStep(1)}
        className="grid size-12 place-items-center text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------- numeric pad */

/** Keypad for cash counts and tendered amounts (touch: 48px keys). */
export function NumericKeypad({
  onKey,
  allowDecimal = true,
  className,
}: {
  onKey: (key: string) => void;
  allowDecimal?: boolean;
  className?: string;
}) {
  const keys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    allowDecimal ? "." : "",
    "0",
    "<",
  ];
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {keys.map((k, i) =>
        k === "" ? (
          <span key={`spacer-${i}`} aria-hidden="true" />
        ) : (
          <button
            key={k}
            type="button"
            aria-label={k === "<" ? "Delete last digit" : k}
            onClick={() => onKey(k)}
            className="tnum grid h-12 place-items-center rounded-md border border-border bg-card text-[16px] font-medium text-foreground transition-colors hover:bg-secondary active:bg-accent"
          >
            {k === "<" ? <Delete className="size-5" aria-hidden="true" /> : k}
          </button>
        ),
      )}
    </div>
  );
}

/** Append a keypress to a numeric string ("12", "12.5", "" → "12.5"). */
export function applyKey(current: string, key: string): string {
  if (key === "<") return current.slice(0, -1);
  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (current === "0") return key;
  if (current.includes(".") && current.split(".")[1]?.length >= 2)
    return current;
  return current + key;
}
