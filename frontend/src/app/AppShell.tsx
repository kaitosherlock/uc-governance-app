/**
 * AppShell.tsx — Application layout shell.
 *
 * Structure:
 *  1. Skip-to-content link (first focusable element)
 *  2. ContextBar (header, role="banner")
 *  3. Left rail nav with product name, collapses to icons < 1024px
 *  4. Main content region (<main id="main">)
 *
 * The nav uses a real <nav> with a list; the current route is marked with
 * aria-current="page" (set automatically by NavLink). No horizontal overflow
 * at 375px.
 */
import { Outlet, NavLink } from "react-router";
import {
  Database,
  Shield,
  SlidersHorizontal,
  Activity,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { strings } from "@/lib/strings";
import { ContextBar } from "./ContextBar";

/* ---- Navigation items ---- */

interface NavItem {
  to: string;
  label: string;
  Icon: typeof Database;
  group: "main" | "platform";
}

const navItems: NavItem[] = [
  { to: "/assets", label: strings.nav.dataAssets, Icon: Database, group: "main" },
  { to: "/access", label: strings.nav.accessManagement, Icon: Shield, group: "main" },
  { to: "/policies", label: strings.nav.policies, Icon: SlidersHorizontal, group: "main" },
  { to: "/activity", label: strings.nav.activity, Icon: Activity, group: "main" },
  { to: "/platform", label: strings.nav.platform, Icon: Settings, group: "platform" },
];

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/assets"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-control)] text-[var(--text-sm)] font-[var(--weight-medium)] transition-colors",
          "duration-[var(--duration-fast)]",
          "hover:bg-[var(--color-neutral-2)] hover:text-[var(--color-text-primary)]",
          isActive
            ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
            : "text-[var(--color-text-muted)]",
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.Icon
            size={18}
            aria-hidden="true"
            className={cn(
              "shrink-0",
              isActive ? "text-[var(--color-accent)]" : "text-[var(--color-icon-muted)]",
            )}
          />
          {/* Label text visible on desktop, hidden but accessible on mobile via icon */}
          <span className="truncate lg:inline hidden">{item.label}</span>
          {/* Accessible label for icon-only mode on narrow viewports */}
          <span className="sr-only lg:hidden">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const mainItems = navItems.filter((i) => i.group === "main");
  const platformItems = navItems.filter((i) => i.group === "platform");

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Skip to content — first focusable element */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-[var(--space-2)] focus:left-[var(--space-2)] focus:px-[var(--space-4)] focus:py-[var(--space-2)] focus:bg-[var(--color-accent)] focus:text-white focus:rounded-[var(--radius-control)] focus:text-[var(--text-sm)] focus:font-[var(--weight-medium)]"
      >
        {strings.app.skipToContent}
      </a>

      {/* Context bar — no data in this task, shows "not connected" */}
      <ContextBar context={null} identity={null} loading={false} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left rail navigation */}
        <nav
          aria-label={strings.nav.primaryNavLabel}
          className={cn(
            "flex flex-col shrink-0 border-r border-[var(--color-border-strong)] bg-[var(--color-neutral-0)]",
            "w-12 lg:w-56",
            "py-[var(--space-3)] px-[var(--space-2)] lg:px-[var(--space-3)]",
          )}
        >
          {/* Product name — visible at lg, hidden at icon-only width */}
          <span className="hidden lg:block px-[var(--space-3)] pb-[var(--space-3)] text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--color-text-primary)] truncate">
            {strings.app.title}
          </span>

          {/* Main nav group */}
          <ul className="flex flex-col gap-[var(--space-1)]">
            {mainItems.map((item) => (
              <li key={item.to}>
                <NavItemLink item={item} />
              </li>
            ))}
          </ul>

          {/* Divider — decorative, uses subtle border */}
          <hr className="my-[var(--space-3)] border-[var(--color-border-subtle)]" aria-hidden="true" />

          {/* Platform group (below divider) */}
          <ul className="flex flex-col gap-[var(--space-1)]">
            {platformItems.map((item) => (
              <li key={item.to}>
                <NavItemLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content region */}
        <main
          id="main"
          className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--color-neutral-0)]"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
