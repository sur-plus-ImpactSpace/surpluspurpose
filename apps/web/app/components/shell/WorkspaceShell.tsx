import {
  ArrowLeftRight,
  CalendarDays,
  Download,
  FileText,
  Globe,
  Inbox,
  LayoutGrid,
  PanelsTopLeft,
  Settings,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import type { ReactNode } from "react";
import type { Dictionary, Locale } from "../../lib/i18n";
import type { SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import type { WorkspaceRole } from "../../lib/workspace-data";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { ProfileMenu } from "../ProfileMenu";

/**
 * The app shell: a plain top bar carrying the wordmark, the navigation and the
 * account controls, over the page background.
 *
 * Extracted from the demo so the authenticated workspace (`/`) and the public
 * sandbox (`/demo`) share one chrome. Everything role- or surface-specific is
 * passed in — identity, the topbar's right-hand slot, the sidebar footer — so
 * the shell itself stays a plain server component with no client JS.
 */

export type WorkspaceIdentity = { name: string; tier: string; initials: string };

export type NavItem = {
  href: string;
  labelKey: keyof Dictionary["nav"];
  icon: keyof typeof NAV_ICONS;
  /** Sidebar section this item belongs to (desktop only). Items without a group
   *  render under the default "Navigate" header — e.g. the /demo SECTION_NAV. */
  group?: keyof Dictionary["nav"];
};

/** In-page anchors that map to id-tagged sections inside each role dashboard.
 *  Used by the public `/demo` scroll surface (and as the shell default). */
export const SECTION_NAV: Record<WorkspaceRole, NavItem[]> = {
  corporate: [
    { href: "#overview", labelKey: "overview", icon: "grid" },
    { href: "#c-workspace", labelKey: "workspace", icon: "layout" },
    { href: "#c-evidence", labelKey: "evidenceImpact", icon: "doc" },
    { href: "#c-members", labelKey: "members", icon: "users" },
    { href: "#c-plans", labelKey: "plans", icon: "spark" }
  ],
  ngo: [
    { href: "#overview", labelKey: "overview", icon: "grid" },
    { href: "#n-workspace", labelKey: "workspace", icon: "layout" },
    { href: "#n-evidence", labelKey: "needsEvidence", icon: "doc" },
    { href: "#n-downloads", labelKey: "starterPackage", icon: "download" },
    { href: "#n-members", labelKey: "members", icon: "users" }
  ],
  admin: [
    { href: "#overview", labelKey: "overview", icon: "grid" },
    { href: "#a-verification", labelKey: "verification", icon: "shield" },
    { href: "#a-controls", labelKey: "controls", icon: "doc" },
    { href: "#a-members", labelKey: "members", icon: "users" }
  ],
  editor: [
    { href: "#overview", labelKey: "overview", icon: "grid" },
    { href: "#a-verification", labelKey: "verification", icon: "shield" },
    { href: "#a-controls", labelKey: "controls", icon: "doc" },
    { href: "#a-members", labelKey: "members", icon: "users" }
  ]
};

/**
 * Route-based navigation for the authenticated workspace. Overview and the
 * `/documents` moat are real routes; the remaining sections stay anchors on the
 * overview (`/#…`), which work from any route — so nothing 404s mid-migration.
 * Kept separate from SECTION_NAV so the public `/demo` surface is untouched.
 */
export const WORKSPACE_NAV: Record<WorkspaceRole, NavItem[]> = {
  corporate: [
    { href: "/", labelKey: "overview", icon: "grid", group: "groupWork" },
    { href: "/matches", labelKey: "matches", icon: "match", group: "groupWork" },
    { href: "/inbox", labelKey: "inbox", icon: "inbox", group: "groupWork" },
    { href: "/listings", labelKey: "listings", icon: "layout", group: "groupWork" },
    { href: "/cases", labelKey: "cases", icon: "layout", group: "groupWork" },
    { href: "/documents", labelKey: "evidenceImpact", icon: "doc", group: "groupEvidence" },
    { href: "/impact", labelKey: "impact", icon: "spark", group: "groupEvidence" },
  ],
  ngo: [
    { href: "/", labelKey: "overview", icon: "grid", group: "groupWork" },
    { href: "/matches", labelKey: "matches", icon: "match", group: "groupWork" },
    { href: "/inbox", labelKey: "inbox", icon: "inbox", group: "groupWork" },
    { href: "/needs", labelKey: "needs", icon: "layout", group: "groupWork" },
    { href: "/documents", labelKey: "needsEvidence", icon: "doc", group: "groupEvidence" },
    { href: "/impact", labelKey: "impact", icon: "spark", group: "groupEvidence" },
    { href: "/#n-downloads", labelKey: "starterPackage", icon: "download", group: "groupEvidence" },
  ],
  admin: [
    { href: "/", labelKey: "overview", icon: "grid", group: "groupWork" },
    { href: "/ops/ngos", labelKey: "ngos", icon: "shield", group: "groupWork" },
    { href: "/ops/companies", labelKey: "companies", icon: "users", group: "groupWork" },
    { href: "/ops/requests", labelKey: "requests", icon: "inbox", group: "groupWork" },
    { href: "/ops/approvals", labelKey: "approvals", icon: "spark", group: "groupWork" },
    { href: "/ops/admins", labelKey: "admins", icon: "shield", group: "groupWork" },
    { href: "/cases", labelKey: "cases", icon: "layout", group: "groupWork" },
    { href: "/matches", labelKey: "matches", icon: "match", group: "groupWork" },
    { href: "/inbox", labelKey: "inbox", icon: "layout", group: "groupWork" },
  ],
  editor: [
    { href: "/", labelKey: "overview", icon: "grid", group: "groupWork" },
    { href: "/ops/ngos", labelKey: "ngos", icon: "shield", group: "groupWork" },
    { href: "/ops/companies", labelKey: "companies", icon: "users", group: "groupWork" },
    { href: "/ops/requests", labelKey: "requests", icon: "inbox", group: "groupWork" },
    { href: "/ops/approvals", labelKey: "approvals", icon: "spark", group: "groupWork" },
    { href: "/cases", labelKey: "cases", icon: "layout", group: "groupWork" },
    { href: "/matches", labelKey: "matches", icon: "match", group: "groupWork" },
    { href: "/inbox", labelKey: "inbox", icon: "layout", group: "groupWork" },
  ]
};

/** Two initials from a workspace name, for the sidebar avatar. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");

  return letters.join("").toUpperCase() || "SP";
}

export function WorkspaceShell({
  activeHref,
  activeRole,
  authConfig,
  children,
  identity,
  locale,
  nav: navProp,
  sidebarFooter,
  t,
  topbarRight
}: {
  /** The nav item to mark active. Defaults to the first (overview). Route
   *  pages pass their own href; the scroll overview leaves it undefined. */
  activeHref?: string;
  activeRole: WorkspaceRole;
  /** When set (authenticated pages), the top bar renders a persistent sign-out
   *  button. The public `/demo` sandbox leaves it undefined. */
  authConfig?: SupabaseBrowserConfig;
  children: ReactNode;
  identity: WorkspaceIdentity;
  locale: Locale;
  /** Nav items. Defaults to the anchor SECTION_NAV (used by /demo). The
   *  authenticated workspace passes WORKSPACE_NAV (real routes). */
  nav?: NavItem[];
  /** Small status slot in the page footer (e.g. the demo's sandbox badge). */
  sidebarFooter?: ReactNode;
  t: Dictionary;
  /** Retained for existing callers; the header now shows only the wordmark. */
  tag?: string;
  topbarRight?: ReactNode;
}) {
  const nav = navProp ?? SECTION_NAV[activeRole];
  const currentHref = activeHref ?? nav[0]?.href;
  // Group the items in the order they first appear; ungrouped ones sit under "Navigate".
  const groups: Array<{ key: keyof Dictionary["nav"] | null; items: NavItem[] }> = [];
  for (const item of nav) {
    const key = item.group ?? null;
    const found = groups.find((group) => group.key === key);
    if (found) found.items.push(item);
    else groups.push({ key, items: [item] });
  }

  return (
    <SidebarProvider lang={locale}>
      <Sidebar className="print:hidden">
        <SidebarHeader>
          <a className="px-2 py-1.5 text-base font-semibold tracking-tight" href="/">
            sur.plus
          </a>
        </SidebarHeader>
        <SidebarContent aria-label={t.aria.workspaceNav}>
          {groups.map((group) => (
            <SidebarGroup key={group.key ?? "default"}>
              {group.key ? <SidebarGroupLabel className="text-xs">{t.nav[group.key]}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild className="h-10 gap-3 px-3 text-[15px] [&>svg]:size-5" isActive={item.href === currentHref}>
                        <a aria-current={item.href === currentHref ? "page" : undefined} href={item.href}>
                          {NAV_ICONS[item.icon]}
                          <span>{t.nav[item.labelKey]}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            {authConfig ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-10 gap-3 px-3 text-[15px] [&>svg]:size-5" isActive={currentHref === "/account"}>
                  <a aria-current={currentHref === "/account" ? "page" : undefined} href="/account">
                    <Settings aria-hidden="true" />
                    <span>{t.nav.account}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
            <SidebarMenuItem>
              <ProfileMenu
                initials={identity.initials}
                languageLabel={t.aria.language}
                locale={locale}
                name={identity.name}
                signOut={authConfig ? { config: authConfig, label: t.auth.session.signOut } : undefined}
                tier={identity.tier}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur print:hidden">
          <SidebarTrigger />
          <div className="ml-auto flex items-center gap-2">{topbarRight}</div>
        </header>

        <main id="overview" className="mx-auto w-full min-w-0 max-w-7xl scroll-mt-24">
          {children}
        </main>

        {sidebarFooter ? (
          <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 pb-8 pt-4 print:hidden sm:px-6">
            {sidebarFooter}
          </footer>
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}

const ICON_SIZE = { className: "size-4" } as const;

const NAV_ICONS = {
  grid: <LayoutGrid {...ICON_SIZE} />,
  doc: <FileText {...ICON_SIZE} />,
  layout: <PanelsTopLeft {...ICON_SIZE} />,
  match: <ArrowLeftRight {...ICON_SIZE} />,
  inbox: <Inbox {...ICON_SIZE} />,
  users: <Users {...ICON_SIZE} />,
  spark: <Sparkles {...ICON_SIZE} />,
  shield: <ShieldCheck {...ICON_SIZE} />,
  download: <Download {...ICON_SIZE} />,
  calendar: <CalendarDays {...ICON_SIZE} />,
  globe: <Globe {...ICON_SIZE} />
} as const;
