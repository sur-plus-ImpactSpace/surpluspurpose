import { AdminBootstrapPanel } from "../../components/AdminBootstrapPanel";
import { AuthSessionControls } from "../../components/AuthSessionControls";
import { getDictionary } from "../../lib/i18n";
import { supabaseBrowserConfigFromEnv } from "../../lib/service-chat-realtime";

export const dynamic = "force-dynamic";

export default function OpsBootstrapPage() {
  const authConfig = supabaseBrowserConfigFromEnv();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              sur.plus Ops · First admin
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal sm:text-4xl">
              Bootstrap Ops access
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Create the first sur.plus admin profile after Supabase sign-in, email allowlist and bootstrap token checks.
            </p>
          </div>
          <AuthSessionControls
            config={authConfig}
            source={authConfig ? "supabase" : "preview"}
            t={getDictionary("en").auth.session}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[0.8fr_0.5fr]">
        <AdminBootstrapPanel authConfig={authConfig} />
        <section className="rounded-xl border border-border bg-card shadow-xs p-5 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Boundary</p>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>Requires Supabase Auth.</p>
            <p>Requires an allowlisted admin email.</p>
            <p>Requires the server-configured bootstrap token.</p>
            <p>Writes an admin-only audit event.</p>
          </div>
        </section>
      </section>
    </main>
  );
}
