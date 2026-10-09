/**
 * POS app shell: Sidebar (240/64), TopBar (56px), PageHeader with the
 * live-sync indicator and primary action, and the ShiftStrip.
 *
 * Layout decisions:
 * - The sidebar is the brand block (charcoal), so the yellow active pill reads
 *   as the single raised element — one glance tells staff where they are.
 * - Sync state sits in the page header top-right (where eyes check for
 *   "is this saved?") and the shift strip sits directly under it, because a
 *   front-desker must see drawer state before touching money.
 * - Only POS is enabled in version 1; the rest of the navigation tree is
 *   visible but disabled so the information architecture is legible from day
 *   one without shipping dead screens.
 */
import {
  Activity,
  BadgeCheck,
  Banknote,
  BedDouble,
  Bell,
  Boxes,
  CalendarCheck,
  CalendarRange,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Moon,
  MoonStar,
  NotebookTabs,
  Package,
  PanelLeft,
  Printer,
  ReceiptText,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Timer,
  TrendingUp,
  UserCog,
  Users,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
import { PROPERTY, SHIFT } from "./data";
import { formatClock } from "./lib";
import { ActionButton, Kbd, Money } from "./primitives";
import { usePos } from "./store";

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* ------------------------------------------------------------ nav tree */

interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard },
      { label: "Live monitor", icon: Activity },
      { label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "Front office",
    items: [
      { label: "Room planner", icon: CalendarRange },
      { label: "Reservations", icon: CalendarCheck },
      { label: "Guests", icon: Users },
      { label: "Folios", icon: NotebookTabs },
      { label: "Housekeeping", icon: BedDouble },
      { label: "Night audit", icon: MoonStar },
    ],
  },
  {
    label: "Restaurant & bar",
    items: [
      { label: "POS", icon: UtensilsCrossed, href: "/pos" },
      { label: "Floor plan", icon: LayoutGrid },
      { label: "Kitchen display", icon: ChefHat },
      { label: "Orders", icon: ClipboardList },
      { label: "Shifts", icon: Timer },
    ],
  },
  {
    label: "Stores",
    items: [
      { label: "Items", icon: Package },
      { label: "Recipes", icon: ScrollText },
      { label: "Stock", icon: Boxes },
      { label: "Purchasing", icon: ShoppingCart },
      { label: "Counts", icon: ListChecks },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Receipts", icon: ReceiptText },
      { label: "Payments", icon: CreditCard },
      { label: "Cash book", icon: Banknote },
      { label: "Reports", icon: TrendingUp },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Staff and roles", icon: UserCog },
      { label: "Printers", icon: Printer },
      { label: "Settings", icon: Settings },
      { label: "Subscription", icon: BadgeCheck },
    ],
  },
];

const VERSION_ONE_HREF = "/pos";

/* -------------------------------------------------------------- sidebar */

export function PosSidebar({
  collapsed,
  onToggleCollapse = () => {},
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  /** Called after a navigation — used by the phone sheet to close itself. */
  onNavigate?: () => void;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const displayName = user?.name || SHIFT.operator;
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-full w-full flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      {/* Brand block */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-[var(--sidebar-border)]",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <span className="font-display grid size-8 shrink-0 place-items-center rounded-md bg-[var(--action)] text-[15px] font-semibold text-[var(--action-foreground)]">
          O
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-tight">
              OliTechs
            </p>
            <p className="text-[11px] leading-tight text-[var(--sidebar-muted)]">
              PMS + POS
            </p>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="grid size-8 place-items-center rounded-md text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Global search with shortcut hint */}
      {collapsed ? (
        <div className="flex justify-center px-2 py-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar and focus search"
            title="Search (Ctrl K)"
            className="grid size-10 place-items-center rounded-md text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="px-3 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--sidebar-muted)]"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search navigation"
              aria-label="Search navigation"
              className="h-10 w-full rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-accent)] pl-9 pr-12 text-[13px] text-[var(--sidebar-foreground)] placeholder:text-[var(--sidebar-muted)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <Kbd>⌘K</Kbd>
            </span>
          </div>
        </div>
      )}

      {/* Grouped navigation */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.length === 0 && !collapsed && (
          <p className="px-1 py-6 text-center text-[13px] text-[var(--sidebar-muted)]">
            No navigation matches “{query}”.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sidebar-muted)]">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const enabled = item.href === VERSION_ONE_HREF;
                const Icon = item.icon;
                if (enabled) {
                  return (
                    <li key={item.label}>
                      <NavLinkItem
                        href={item.href!}
                        collapsed={collapsed}
                        onClick={onNavigate}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLinkItem>
                    </li>
                  );
                }
                return (
                  <li key={item.label}>
                    <span
                      aria-disabled="true"
                      title="Arrives after version 1 — the POS order screen ships first"
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-md px-3 text-[14px] text-[var(--sidebar-muted)] opacity-70",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Signed-in user */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 border-t border-[var(--sidebar-border)] p-3",
          collapsed && "justify-center px-2",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--sidebar-accent)] text-[13px] font-semibold text-[var(--sidebar-foreground)]">
          {initials}
        </span>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight">
                {displayName}
              </p>
              <p className="truncate text-[11px] leading-tight text-[var(--sidebar-muted)]">
                {SHIFT.operatorRole}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 place-items-center rounded-md text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NavLinkItem({
  href,
  collapsed,
  onClick,
  children,
}: {
  href: string;
  collapsed: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        navigate(href);
        onClick?.();
      }}
      aria-current="page"
      title={collapsed ? "POS — order entry" : undefined}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors",
        "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] shadow-shallow",
        collapsed && "justify-center px-0",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- top bar */

