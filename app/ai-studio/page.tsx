import { AppShell, Card, Tag } from "@/components/ui";

export default function AiStudioPage() {
  return (
    <AppShell>
      <section className="section">
        <span className="eyebrow">AI Studio</span>
        <h1>Рекомендации по таймкодам, заголовкам, доходу и модерации.</h1>
      </section>
      <section className="section grid grid-2">
        <Card>
          <div className="hero-art ai-art" />
        </Card>
        <Card>
          <h2>AI Clip Recommender</h2>
          <div className="row"><strong>00:12:44</strong><div><b>Эмоциональный пик</b><p className="small">“Донат, после которого стример замолчал” · score 91</p></div><Tag tone="good">₽740</Tag></div>
          <div className="row"><strong>01:08:19</strong><div><b>Мемная фраза</b><p className="small">“Он не поверил, что это случилось” · score 87</p></div><Tag>₽520</Tag></div>
          <div className="row"><strong>02:41:02</strong><div><b>Неожиданный поворот</b><p className="small">Подходит для TikTok, Instagram Reels и VK Clips</p></div><Tag>₽610</Tag></div>
        </Card>
      </section>
      <section className="section grid grid-3">
        <Card><Tag>Title Generator</Tag><h2>5 заголовков</h2><p className="muted">Донат, который сломал стрим<br />Он не ожидал такой реакции<br />Самая дорогая ошибка вечера</p></Card>
        <Card><Tag tone="good">Moderation</Tag><h2>Clean</h2><p className="muted">NSFW clean, hate speech clean, запреты заказчика не нарушены.</p></Card>
        <Card><Tag tone="warn">Predictor</Tag><h2>₽480-920</h2><p className="muted">Оценка заработка с учетом ставки, истории клиппера и площадки.</p></Card>
      </section>
    </AppShell>
  );
}
