import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CampaignForm } from "./campaign-form";

export default async function NewCampaignPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await requireUser();

  return (
    <AppShell hideBottomNav>
      <section className="section order-create-screen">
        {params.error === "source_url" ? (
          <Card className="upload-status warn">
            <strong>Ссылка на исходник не прошла проверку</strong>
            <span>{String(params.reason || "Проверь HTTPS и площадку исходного видео.")}</span>
          </Card>
        ) : null}
        <CampaignForm />
      </section>
    </AppShell>
  );
}
