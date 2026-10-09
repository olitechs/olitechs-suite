/**
 * POS state: one open ticket per table, the shift, and the sync queue.
 *
 * Offline-first behaviour: every mutation is applied locally and, while the
 * connection is down, is appended to a queue ("Offline, N changes queued").
 * Reconnecting flushes the queue through a single sync pass — no polling —
 * and a price that changed on the server while we were down is surfaced as an
 * explicit conflict instead of silently rewriting money.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  MODIFIER_GROUPS,
  PENDING_PRICE_UPDATE,
  PRODUCTS,
  SHIFT,
  TABLES,
  type OrderType,
  type TableRecord,
} from "./data";
import {
  computeTotals,
  lineGross,
  nextId,
  round2,
  type Discount,
  type OrderLine,
  type Tender,
} from "./lib";

export type TicketStatus = "open" | "held" | "bill-printed" | "settled";

export interface Ticket {
  id: string;
  orderType: OrderType;
  tableId: string | null;
  covers: number;
  waiterId: string;
  openedAt: number;
  lines: OrderLine[];
  discount: Discount | null;
  tenders: Tender[];
  status: TicketStatus;
}

export interface QueuedOp {
  id: string;
  label: string;
  at: number;
}

export interface PriceConflict {
  lineId: string;
  productName: string;
  ticketPrice: number;
  serverPrice: number;
}

export interface ShiftState {
  id: string;
  open: boolean;
  float: number;
  closedAt?: number;
  counted?: number;
  variance?: number;
}

export interface SyncState {
  online: boolean;
  status: "live" | "offline" | "syncing";
  queued: QueuedOp[];
  lastSyncedAt: number;
}

export interface PosState {
  ticket: Ticket;
  shift: ShiftState;
  sync: SyncState;
  conflict: PriceConflict | null;
  /** Line ids whose price conflict the operator already decided. */
  resolvedConflicts: string[];
}

/* ------------------------------------------------------------- seeding */

