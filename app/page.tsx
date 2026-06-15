import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Heart, Play, Send, Video, WalletCards } from "lucide-react";
import { AppShell, Card, RoleChoice, Stat, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";

const images = ["/assets/gaming-order.png", "/assets/podcast-order.png", "/assets/marketplace-thumb.png"];

export default async function HomePage() {
  const [campaigns, users, submissions, paid, latestSubmissions] = await Promise.all([
    prisma.campaign.count({ where: { status: { in: ["ACTIVE", "LOW_BUDGET"] } } }),
    prisma.user.count(),
    prisma.submission.aggregate({ _sum: { currentViews: true }, _count: true }),
    prisma.transaction.aggregate({ where: { type: "EARNING" }, _sum: { netCents: true } }),
    prisma.submission.findMany({
      include: { campaign: true, worker: true },
      orderBy: { currentViews: "desc" },
      take: 6
    })
  ]);

  return (
    <AppShell>
      <section className="landing-hero app-hero section">
        <div className="landing-copy">
          <span className="eyebrow">ReelPay</span>
          <h1>Видео, которые <span className="gradient-text">приносят деньги</span></h1>
          <p className="lead">
            Клиенты создают заказы и кампании, а исполнители делают рилсы из стримов, подкастов и видео. Деньги начисляются за результат.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-hero" href="/register">Начать <ArrowRight size={20} /></Link>
            <Link className="text-link" href="#how-it-works">Как это работает</Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-coin coin-a">₽</div>
          <div className="floating-coin coin-b">₽</div>
          <VideoMock
            title={latestSubmissions[0]?.campaign.title || "Пример клипа"}
            author={`@${latestSubmissions[0]?.worker.handle || "anya_clips"}`}
            views={compactNumber(latestSubmissions[0]?.currentViews || 842000)}
            image="/assets/gaming-order.png"
          />
          <div className="income-panel">
            <strong>+{rub(2456000)}</strong>
            <span>доход исполнителей за неделю</span>
          </div>
        </div>
      </section>

      <section className="section step-cards">
        <Card className="app-step">
          <span><BriefcaseBusiness size={24} /></span>
          <h3>Создай заказ</h3>
          <p>Клиент публикует задачу и указывает, что нужно.</p>
          <b>01</b>
        </Card>
        <Card className="app-step">
          <span><Video size={24} /></span>
          <h3>Сделай ролик</h3>
          <p>Исполнитель собирает рилс из стрима или видео.</p>
          <b>02</b>
        </Card>
        <Card className="app-step">
          <span><WalletCards size={24} /></span>
          <h3>Получай оплату</h3>
          <p>Ролик набирает просмотры, система считает выплату.</p>
          <b>03</b>
        </Card>
      </section>

      <section className="section flow-story" id="how-it-works">
        <div className="section-head compact">
          <div>
            <span className="eyebrow">Как это работает</span>
            <h2>Один заказ проходит весь путь: от идеи до выплаты.</h2>
          </div>
          <Link className="btn btn-ghost" href="/campaigns/new">Создать заказ</Link>
        </div>
        <div className="flow-track">
          {[
            ["01", "Заказчик создает кампанию", "Загружает ссылку на стрим или видео, описывает стиль, бюджет и порог просмотров."],
            ["02", "Клиппер берет задачу", "Выбирает заказ, делает ролик, загружает видео и вставляет публичную ссылку."],
            ["03", "Платформа считает просмотры", "YouTube/VK/TikTok/Instagram провайдеры синхронизируют метрики и проверяют антифрод."],
            ["04", "Деньги уходят исполнителю", "После достижения порога и settlement-периода выплата появляется в кошельке."]
          ].map(([num, title, text]) => (
            <Card className="flow-card" key={num}>
              <b>{num}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section role-section">
        <div>
          <span className="eyebrow">Кто вы сегодня?</span>
          <h2>Выберите роль, с которой хотите начать.</h2>
        </div>
        <RoleChoice />
      </section>

      <section className="section grid grid-4">
        <Stat value={campaigns} label="активных заказов" />
        <Stat value={users} label="людей на платформе" />
        <Stat value={compactNumber(submissions._sum.currentViews || 0)} label="просмотров у клипов" />
        <Stat value={rub(paid._sum.netCents || 0)} label="выплачено клипперам" tone="good" />
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Живая витрина</span>
            <h2>Так выглядят ролики, которые уже делают исполнители.</h2>
          </div>
          <Link className="btn btn-ghost" href="/feed">Открыть ленту</Link>
        </div>
        <div className="reel-grid">
          {latestSubmissions.slice(0, 3).map((submission, index) => (
            <VideoMock
              key={submission.id}
              title={submission.campaign.title}
              author={`@${submission.worker.handle}`}
              views={compactNumber(submission.currentViews)}
              image={images[index % images.length]}
            />
          ))}
        </div>
      </section>

      <section className="section grid grid-3 legacy-steps">
        <Card>
          <Tag>1 шаг</Tag>
          <h3>Заказчик публикует задачу</h3>
          <p className="muted">Например: найти смешные моменты из стрима и сделать вертикальные клипы с субтитрами.</p>
        </Card>
        <Card>
          <Tag tone="good">2 шаг</Tag>
          <h3>Клиппер делает ролик</h3>
          <p className="muted">Берет заказ, монтирует видео, выкладывает его на площадку и отправляет ссылку.</p>
        </Card>
        <Card>
          <Tag tone="warn">3 шаг</Tag>
          <h3>Просмотры становятся выплатой</h3>
          <p className="muted">Когда клип набрал порог, система считает выплату и показывает ее в кошельке.</p>
        </Card>
      </section>
    </AppShell>
  );
}

function VideoMock({ title, author, views, image }: { title: string; author: string; views: string; image: string }) {
  return (
    <article className="reel-card" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.83)), url(${image})` }}>
      <div className="reel-badge">LIVE</div>
      <div className="reel-actions">
        <span><Heart size={19} /></span>
        <span><Play size={18} /></span>
        <span><Send size={18} /></span>
      </div>
      <div className="reel-info">
        <strong>{title}</strong>
        <p>{author} · {views} просмотров</p>
      </div>
    </article>
  );
}
