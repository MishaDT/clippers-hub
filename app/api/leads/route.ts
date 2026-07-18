import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { businessLeadSchema } from "@/lib/business-lead";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { LEAD_CONSENT_VERSION } from "@/lib/legal";

export async function POST(request: Request) {
  if (!(await rateLimit(`business-lead:${clientIp(request)}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json({ ok: false, error: "Слишком много заявок. Попробуйте позже." }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") || 0) > 12_000) {
    return NextResponse.json({ ok: false, error: "Слишком большой запрос." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Проверьте данные формы." }, { status: 400 });
  }
  const parsed = businessLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Проверьте поля." }, { status: 400 });
  }

  const user = await getCurrentUser();
  const data = parsed.data;
  const lead = await prisma.businessLead.create({
    data: {
      userId: user?.id,
      name: data.name,
      contact: data.contact,
      contentUrl: data.contentUrl || null,
      budgetCents: data.budgetRub * 100,
      goal: data.goal,
      source: "pilot_landing",
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
      consentVersion: LEAD_CONSENT_VERSION,
      consentedAt: new Date()
    }
  });
  await trackEvent({
    request,
    userId: user?.id,
    type: "BUSINESS_LEAD_SUBMITTED",
    path: "/#pilot",
    metadata: { leadId: lead.id, source: "pilot_landing", budgetBand: Math.floor(data.budgetRub / 10_000) * 10_000 }
  });

  return NextResponse.json({ ok: true, leadId: lead.id });
}