export function PosTopBar({ onOpenNav }: { onOpenNav?: () => void }) {
  const { theme, toggle } = useTheme();
  const now = useNow(15_000);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:px-4">
      {onOpenNav ? (
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="grid size-10 place-items-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      ) : null}

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-display grid size-7 shrink-0 place-items-center rounded-md bg-[var(--action)] text-[13px] font-semibold text-[var(--action-foreground)]">
          O
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-semibold">{PROPERTY.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {PROPERTY.city} · Africa/Nairobi (EAT)
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="tnum hidden rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[13px] font-medium sm:inline-flex">
          {formatClock(now)}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          className="grid size-10 place-items-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary"
        >
          {theme === "dark" ? (
            <Sun className="size-4" aria-hidden="true" />
          ) : (
            <Moon className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------- sync indicator */

export function SyncIndicator() {
  const { state, toggleOnline } = usePos();
  const { sync } = state;
  const queued = sync.queued.length;

  let icon: LucideIcon = Wifi;
  let tone = "var(--success-text)";
  let text = "Live";

  if (sync.status === "offline") {
    icon = WifiOff;
    tone = "var(--warning-text)";
    text = `Offline, ${queued} change${queued === 1 ? "" : "s"} queued`;
  } else if (sync.status === "syncing") {
    icon = Loader2;
    tone = "var(--info)";
    text = `Syncing ${queued} change${queued === 1 ? "" : "s"}…`;
  }

  const Icon = icon;
  return (
    <button
      type="button"
      onClick={toggleOnline}
      aria-label={`Sync status: ${text}. Activate to simulate ${
        sync.online ? "going offline" : "reconnecting"
      }.`}
      title="Demo control: simulate losing/regaining the connection"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-secondary"
      style={{ color: tone }}
    >
      <Icon
        className={cn(
          "size-4",
          sync.status === "syncing" && "animate-spin",
          sync.status === "live" && "animate-pulse",
        )}
        aria-hidden="true"
      />
      <span>{text}</span>
      {sync.status === "live" && (
        <span className="tnum hidden font-normal text-muted-foreground sm:inline">
          · last synced {formatClock(sync.lastSyncedAt)}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------- page header */

export function PosPageHeader({
  primaryLabel,
  onPrimary,
  primaryDisabled,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-4 md:px-6">
      <div>
        <nav
          aria-label="Breadcrumb"
          className="mb-1 flex items-center gap-1 text-[12px] text-muted-foreground"
        >
          <span>Restaurant &amp; bar</span>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span>POS</span>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span className="text-foreground">Order entry</span>
        </nav>
        <h1 className="font-display text-[24px] font-semibold leading-tight">
          Order entry
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <SyncIndicator />
        <ActionButton
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="h-9 px-4 text-[13px]"
        >
          {primaryLabel}
        </ActionButton>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- shift strip */

export function ShiftStrip({ onOpenShift }: { onOpenShift: () => void }) {
  const { state, cashDrawer } = usePos();
  const shift = state.shift;

  return (
    <div className="mx-4 mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] md:mx-6">
      <button
        type="button"
        onClick={onOpenShift}
        title="Open or close the shift"
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 font-medium text-foreground transition-colors hover:bg-accent"
      >
        {shift.open ? (
          <>
            <span
              className="size-2 animate-pulse rounded-full"
              style={{ background: "var(--success)" }}
              aria-hidden="true"
            />
            Shift open
          </>
        ) : (
          <>
            <span
              className="size-2 rounded-full"
              style={{ background: "var(--muted-foreground)" }}
              aria-hidden="true"
            />
            Shift closed
          </>
        )}
      </button>

      <span className="text-muted-foreground">
        Shift <span className="tnum text-foreground">{shift.id}</span>
      </span>
      <span className="text-muted-foreground">
        Opened{" "}
        <span className="tnum text-foreground">{SHIFT.openedAtLabel}</span>
      </span>
      <span className="hidden text-muted-foreground sm:inline">
        Operator <span className="text-foreground">{SHIFT.operator}</span>
      </span>
      <span className="hidden text-muted-foreground md:inline">
        Cashier <span className="text-foreground">{SHIFT.cashier}</span>
      </span>

      <span className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground">Cash drawer</span>
        <Money
          value={cashDrawer}
          className="text-[14px] font-semibold text-foreground"
        />
      </span>
    </div>
  );
}

/* Small helper used by dialogs to cancel out of a sticky footer */
export function CancelButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="outline" className="h-10" {...props} />;
}
