import type { Notification } from "@surplus/domain";

/** The signed-in user's own notifications, newest first (reminders and status changes). */
export function NotificationsPanel({ notifications }: { notifications: Notification[] }) {
  if (notifications.length === 0) return null;

  return (
    <section className="mb-5 rounded-xl border border-border bg-card p-5 shadow-xs" aria-label="Notifications">
      <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
      <ul className="mt-3 divide-y divide-border">
        {notifications.slice(0, 10).map((notification) => (
          <li className="py-2.5 text-sm" key={notification.id}>
            <p className="font-semibold">{notification.title}</p>
            <p className="text-muted-foreground">{notification.body}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{notification.createdAt.slice(0, 10)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
