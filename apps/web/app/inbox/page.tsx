import type { Message } from "@surplus/domain";
import type { Metadata } from "next";
import { PageCrumb } from "../components/PageCrumb";
import { NotificationsPanel } from "../components/NotificationsPanel";
import { EmptyState, ServicePanel } from "../components/dashboard/shared";
import { WORKSPACE_NAV, WorkspaceShell } from "../components/shell/WorkspaceShell";
import type { Dictionary } from "../lib/i18n";
import { serviceChatRealtimeConfigFromEnv } from "../lib/service-chat-realtime";
import { resolveWorkspaceForRoute, type SearchParams } from "../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Inbox"
};

/** Newest message in a thread, for the list preview. Messages are not stored
 *  pre-sorted, so sort defensively by createdAt. */
function latestMessage(messages: Message[]): Message | undefined {
  return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
}

function threadHref(matchId: string, lang?: string): string {
  const params = new URLSearchParams({ match: matchId });
  if (lang) params.set("lang", lang);
  return `/inbox?${params.toString()}`;
}

/**
 * Dedicated Inbox (gojiberr-style IA): every match conversation in one place.
 * Left column lists the threads (one per match) with a last-message preview;
 * the right column opens the selected thread — the same auditable, per-match
 * chat used on /matches, reused here so nothing is duplicated. Corporate & NGO
 * get the composer; Ops sees threads read-only.
 */
export default async function InboxPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const { actor, authConfig, identity, locale, repo, source, t } = await resolveWorkspaceForRoute(
    Promise.resolve(params)
  );

  const matches = repo.matches.list(actor);
  const threads = matches
    .map((match) => {
      const messages = repo.messages.listForMatch(match.id, actor);
      return {
        match,
        messages,
        title: repo.listings.get(match.listingId)?.title ?? match.id,
        last: latestMessage(messages)
      };
    })
    .sort((a, b) => (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? ""));

  const selectedParam = typeof params.match === "string" ? params.match : undefined;
  const selected = threads.find((thread) => thread.match.id === selectedParam) ?? threads[0];
  const langParam = typeof params.lang === "string" ? params.lang : undefined;
  const realtimeConfig = serviceChatRealtimeConfigFromEnv(source);
  const counterparty = actor.role === "corporate" ? t.inbox.counterpartyCorporate : t.inbox.counterpartyNgo;

  return (
    <WorkspaceShell
      activeHref="/inbox"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={t.routes.inbox.title} />

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <NotificationsPanel notifications={repo.notifications.list(actor)} />
        {threads.length === 0 ? (
          <EmptyState hint={t.inbox.emptyHint} next={t.inbox.emptyNext} title={t.inbox.emptyTitle} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <p className="px-2 pb-1 pt-1.5 text-xs font-medium">
                {t.inbox.threadsTitle}
              </p>
              <p className="px-2 pb-2 text-sm leading-6 text-muted-foreground">{t.inbox.threadsLead}</p>
              <ul className="grid gap-1.5">
                {threads.map((thread) => {
                  const active = thread.match.id === selected?.match.id;
                  return (
                    <li key={thread.match.id}>
                      <a
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-lg border px-3 py-2.5 transition-colors ${
                          active
                            ? "border-primary/30 bg-muted"
                            : "border-transparent hover:bg-muted/60"
                        }`}
                        href={threadHref(thread.match.id, langParam)}
                      >
                        <p className="truncate text-sm font-semibold text-foreground">{thread.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {counterparty}
                          {thread.last ? ` · ${thread.last.body}` : ` · ${t.inbox.noMessages}`}
                        </p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div className="min-w-0">
              {selected ? (
                actor.role === "admin" || actor.role === "editor" ? (
                  <ReadOnlyThread messages={selected.messages} t={t} title={selected.title} />
                ) : (
                  <ServicePanel
                    actor={actor}
                    authConfig={authConfig}
                    match={selected.match}
                    messages={selected.messages}
                    realtimeConfig={realtimeConfig}
                    role={actor.role === "corporate" ? "Corporate" : "NGO"}
                  />
                )
              ) : (
                <EmptyState hint={t.inbox.selectHint} next="" title={t.inbox.selectPrompt} />
              )}
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

/** Ops sees the audit trail of a thread without a composer (read-only). */
function ReadOnlyThread({ messages, t, title }: { messages: Message[]; t: Dictionary; title: string }) {
  const ordered = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <p className="text-xs font-medium">
        {t.inbox.eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold">{title}</h2>
      {ordered.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t.inbox.noMessages}</p>
      ) : (
        <ul className="mt-4 grid gap-2.5">
          {ordered.map((message) => (
            <li key={message.id} className="rounded-lg border border-border bg-muted px-3.5 py-2.5">
              <p className="wrap-break-word text-sm leading-6 text-foreground">{message.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(message.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
