import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { SPECIALTIES } from "@/lib/profile-rules";
import {
  movePortfolioPinAction,
  pinPortfolioAction,
  removePortfolioPinAction,
  updateProfileAction
} from "./actions";

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
    take: 50
  });
  const selected = parseJson<string[]>(user.specialtiesJson, []);
  const socialLinks = parseJson<string[]>(user.socialLinksJson, []);
  const pinnedIds = new Set(user.portfolioPins.map((pin) => pin.submissionId));

  return (
    <main className="settings-page profile-settings">
      <header className="settings-title">
        <Link href="/profile"><ArrowLeft size={18} /> Профиль</Link>
        <div><h1>Редактирование профиля</h1><p>Публичные данные и лучшие подтверждённые работы.</p></div>
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
        <button className="btn btn-primary" type="submit">Сохранить профиль</button>
      </form>

      <section className="settings-card">
        <div className="settings-section-head"><div><h2>Лучшие работы</h2><p>До шести подтверждённых роликов. Остальные места профиль заполнит автоматически.</p></div><Link href={`/clippers/${user.handle}`}><ExternalLink size={16} /> Открыть профиль</Link></div>
        <div className="portfolio-manage">
          {user.portfolioPins.map((pin, index) => (
            <article key={pin.id}>
              <span>{index + 1}</span><div><b>{pin.submission.campaign.title}</b><small>{pin.submission.currentViews.toLocaleString("ru-RU")} просмотров</small></div>
              <form action={movePortfolioPinAction}><input type="hidden" name="pinId" value={pin.id} /><button name="direction" value="up" aria-label="Поднять"><ArrowUp size={16} /></button><button name="direction" value="down" aria-label="Опустить"><ArrowDown size={16} /></button></form>
              <form action={removePortfolioPinAction}><input type="hidden" name="pinId" value={pin.id} /><button aria-label="Убрать"><Trash2 size={16} /></button></form>
            </article>
          ))}
          {!user.portfolioPins.length ? <p className="muted">Закреплённых работ пока нет.</p> : null}
        </div>
        {user.portfolioPins.length < 6 ? <div className="portfolio-available">
          <h3>Добавить подтверждённую работу</h3>
          {submissions.filter((item) => !pinnedIds.has(item.id)).slice(0, 12).map((item) => (
            <form action={pinPortfolioAction} key={item.id}><input type="hidden" name="submissionId" value={item.id} /><span><b>{item.campaign.title}</b><small>{item.currentViews.toLocaleString("ru-RU")} просмотров</small></span><button className="btn btn-ghost btn-small">Добавить</button></form>
          ))}
        </div> : null}
      </section>
    </main>
  );
}
