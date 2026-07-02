import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRoleMode } from "@/lib/role-mode";
import { prisma } from "@/lib/prisma";
import { expectedPayout, rub } from "@/lib/money";

type Suggestion = {
  id: string;
  priority: number;
  label: string;
  hint: string;
  href: string;
  icon: "work" | "chat" | "upload" | "wallet" | "help";
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      suggestions: [
        { id: "login", priority: 50, label: "Войти в ReelPay", hint: "Заказы и кампании доступны после входа", href: "/login", icon: "work" }
      ]
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const mode = await getActiveRoleMode(user);
  const suggestions: Suggestion[] = [];

  if (mode === "worker") {
    const [active, portfolioCount, completedCount] = await Promise.all([
      prisma.submission.findFirst({
        where: { workerId: user.id, status: { in: ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"] } },
        orderBy: { updatedAt: "asc" },
        include: { campaign: { select: { id: true, title: true, deadline: true } } }
      }),
      prisma.portfolioPin.count({ where: { userId: user.id } }),
      prisma.submission.count({
        where: {
          workerId: user.id,
          verifiedAt: { not: null },
          status: { in: ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"] }
        }
      })
    ]);

    if (active) {
      const hoursLeft = Math.max(0, Math.ceil((active.campaign.deadline.getTime() - Date.now()) / 3_600_000));
      const hoursIdle = Math.floor((Date.now() - active.updatedAt.getTime()) / 3_600_000);
      const action = active.status === "ACCEPTED"
        ? {
            label: hoursIdle >= 24 ? "Заказ ждёт публикацию больше суток" : "Опубликовать принятый ролик",
            hint: hoursLeft <= 24 ? `До дедлайна около ${hoursLeft} ч.` : "Возьмите tracking-код и отправьте ссылку",
            href: "/upload",
            icon: "upload" as const
          }
        : active.status === "POSTED"
          ? {
              label: "Проверить статус отправленной ссылки",
              hint: active.campaign.title,
              href: `/campaigns/${active.campaign.id}`,
              icon: "work" as const
            }
          : active.status === "VERIFIED"
            ? {
                label: "Публикация подтверждена",
                hint: "Следите за просмотрами до достижения цели",
                href: `/campaigns/${active.campaign.id}`,
                icon: "work" as const
              }
            : {
                label: "Проверить расчёт по заказу",
                hint: active.status === "THRESHOLD_MET" ? "Цель достигнута, идёт финальная проверка" : "Выплата проходит защитный период",
                href: `/campaigns/${active.campaign.id}`,
                icon: "wallet" as const
              };
      suggestions.push({
        id: `active-${active.id}`,
        priority: hoursLeft <= 24 ? 100 : 90,
        ...action
      });
    }
    if (completedCount > 0 && portfolioCount === 0) {
      suggestions.push({
        id: "portfolio-first",
        priority: 65,
        label: "Закрепить лучшую работу в профиле",
        hint: "У вас уже есть подтверждённый ролик для портфолио",
        href: "/settings/profile",
        icon: "work"
      });
    }
    if (!active) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          status: { in: ["ACTIVE", "LOW_BUDGET"] },
          visibility: { in: ["PUBLIC", "FEATURED"] },
          remainingBudgetCents: { gt: 0 },
          deadline: { gt: new Date() }
        },
        orderBy: [{ featuredUntil: "desc" }, { createdAt: "desc" }],
        select: { id: true, title: true, viewThreshold: true, cpmRateCents: true }
      });
      suggestions.push(campaign ? {
        id: `campaign-${campaign.id}`,
        priority: 75,
        label: "Подходящий заказ уже в ленте",
        hint: `${rub(expectedPayout(campaign.viewThreshold, campaign.cpmRateCents, user.rank))} чистыми · ${campaign.title}`,
        href: `/campaigns/${campaign.id}`,
        icon: "work"
      } : {
        id: "campaign-search",
        priority: 50,
        label: "Проверить новые заказы",
        hint: "Откройте ленту и настройте фильтры",
        href: "/campaigns",
        icon: "work"
      });
    }
  } else {
    const campaign = await prisma.campaign.findFirst({
      where: { ownerId: user.id, status: { in: ["ACTIVE", "LOW_BUDGET", "PAUSED"] } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        remainingBudgetCents: true,
        reservedBudgetCents: true,
        createdAt: true,
        _count: { select: { submissions: true } }
      }
    });
    if (!campaign) {
      suggestions.push({
        id: "client-first-campaign",
        priority: 85,
        label: "Рассчитать первую кампанию",
        hint: "Укажите цель, число публикаций и максимальный бюджет",
        href: "/campaigns/new",
        icon: "work"
      });
    } else {
      const hoursWithoutResponse = Math.floor((Date.now() - campaign.createdAt.getTime()) / 3_600_000);
      if (campaign._count.submissions === 0 && hoursWithoutResponse >= 24) {
        suggestions.push({
          id: `client-no-response-${campaign.id}`,
          priority: 80,
          label: "За сутки заказ никто не взял",
          hint: "Проверьте ставку, исходник и требования",
          href: `/campaigns/${campaign.id}`,
          icon: "work"
        });
      }
      if (campaign.status === "LOW_BUDGET" || campaign.remainingBudgetCents <= 0) {
        suggestions.push({
          id: `client-budget-${campaign.id}`,
          priority: 95,
          label: "Заканчивается свободный бюджет",
          hint: `${rub(campaign.reservedBudgetCents)} уже закреплено за клипперами`,
          href: "/wallet?tab=operations",
          icon: "wallet"
        });
      }
    }
  }

  return NextResponse.json({
    suggestions: suggestions.sort((a, b) => b.priority - a.priority).slice(0, 3)
  }, { headers: { "Cache-Control": "no-store" } });
}
