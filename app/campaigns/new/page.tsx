import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getActiveRoleMode } from "@/lib/role-mode";
import { redirect } from "next/navigation";
import { CampaignForm } from "./campaign-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { rub } from "@/lib/money";

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
        {params.error === "budget_min" ? (
          <Card className="upload-status warn">
            <strong>Бюджета не хватает на указанное количество результатов</strong>
            <span>Минимальный резерв для этих условий: {rub(Number(params.need || 0))}. Увеличьте бюджет или уменьшите количество публикаций.</span>
          </Card>
        ) : null}
        <CampaignForm preferInitial={Boolean(params.deliverableCount || params.viewThreshold || params.budget || params.cpm || params.minimumGuarantee || params.deadlineDays)} initial={{
          deliverableCount: Math.max(1, Math.min(20, Number(params.deliverableCount || 3))),
          viewThreshold: [5000, 10000, 25000, 50000].includes(Number(params.viewThreshold)) ? Number(params.viewThreshold) : 10000,
          budget: Math.max(1000, Number(params.budget || 15000)),
          cpm: Math.max(10, Number(params.cpm || 50)),
          minimumGuarantee: Math.max(0, Number(params.minimumGuarantee || 100)),
          deadlineDays: [3, 7, 14, 30].includes(Number(params.deadlineDays)) ? Number(params.deadlineDays) : 7
        }} />
      </section>
    </AppShell>
  );
}
