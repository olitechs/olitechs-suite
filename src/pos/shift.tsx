/**
 * Shift dialogs: open with an opening float, close with a counted drawer.
 * Variance = counted − expected, both derived — never typed in.
 */
import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { SHIFT } from "./data";
import { formatKES, round2 } from "./lib";
import { ActionButton, Money, NumericKeypad, applyKey } from "./primitives";
import { usePos } from "./store";

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <Money
        value={value}
        className={cn(
          "font-medium",
          tone === "success" && "text-[var(--success-text)]",
          tone === "warning" && "text-[var(--warning-text)]",
          tone === "muted" && "text-muted-foreground",
        )}
      />
    </div>
  );
}

export function EndShiftDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, dispatch, cashDrawer } = usePos();
  const [countedStr, setCountedStr] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const counted = round2(parseFloat(countedStr) || 0);
  const variance = round2(counted - cashDrawer);
  const balanced = countedStr !== "" && variance === 0;
  const needsReason = countedStr !== "" && variance !== 0;

  const collections = state.ticket.tenders.reduce(
    (acc, t) => {
      acc[t.method] = round2((acc[t.method] ?? 0) + t.amount);
      return acc;
    },
    {} as Record<string, number>,
  );

  const close = () => {
    if (countedStr === "") {
      setError("Count the drawer before closing — enter 0 for an empty till.");
      return;
    }
    if (needsReason && reason.trim().length < 3) {
      setError("Explain the variance — it is written into the shift report.");
      return;
    }
    dispatch({ type: "shift-close", counted, expected: cashDrawer });
    toast.success(
      variance === 0
        ? "Shift closed · drawer balanced"
        : `Shift closed · variance ${variance > 0 ? "+" : ""}${formatKES(variance)}`,
      {
        description: `Counted ${formatKES(cashDrawer)} expected, ${formatKES(counted)} counted.`,
      },
    );
    setCountedStr("");
    setReason("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Close shift {SHIFT.id}
          </DialogTitle>
          <DialogDescription>
            Count the drawer, confirm the variance, then the shift report is
            sealed for the night audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5 rounded-md border border-border bg-secondary p-3">
            <Row label="Opening float" value={state.shift.float} />
            <Row
              label="Cash collected this shift"
              value={collections.cash ?? 0}
            />
            <Row label="Expected in drawer" value={cashDrawer} />
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--strong-border)] pt-1.5 text-[13px]">
              <span className="font-medium">Card · M-Pesa · room charge</span>
              <Money
                value={
                  (collections.mpesa ?? 0) +
                  (collections.card ?? 0) +
                  (collections.bank ?? 0) +
                  (collections.room ?? 0)
                }
                className="font-medium"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="counted" className="text-[13px]">
              Counted cash in drawer
            </Label>
            <Input
              id="counted"
              inputMode="decimal"
              value={countedStr}
              onChange={(e) => setCountedStr(e.target.value)}
              placeholder="0.00"
              className="tnum h-12 text-right text-[18px] font-semibold"
            />
            <NumericKeypad
              onKey={(k) => setCountedStr((c) => applyKey(c, k))}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">Variance</span>
            <span className="flex items-center gap-2">
              {countedStr === "" ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <>
                  <Money
                    value={variance}
                    className={cn(
                      "font-semibold",
                      balanced
                        ? "text-[var(--success-text)]"
                        : "text-[var(--warning-text)]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[12px] font-medium",
                      balanced
                        ? "text-[var(--success-text)]"
                        : "text-[var(--warning-text)]",
                    )}
                  >
                    {balanced ? "Balanced" : variance > 0 ? "Over" : "Short"}
                  </span>
                </>
              )}
            </span>
          </div>

          {needsReason ? (
            <div className="grid gap-1.5">
              <Label htmlFor="variance-reason" className="text-[13px]">
                Variance reason (required)
              </Label>
              <Input
                id="variance-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. float given to waiter"
                className="h-12"
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-[12px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-12" onClick={onClose}>
            Keep shift open
          </Button>
          <ActionButton className="h-12" onClick={close}>
            Close shift
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OpenShiftDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { dispatch } = usePos();
  const [floatStr, setFloatStr] = useState(String(SHIFT.openingFloat));
  const float = round2(parseFloat(floatStr) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            Open shift {SHIFT.id}
          </DialogTitle>
          <DialogDescription>
            Count the opening float before the first sale — it anchors
            tonight&apos;s reconciliation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="float" className="text-[13px]">
            Opening float (KES)
          </Label>
          <Input
            id="float"
            inputMode="decimal"
            value={floatStr}
            onChange={(e) => setFloatStr(e.target.value)}
            className="tnum h-12 text-right text-[18px] font-semibold"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-12" onClick={onClose}>
            Cancel
          </Button>
          <ActionButton
            className="h-12"
            disabled={float <= 0}
            onClick={() => {
              dispatch({ type: "shift-open", float });
              toast.success(`Shift opened with ${formatKES(float)}`, {
                description: `Operator ${SHIFT.operator} · cashier ${SHIFT.cashier}.`,
              });
              onClose();
            }}
          >
            Open shift
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