function product(id: string) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown product ${id}`);
  return p;
}

function seedLine(
  productId: string,
  qty: number,
  status: OrderLine["status"],
  sentAt?: number,
  modifierIds: string[] = [],
): OrderLine {
  const p = product(productId);
  const modifiers = modifierIds.map((mid) => {
    for (const gid of p.modifierGroupIds) {
      const group = MODIFIER_GROUPS.find((g) => g.id === gid);
      const opt = group?.options.find((o) => o.id === mid);
      if (opt) return { id: opt.id, name: opt.name, price: opt.price };
    }
    return { id: mid, name: mid, price: 0 };
  });
  return {
    id: nextId("line"),
    productId: p.id,
    name: p.name,
    variant: p.variant,
    sku: p.sku,
    dept: p.dept,
    qty,
    unitPrice: p.price,
    modifiers,
    course: 1,
    status,
    sentAt,
  };
}

const OPENED_AT = Date.now() - 42 * 60 * 1000;

function initialTicket(): Ticket {
  return {
    id: "A-1042",
    orderType: "dine-in",
    tableId: "T12",
    covers: 4,
    waiterId: "w-amina",
    openedAt: OPENED_AT,
    lines: [
      seedLine("p-chips-masala-large", 1, "sent", OPENED_AT + 6 * 60 * 1000, [
        "hot",
        "extra-masala",
      ]),
      seedLine("p-nyama", 1, "sent", OPENED_AT + 8 * 60 * 1000, ["ugali"]),
      seedLine("p-tusker", 2, "pending"),
      seedLine("p-mango", 1, "pending"),
    ],
    discount: null,
    tenders: [],
    status: "open",
  };
}

function initialState(): PosState {
  return {
    ticket: initialTicket(),
    shift: { id: SHIFT.id, open: true, float: SHIFT.openingFloat },
    sync: {
      online: true,
      status: "live",
      queued: [],
      lastSyncedAt: Date.now(),
    },
    conflict: null,
    resolvedConflicts: [],
  };
}

/* -------------------------------------------------------------- actions */

export type PosAction =
  | { type: "add-line"; line: OrderLine; label: string }
  | { type: "inc-qty"; id: string; delta: number; label: string }
  | {
      type: "update-line";
      id: string;
      patch: Partial<OrderLine>;
      label: string;
    }
  | { type: "remove-line"; id: string; label: string }
  | { type: "reset-ticket"; label: string }
  | { type: "set-order-type"; orderType: OrderType }
  | { type: "set-table"; tableId: string | null; label: string }
  | { type: "set-covers"; covers: number }
  | { type: "set-waiter"; waiterId: string }
  | { type: "set-discount"; discount: Discount | null; label: string }
  | { type: "send-to-kitchen"; label: string }
  | { type: "toggle-hold"; label: string }
  | { type: "pre-bill"; label: string }
  | { type: "add-tender"; tender: Tender; label: string }
  | { type: "undo-tender"; id: string; label: string }
  | { type: "new-order"; label: string }
  | { type: "set-online"; online: boolean }
  | { type: "sync-start" }
  | { type: "sync-done"; at: number; conflict: PriceConflict | null }
  | { type: "resolve-conflict"; resolution: "update" | "keep" }
  | { type: "shift-open"; float: number }
  | { type: "shift-close"; counted: number; expected: number };

function enqueue(sync: SyncState, label: string): SyncState {
  if (sync.online) return sync;
  return {
    ...sync,
    queued: [...sync.queued, { id: nextId("op"), label, at: Date.now() }],
  };
}

function ticketReducer(ticket: Ticket, action: PosAction): Ticket {
  switch (action.type) {
    case "add-line": {
      const incoming = action.line;
      const mergeTarget = ticket.lines.find(
        (l) =>
          l.status === "pending" &&
          l.productId === incoming.productId &&
          l.note === incoming.note &&
          JSON.stringify(l.modifiers) === JSON.stringify(incoming.modifiers),
      );
      if (mergeTarget) {
        return {
          ...ticket,
          lines: ticket.lines.map((l) =>
            l.id === mergeTarget.id ? { ...l, qty: l.qty + incoming.qty } : l,
          ),
        };
      }
      return { ...ticket, lines: [...ticket.lines, incoming] };
    }
    case "inc-qty": {
      return {
        ...ticket,
        lines: ticket.lines.flatMap((l) => {
          if (l.id !== action.id) return [l];
          const qty = l.qty + action.delta;
          return qty <= 0 ? [] : [{ ...l, qty }];
        }),
      };
    }
    case "update-line":
      return {
        ...ticket,
        lines: ticket.lines.map((l) =>
          l.id === action.id ? { ...l, ...action.patch } : l,
        ),
      };
    case "remove-line":
      return {
        ...ticket,
        lines: ticket.lines.filter((l) => l.id !== action.id),
      };
    case "reset-ticket":
      return {
        ...ticket,
        lines: [],
        discount: null,
        tenders: [],
        status: "open",
      };
    case "set-order-type":
      return {
        ...ticket,
        orderType: action.orderType,
        tableId: action.orderType === "dine-in" ? ticket.tableId : null,
      };
    case "set-table":
      return { ...ticket, tableId: action.tableId };
    case "set-covers":
      return { ...ticket, covers: Math.min(Math.max(action.covers, 1), 20) };
    case "set-waiter":
      return { ...ticket, waiterId: action.waiterId };
    case "set-discount":
      return { ...ticket, discount: action.discount };
    case "send-to-kitchen":
      return {
        ...ticket,
        status: ticket.status === "held" ? "open" : ticket.status,
        lines: ticket.lines.map((l) =>
          l.status === "pending" || l.status === "held"
            ? { ...l, status: "sent", sentAt: Date.now() }
            : l,
        ),
      };
    case "toggle-hold":
      return {
        ...ticket,
        status: ticket.status === "held" ? "open" : "held",
      };
    case "pre-bill":
      return ticket.status === "settled"
        ? ticket
        : { ...ticket, status: "bill-printed" };
    case "add-tender": {
      const tenders = [...ticket.tenders, action.tender];
      const paid = round2(tenders.reduce((s, t) => s + t.amount, 0));
      const totals = computeTotals({
        lines: ticket.lines,
        discount: ticket.discount,
        paid,
      });
      return {
        ...ticket,
        tenders,
        status: totals.balance <= 0 ? "settled" : ticket.status,
      };
    }
    case "undo-tender":
      return {
        ...ticket,
        tenders: ticket.tenders.filter((t) => t.id !== action.id),
        status: ticket.status === "settled" ? "open" : ticket.status,
      };
    case "new-order": {
      const n = parseInt(ticket.id.split("-")[1] ?? "1042", 10);
      return {
        ...ticket,
        id: `A-${n + 1}`,
        lines: [],
        discount: null,
        tenders: [],
        status: "open",
        openedAt: Date.now(),
      };
    }
    default:
      return ticket;
  }
}

export function posReducer(state: PosState, action: PosAction): PosState {
  switch (action.type) {
    case "set-online": {
      if (action.online === state.sync.online) return state;
      const status = !action.online
        ? "offline"
        : state.sync.queued.length > 0
          ? "syncing"
          : "live";
      return {
        ...state,
        sync: { ...state.sync, online: action.online, status },
      };
    }
    case "sync-start":
      return {
        ...state,
        sync: { ...state.sync, status: "syncing" },
      };
    case "sync-done":
      return {
        ...state,
        sync: {
          ...state.sync,
          status: "live",
          queued: [],
          lastSyncedAt: action.at,
        },
        conflict: action.conflict,
      };
    case "resolve-conflict": {
      const conflict = state.conflict;
      if (!conflict) return state;
      const lines = state.ticket.lines.map((l) => {
        if (l.id !== conflict.lineId) return l;
        if (action.resolution === "update") {
          return { ...l, unitPrice: conflict.serverPrice };
        }
        return {
          ...l,
          note: `${l.note ? `${l.note} · ` : ""}price held at KES ${conflict.ticketPrice.toFixed(2)} — manager approval`,
        };
      });
      return {
        ...state,
        conflict: null,
        resolvedConflicts: [...state.resolvedConflicts, conflict.lineId],
        ticket: { ...state.ticket, lines },
      };
    }
    case "shift-open":
      return {
        ...state,
        shift: {
          ...state.shift,
          open: true,
          float: action.float,
          closedAt: undefined,
          counted: undefined,
          variance: undefined,
        },
      };
    case "shift-close": {
      const variance = round2(action.counted - action.expected);
      return {
        ...state,
        shift: {
          ...state.shift,
          open: false,
          closedAt: Date.now(),
          counted: action.counted,
          variance,
        },
      };
    }
    default: {
      const ticket = ticketReducer(state.ticket, action);
      if (ticket === state.ticket) return state;
      const sync = enqueue(state.sync, "label" in action ? action.label : "");
      return { ...state, ticket, sync };
    }
  }
}

/* ------------------------------------------------------------- context */

interface PosContextValue {
  state: PosState;
  dispatch: React.Dispatch<PosAction>;
  totals: ReturnType<typeof computeTotals>;
  cashDrawer: number;
  pendingCount: number;
  table: TableRecord | undefined;
  addToOrder: (
    productId: string,
    modifiers: {
      id: string;
      name: string;
      price: number;
      prep?: "less" | "normal" | "more";
    }[],
    note?: string,
  ) => void;
  toggleOnline: () => void;
}

const PosContext = createContext<PosContextValue | null>(null);

export function PosProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(posReducer, undefined, initialState);

  const totals = useMemo(
    () =>
      computeTotals({
        lines: state.ticket.lines,
        discount: state.ticket.discount,
        paid: state.ticket.tenders.reduce((s, t) => s + t.amount, 0),
      }),
    [state.ticket],
  );

  const cashDrawer = useMemo(
    () =>
      round2(
        state.shift.float +
          state.ticket.tenders
            .filter((t) => t.method === "cash")
            .reduce((s, t) => s + t.amount, 0),
      ),
    [state.shift.float, state.ticket.tenders],
  );

  /* Live snapshots for the sync pass without re-arming its timer. */
  const ticketRef = useRef(state.ticket);
  const resolvedRef = useRef(state.resolvedConflicts);
  useEffect(() => {
    ticketRef.current = state.ticket;
    resolvedRef.current = state.resolvedConflicts;
  });

  /* One sync pass on reconnect. No polling, no "refresh every 2s": the queue
     is flushed exactly once when the connection returns. */
  useEffect(() => {
    if (!state.sync.online || state.sync.status !== "syncing") return;
    const queued = state.sync.queued;
    if (queued.length === 0) return;

    const timer = setTimeout(() => {
      const update = PENDING_PRICE_UPDATE;
      const conflictLine = ticketRef.current.lines.find(
        (l) =>
          l.productId === update.productId &&
          l.unitPrice === update.from &&
          !resolvedRef.current.includes(l.id),
      );
      dispatch({
        type: "sync-done",
        at: Date.now(),
        conflict: conflictLine
          ? {
              lineId: conflictLine.id,
              productName: `${conflictLine.name}${conflictLine.variant ? ` · ${conflictLine.variant}` : ""}`,
              ticketPrice: update.from,
              serverPrice: update.to,
            }
          : null,
      });
      if (conflictLine) {
        toast.warning("Sync paused — 1 price conflict needs a decision", {
          description: "Resolve it in the conflict card above the ticket.",
        });
      } else {
        toast.success(
          `${queued.length} change${queued.length > 1 ? "s" : ""} synced`,
          {
            description: "Back online — queue flushed.",
          },
        );
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [state.sync.online, state.sync.status, state.sync.queued]);

  const addToOrder = useCallback<PosContextValue["addToOrder"]>(
    (productId, modifiers, note) => {
      const p = PRODUCTS.find((x) => x.id === productId);
      if (!p) return;
      const line: OrderLine = {
        id: nextId("line"),
        productId: p.id,
        name: p.name,
        variant: p.variant,
        sku: p.sku,
        dept: p.dept,
        qty: 1,
        unitPrice: p.price,
        modifiers,
        note: note?.trim() ? note.trim() : undefined,
        course: 1,
        status: "pending",
      };
      dispatch({
        type: "add-line",
        line,
        label: `Add ${p.name}${p.variant ? ` ${p.variant}` : ""}`,
      });
    },
    [],
  );

  const toggleOnline = useCallback(() => {
    dispatch({ type: "set-online", online: !state.sync.online });
  }, [state.sync.online]);

  const table = useMemo<TableRecord | undefined>(
    () => TABLES.find((t) => t.id === state.ticket.tableId),
    [state.ticket.tableId],
  );

  const value: PosContextValue = {
    state,
    dispatch,
    totals,
    cashDrawer,
    pendingCount: state.ticket.lines.filter((l) => l.status === "pending")
      .length,
    table,
    addToOrder,
    toggleOnline,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used inside <PosProvider>");
  return ctx;
}

/** Exported for tests/tools: the sum of sent line gross, KES. */
export function sentGross(lines: OrderLine[]): number {
  return round2(
    lines
      .filter((l) => l.status === "sent")
      .reduce((s, l) => s + lineGross(l), 0),
  );
}
