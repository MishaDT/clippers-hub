import Link from "next/link";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { SPECIALTIES } from "@/lib/profile-rules";
import { updateProfileAction } from "./actions";
import { PortfolioManager } from "@/components/portfolio-manager";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();
  const params = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    include: {
      portfolioPins: {
        orderBy: { position: "asc" },
        include: { submission: { include: { campaign: { select: { title: true } } } } }
      }
    }
  });
  const submissions = await prisma.submission.findMany({
    where: {
      workerId: user.id,
      verifiedAt: { not: null },
      status: { in: ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"] }
    },
    include: { campaign: { select: { title: true } } },
    orderBy: { currentViews: "desc" },
    take: 6
  });
  const selected = parseJson<string[]>(user.specialtiesJson, []);
  const socialLinks = parseJson<string[]>(user.socialLinksJson, []);

  return (
    <main className="settings-page profile-settings">
      <header className="settings-title">
        <Link href="/profile"><ArrowLeft size={18} /> Профиль</Link>
        <div><h1>Редактирование профиля</h1><p>Публичные данные и витрина для заказчиков.</p></div>
      </header>
      {params.saved ? <p className="form-success"><Check size={16} /> Изменения сохранены</p> : null}
      {params.error ? <p className="form-error">Проверьте данные. Никнейм может быть занят или временно недоступен для смены.</p> : null}

      <form className="settings-card settings-form" action={updateProfileAction}>
        <label>Имя<input name="name" defaultValue={user.name} minLength={2} maxLength={50} required /></label>
        <label>Никнейм<input name="handle" defaultValue={user.handle} pattern="[a-z0-9_]{3,24}" maxLength={24} required /><small>Латиница, цифры и _. Менять можно раз в 30 дней.</small></label>
        <label>О себе<textarea name="bio" defaultValue={user.bio || ""} maxLength={300} rows={4} /></label>
        <fieldset><legend>Специализации, максимум 5</legend><div className="settings-checks">
          {SPECIALTIES.map((item) => <label key={item}><input type="checkbox" name="specialties" value={item} defaultChecked={selected.includes(item)} /> {item}</label>)}
        </div></fieldset>
        <label>Социальные сети<textarea name="socialLinks" defaultValue={socialLinks.join("\n")} rows={5} placeholder="По одной HTTPS-ссылке на строку" /><small>YouTube, TikTok, Instagram, VK, Twitch или Telegram. Максимум 5.</small></label>
        <label>Кто может предложить коллаб
          <select name="collabAvailability" defaultValue={user.collabAvailability}>
            <option value="ACTIVE_ROLE">Только противоположная активная роль</option>
            <option value="BOTH">Заказчики и исполнители</option>
            <option value="NONE">Никто</option>
          </select>
          <small>Выбранная роль видна в публичном профиле и определяет тип предложений.</small>
        </label>
        <button className="btn btn-primary" type="submit">Сохранить профиль</button>
      </form>

      <section className="settings-card">
        <div className="settings-section-head"><Link href={`/clippers/${user.handle}?returnTo=%2Fsettings%2Fprofile`}><ExternalLink size={16} /> Открыть публичный профиль</Link></div>
        <PortfolioManager initialPins={user.portfolioPins} automatic={submissions} />
      </section>
    </main>
  );
}
