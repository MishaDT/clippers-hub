import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getActiveRoleMode } from "@/lib/role-mode";
import { redirect } from "next/navigation";
import { CampaignForm } from "./campaign-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewCampaignPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  if (await getActiveRoleMode(user) !== "client") redirect("/campaigns");

  return (
    <AppShell hideBottomNav hideFooter>
      <section className="section order-create-screen">
        <Link className="campaign-create-back" href="/campaigns"><ArrowLeft size={17} /> Назад к кампаниям</Link>
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
