import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CampaignForm } from "./campaign-form";

export default async function NewCampaignPage() {
  await requireUser();

  return (
    <AppShell hideBottomNav>
      <section className="section order-create-screen">
        <CampaignForm />
      </section>
    </AppShell>
  );
}
