import { RemoveAdminButton } from "../../components/admin/AdminRowActions";
import { DetailDialog, DetailGrid } from "../../components/admin/DetailDialog";
import { InviteAdminDialog } from "../../components/AdminAccountPanel";
import { DataTable, NameCell, StatusBadge } from "../../components/admin/DataTable";
import { AdminPage } from "../../components/dashboard/AdminPage";
import type { SearchParams } from "../../lib/workspace-view";

export const dynamic = "force-dynamic";

/** Everyone with admin access. The super admin can invite more from here. */
export default function OpsAdminsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return (
    <AdminPage activeHref="/ops/admins" requireAdmin searchParams={searchParams} title="Admins">
      {({ actor, authConfig, data }) => {
        const superAdminEmail = process.env.SURPLUS_SUPERADMIN_EMAIL?.trim().toLowerCase();
        const admins = data.users
          .filter((user) => user.role === "admin" || user.role === "editor")
          .sort((a, b) => a.email.localeCompare(b.email));
        const isSuperAdmin =
          Boolean(superAdminEmail) && admins.find((user) => user.id === actor.userId)?.email.toLowerCase() === superAdminEmail;

        return (
          <div className="grid gap-4">
            {isSuperAdmin ? (
              <div className="flex justify-end">
                <InviteAdminDialog config={authConfig} />
              </div>
            ) : null}
            <DataTable
              columns={[{ label: "Admin" }, { label: "Email" }, { label: "Role" }, { label: "Added" }, { label: "", align: "right" }]}
              empty="No admins yet."
              rows={admins.map((user) => ({
                id: user.id,
                search: `${user.fullName} ${user.email}`,
                cells: [
                  <NameCell key="n" name={user.fullName || user.email.split("@")[0] || user.email} />,
                  <span className="text-muted-foreground" key="e">{user.email}</span>,
                  <StatusBadge key="r" tone={user.email.toLowerCase() === superAdminEmail ? "good" : "neutral"}>
                    {user.email.toLowerCase() === superAdminEmail
                      ? "super admin"
                      : user.role === "editor"
                        ? "editor"
                        : "admin"}
                  </StatusBadge>,
                  <span className="text-muted-foreground" key="a">{user.createdAt.slice(0, 10)}</span>,
                  <DetailDialog
                    footer={
                      isSuperAdmin && user.id !== actor.userId && user.email.toLowerCase() !== superAdminEmail ? (
                        <RemoveAdminButton config={authConfig} email={user.email} userId={user.id} />
                      ) : null
                    }
                    key="d"
                    subtitle={user.email}
                    title={user.fullName || user.email}
                  >
                    <DetailGrid
                      items={[
                        { label: "Name", value: user.fullName },
                        { label: "Email", value: user.email },
                        { label: "Role", value: user.email.toLowerCase() === superAdminEmail ? "Super admin" : "Admin" },
                        { label: "Added", value: user.createdAt.slice(0, 10) }
                      ]}
                    />
                  </DetailDialog>
                ]
              }))}
              title="Admins"
            />
          </div>
        );
      }}
    </AdminPage>
  );
}
