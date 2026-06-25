import { AppShell } from "@/components/ui";
import { AdminNav } from "@/components/admin-nav";
import { requireAdmin } from "@/lib/admin";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <AppShell hideBottomNav>
      <section className="section admin-console">
        <AdminNav />
        <div className="admin-workspace">{children}</div>
      </section>
    </AppShell>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="admin-page-action">{action}</div> : null}
    </div>
  );
}
