/**
 * POS order entry — the version 1 screen, first shown to front desk staff.
 *
 * Grid (≥1280): sidebar 240 · work zone (context bar, search, chips, product
 * grid) · ticket 400. At 1024 the sidebar collapses to 64 and the ticket
 * narrows to 340. Under 768 the ticket becomes a full-screen overlay behind a
 * sticky summary bar, because a phone has no room for a permanent column.
 */
import { TriangleAlert, WifiOff } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { PRODUCTS, type Product } from "@/pos/data";
import type { OrderLine } from "@/pos/lib";
import { formatKES } from "@/pos/lib";
import {
  DiscountDialog,
  ModifierSheet,
  OrderContextBar,
  ProductZone,
  TablePickerDialog,
  TicketPanel,
  VoidDialog,
} from "@/pos/order";
import { ActionButton, Money } from "@/pos/primitives";
import { PaymentSheet } from "@/pos/payment";
import { PosPageHeader, PosSidebar, PosTopBar, ShiftStrip } from "@/pos/shell";
import { EndShiftDialog, OpenShiftDialog } from "@/pos/shift";
import { PosProvider, usePos } from "@/pos/store";

export default function Pos() {
  return (
    <PosProvider>
      <PosScreen />
    </PosProvider>
  );
}

function PosScreen() {
  const { state, dispatch, totals, table, pendingCount, addToOrder } = usePos();
  const isPhone = useIsMobile();
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1280,
  );
  const [navOpen, setNavOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [endShiftOpen, setEndShiftOpen] = useState(false);
  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [voidLine, setVoidLine] = useState<OrderLine | null>(null);
  const [modifierTarget, setModifierTarget] = useState<{
    product: Product;
    line?: OrderLine | null;
  } | null>(null);

  const ticket = state.ticket;
  const lineCount = ticket.lines.length;

  const handleAdd = (product: Product) => {
    if (product.modifierGroupIds.length > 0) {
      setModifierTarget({ product });
    } else {
      addToOrder(product.id, []);
    }
  };

  const handleEditLine = (line: OrderLine) => {
    const product = PRODUCTS.find((p) => p.id === line.productId);
    if (product) setModifierTarget({ product, line });
  };

  const focusBarcode = () => barcodeRef.current?.focus();
  const openOrCloseShift = () =>
    state.shift.open ? setEndShiftOpen(true) : setOpenShiftOpen(true);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Sidebar — 240 expanded / 64 collapsed / sheet on phones */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border md:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <PosSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>

      {isPhone ? (
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent
            side="left"
            className="w-[264px] gap-0 border-r border-border p-0 sm:max-w-[264px]"
          >
            <PosSidebar
              collapsed={false}
              onNavigate={() => setNavOpen(false)}
            />
          </SheetContent>
        </Sheet>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <PosTopBar onOpenNav={isPhone ? () => setNavOpen(true) : undefined} />

        <PosPageHeader
          primaryLabel={state.shift.open ? "End shift" : "Open shift"}
          onPrimary={openOrCloseShift}
        />

        <ShiftStrip onOpenShift={openOrCloseShift} />

        {/* Offline state — sales keep working, queue is visible */}
        {!state.sync.online ? (
          <div
            role="status"
            className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-[13px] leading-5 text-[var(--warning-text)] md:mx-6"
          >
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Offline</strong> — sales are
              saved on this device ({state.sync.queued.length} change
              {state.sync.queued.length === 1 ? "" : "s"} queued). M-Pesa, card
              and bank tenders pause; cash and room charge keep working.
            </span>
          </div>
        ) : null}

        {/* Sync conflict — resolved before the queue is trusted again */}
        {state.conflict ? (
          <div
            role="alertdialog"
            aria-label="Sync conflict"
            className="mx-4 mb-2 rounded-lg border-2 border-[var(--action)] bg-[var(--action-soft)] px-4 py-3 text-foreground dark:bg-secondary md:mx-6"
          >
            <div className="flex flex-wrap items-start gap-3">
              <TriangleAlert
                className="mt-0.5 size-5 shrink-0 text-[var(--warning-text)]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  Price changed while you were offline
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                  {state.conflict.productName} · this ticket holds{" "}
                  <span className="tnum font-medium text-foreground">
                    {formatKES(state.conflict.ticketPrice)}
                  </span>
                  , the server price is{" "}
                  <span className="tnum font-medium text-foreground">
                    {formatKES(state.conflict.serverPrice)}
                  </span>{" "}
                  (effective 14:00). Pick one — nothing is overwritten silently.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-10 bg-card"
                  onClick={() => resolveConflict("keep")}
                >
                  Keep {formatKES(state.conflict.ticketPrice)} (approved)
                </Button>
                <ActionButton
                  className="h-10"
                  onClick={() => resolveConflict("update")}
                >
                  Use {formatKES(state.conflict.serverPrice)}
                </ActionButton>
              </div>
            </div>
          </div>
        ) : null}

        <OrderContextBar onPickTable={() => setTableOpen(true)} />

        {/* Work zone */}
        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <ProductZone onAddRequested={handleAdd} barcodeRef={barcodeRef} />
          </section>

          {!isPhone ? (
            <aside className="hidden w-[330px] shrink-0 flex-col overflow-hidden border-l border-border md:flex lg:w-[350px] xl:w-[380px] 2xl:w-[400px]">
              <TicketPanel
                onOpenPayment={() => setPaymentOpen(true)}
                onOpenDiscount={() => setDiscountOpen(true)}
                onVoidLine={setVoidLine}
                onEditLine={handleEditLine}
                onFocusBarcode={focusBarcode}
              />
            </aside>
          ) : null}
        </div>

        {/* Phone: sticky summary + full-screen ticket */}
        {isPhone ? (
          <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-muted-foreground">
                {lineCount} item{lineCount === 1 ? "" : "s"}
                {pendingCount > 0 ? ` · ${pendingCount} not sent` : ""} ·{" "}
                {table?.name ?? "No table"}
              </p>
              <Money
                value={totals.total}
                className="text-[17px] font-semibold"
              />
            </div>
            <Button
              variant="outline"
              className="h-12 px-4"
              onClick={() => setTicketOpen(true)}
            >
              Ticket
            </Button>
            <ActionButton
              className="h-12 px-5"
              disabled={lineCount === 0}
              onClick={() => setPaymentOpen(true)}
            >
              Pay
            </ActionButton>
          </div>
        ) : null}

        {isPhone && ticketOpen ? (
          <div className="fixed inset-0 z-40 flex flex-col bg-background">
            <TicketPanel
              onClose={() => setTicketOpen(false)}
              onOpenPayment={() => {
                setTicketOpen(false);
                setPaymentOpen(true);
              }}
              onOpenDiscount={() => setDiscountOpen(true)}
              onVoidLine={setVoidLine}
              onEditLine={handleEditLine}
              onFocusBarcode={focusBarcode}
            />
          </div>
        ) : null}
      </div>

      {/* Drawers and dialogs — keyed so every open starts from a clean state */}
      <PaymentSheet
        key={`pay-${paymentOpen}`}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
      />

      <ModifierSheet
        key={`mod-${modifierTarget?.product.id ?? "none"}-${modifierTarget?.line?.id ?? "new"}`}
        product={modifierTarget?.product ?? null}
        existingLine={modifierTarget?.line ?? null}
        open={!!modifierTarget}
        onClose={() => setModifierTarget(null)}
      />

      <DiscountDialog
        key={`disc-${discountOpen}`}
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
      />

      <VoidDialog
        key={`void-${voidLine?.id ?? "none"}`}
        line={voidLine}
        onClose={() => setVoidLine(null)}
      />

      <TablePickerDialog open={tableOpen} onClose={() => setTableOpen(false)} />

      <EndShiftDialog
        open={endShiftOpen}
        onClose={() => setEndShiftOpen(false)}
      />
      <OpenShiftDialog
        open={openShiftOpen}
        onClose={() => setOpenShiftOpen(false)}
      />
    </div>
  );

  function resolveConflict(resolution: "update" | "keep") {
    dispatch({ type: "resolve-conflict", resolution });
    dispatch({ type: "sync-start" });
    dispatch({ type: "sync-done", at: Date.now(), conflict: null });
  }
}
