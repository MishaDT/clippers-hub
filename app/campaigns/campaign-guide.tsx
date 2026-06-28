"use client";

import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Eye,
  Film,
  Maximize2,
  Pause,
  Play,
  Scissors,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "reelpay:campaign-guide-v2-collapsed";

const scenes = [
  {
    label: "ReelPay",
    kicker: "Контент начинает работать",
    title: "Видео, которые приносят результат",
    text: "Заказчики получают охват. Исполнители зарабатывают на монтаже.",
    duration: 6000
  },
  {
    label: "Задача",
    kicker: "Две стороны — один процесс",
    title: "Контент уже есть",
    text: "Заказчику нужны короткие ролики. Исполнителю — понятные заказы и честная оплата.",
    duration: 7000
  },
  {
    label: "Заказчик",
    kicker: "Путь заказчика",
    title: "Создай заказ за несколько минут",
    text: "Добавь исходник, правила, цель по просмотрам и бюджет. Деньги резервируются до результата.",
    duration: 7000
  },
  {
    label: "Исполнитель",
    kicker: "Путь исполнителя",
    title: "Выбери задачу без переговоров",
    text: "Сразу видны тема, требования, срок, цель и ожидаемая оплата.",
    duration: 7000
  },
  {
    label: "Публикация",
    kicker: "От исходника до клипа",
    title: "Смонтируй. Опубликуй. Отправь ссылку",
    text: "Shorts, TikTok, Reels или VK Clips — площадку выбирает заказчик.",
    duration: 7000
  },
  {
    label: "Проверка",
    kicker: "Прозрачность и защита",
    title: "ReelPay проверяет результат",
    text: "Tracking-код, реальные просмотры через API и защита от подозрительной активности.",
    duration: 7000
  },
  {
    label: "Результат",
    kicker: "Выгода для двоих",
    title: "Просмотры превращаются в результат",
    text: "Заказчик получает охват и ролики. Исполнитель — оплату после подтверждения.",
    duration: 7000
  },
  {
    label: "Старт",
    kicker: "Твой следующий шаг",
    title: "Превращай контент в охват и доход",
    text: "Выбери свою роль и начни с одного простого действия.",
    duration: 6000
  }
] as const;

function PromoVisual({ scene }: { scene: number }) {
  if (scene === 0) {
    return (
      <div className="rpv rpv-intro">
        <div className="rpv-source">
          <span><Film size={16} /> Стрим</span>
          <b>02:48:17</b>
          <i />
          <i />
          <i />
        </div>
        <div className="rpv-transform"><Scissors size={22} /><span /></div>
        <div className="rpv-phones">
          <div><Play size={18} fill="currentColor" /><small>18K</small></div>
          <div><Play size={18} fill="currentColor" /><small>64K</small></div>
          <div><Play size={18} fill="currentColor" /><small>121K</small></div>
        </div>
      </div>
    );
  }

  if (scene === 1) {
    return (
      <div className="rpv rpv-problem">
        <div className="rpv-role rpv-role-client">
          <span><BriefcaseBusiness size={18} /> Заказчик</span>
          <div className="rpv-long-video"><Play size={20} /><b>3 часа контента</b></div>
          <p>Нет времени на Shorts</p>
        </div>
        <div className="rpv-link"><Sparkles size={21} /></div>
        <div className="rpv-role rpv-role-worker">
          <span><Scissors size={18} /> Исполнитель</span>
          <div className="rpv-editor-mini"><i /><i /><i /><i /></div>
          <p>Нужны понятные заказы</p>
        </div>
      </div>
    );
  }

  if (scene === 2) {
    return (
      <div className="rpv rpv-order">
        <div className="rpv-form">
          <header><BriefcaseBusiness size={17} /><b>Новый заказ</b><span>Черновик</span></header>
          <label>Исходное видео <i>youtube.com/watch/...</i></label>
          <div className="rpv-fields">
            <label>Цель <b>100 000 просмотров</b></label>
            <label>Бюджет <b>30 000 ₽</b></label>
          </div>
          <div className="rpv-platforms"><span>Shorts</span><span>TikTok</span><span>Reels</span><span>VK</span></div>
          <button>Опубликовать заказ <ArrowRight size={14} /></button>
        </div>
        <div className="rpv-benefits">
          <span><ShieldCheck size={18} /><b>Бюджет защищён</b><small>до результата</small></span>
          <span><Eye size={18} /><b>Всё прозрачно</b><small>ролики и просмотры</small></span>
        </div>
      </div>
    );
  }

  if (scene === 3) {
    return (
      <div className="rpv rpv-market">
        <div className="rpv-market-list">
          <div><span>Подкасты</span><b>3 ролика из интервью</b><em>до 6 800 ₽</em></div>
          <div className="is-active"><span>Стримы</span><b>Лучшие моменты стрима</b><em>до 9 500 ₽</em></div>
          <div><span>Игры</span><b>Динамичная нарезка</b><em>до 7 200 ₽</em></div>
        </div>
        <div className="rpv-task">
          <BadgeCheck size={18} />
          <small>Заказ выбран</small>
          <b>Лучшие моменты стрима</b>
          <ul><li>Вертикальный формат 9:16</li><li>Крупные субтитры</li><li>Срок 4 дня</li></ul>
          <span>Ожидаемая оплата <strong>9 500 ₽</strong></span>
        </div>
      </div>
    );
  }

  if (scene === 4) {
    return (
      <div className="rpv rpv-publish">
        <div className="rpv-editor">
          <div className="rpv-preview"><Play size={24} fill="currentColor" /><span>9:16</span></div>
          <div className="rpv-timeline"><i /><i /><i /><i /><i /></div>
          <b>Сильный первый кадр</b>
          <small>Субтитры · динамика · до 60 сек.</small>
        </div>
        <div className="rpv-upload-flow">
          <div className="rpv-network"><span>YT</span><span>TT</span><span>IG</span><span>VK</span></div>
          <ArrowRight size={24} />
          <div className="rpv-url"><Upload size={18} /><span>Ссылка на ролик</span><Check size={16} /></div>
        </div>
      </div>
    );
  }

  if (scene === 5) {
    return (
      <div className="rpv rpv-check">
        <div className="rpv-scan-ring"><ShieldCheck size={46} /><span /></div>
        <div className="rpv-checks">
          <div><Check size={15} /><span>Tracking-код найден</span><b>Готово</b></div>
          <div><Check size={15} /><span>Публикация подтверждена</span><b>Готово</b></div>
          <div><Check size={15} /><span>Просмотры получены через API</span><b>Live</b></div>
          <div><Clock3 size={15} /><span>Финальная проверка</span><b>48 ч.</b></div>
        </div>
      </div>
    );
  }

  if (scene === 6) {
    return (
      <div className="rpv rpv-result">
        <div className="rpv-result-card is-client">
          <UserRound size={19} />
          <small>Заказчик получил</small>
          <b>100 000</b>
          <span><Eye size={14} /> просмотров</span>
        </div>
        <div className="rpv-result-flow">
          <Film size={17} /><i /><BarChart3 size={17} /><i /><ShieldCheck size={17} /><i /><Banknote size={17} />
        </div>
        <div className="rpv-result-card is-worker">
          <Scissors size={19} />
          <small>Исполнитель получил</small>
          <b>8 500 ₽</b>
          <span><BadgeCheck size={14} /> подтверждено</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rpv rpv-final">
      <div className="rpv-final-mark"><Sparkles size={24} /><b>ReelPay</b></div>
      <div className="rpv-final-actions">
        <a href="/campaigns/new"><BriefcaseBusiness size={17} /> Создать заказ</a>
        <a href="/campaigns"><Scissors size={17} /> Найти заказ</a>
      </div>
      <span><ShieldCheck size={15} /> Оплата после подтверждения результата</span>
    </div>
  );
}

export function CampaignGuide() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playbackRun, setPlaybackRun] = useState(0);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!playing) return;
    const duration = scenes[active].duration;
    const startedAt = performance.now() - progress * duration;
    let frame = 0;

    const tick = (now: number) => {
      const next = Math.min(1, (now - startedAt) / duration);
      setProgress(next);
      if (next >= 1) {
        if (active < scenes.length - 1) {
          setActive((value) => value + 1);
          setProgress(0);
        } else {
          setPlaying(false);
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, playing, playbackRun]);

  function setGuideCollapsed(next: boolean) {
    setCollapsed(next);
    setPlaying(false);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  function startGuide() {
    if (active === scenes.length - 1 && progress >= 1) {
      setActive(0);
      setProgress(0);
    }
    setStarted(true);
    setPlaying(true);
  }

  function goTo(index: number) {
    setStarted(true);
    setActive(index);
    setProgress(0);
    setPlaying(true);
    setPlaybackRun((value) => value + 1);
  }

  function togglePlayback() {
    if (!started) return startGuide();
    if (active === scenes.length - 1 && progress >= 1) {
      setActive(0);
      setProgress(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  }

  async function enterFullscreen() {
    await frameRef.current?.requestFullscreen?.();
  }

  if (collapsed) {
    return (
      <button className="campaign-guide-collapsed" type="button" onClick={() => setGuideCollapsed(false)}>
        <span><Play size={16} fill="currentColor" /> Как работает ReelPay · 54 сек.</span>
        <ChevronDown size={18} />
      </button>
    );
  }

  const current = scenes[active];

  return (
    <section className="campaign-guide campaign-guide-v2" aria-label="Как работает ReelPay">
      <button
        className="campaign-guide-close"
        type="button"
        onClick={() => setGuideCollapsed(true)}
        aria-label="Свернуть инструкцию"
      >
        <X size={18} />
      </button>

      <div className="campaign-guide-copy">
        <span><CircleDollarSign size={15} /> ReelPay за 54 секунды</span>
        <h2>Как контент превращается в охват и доход</h2>
        <p>Полный путь заказчика и исполнителя — от исходного видео до проверенной выплаты.</p>
        <div className="campaign-guide-audience">
          <span><BriefcaseBusiness size={16} /><b>Заказчику</b> ролики и охват</span>
          <span><Scissors size={16} /><b>Исполнителю</b> заказы и оплата</span>
        </div>
      </div>

      <div className="campaign-promo" ref={frameRef}>
        <div className="campaign-promo-stage" data-scene={active}>
          <header>
            <div className="campaign-promo-brand"><Sparkles size={16} /><b>ReelPay</b></div>
            <span>{String(active + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}</span>
          </header>

          <div className="campaign-promo-visual" key={active}>
            <PromoVisual scene={active} />
          </div>

          <div className="campaign-promo-caption" aria-live="polite">
            <span>{current.kicker}</span>
            <h3>{current.title}</h3>
            <p>{current.text}</p>
          </div>

          {!started ? (
            <button className="campaign-promo-start" type="button" onClick={startGuide}>
              <span><Play size={22} fill="currentColor" /></span>
              <b>Смотреть, как работает ReelPay</b>
              <small>Заказчик + исполнитель · 54 сек.</small>
            </button>
          ) : null}
        </div>

        <div className="campaign-promo-controls">
          <button type="button" onClick={togglePlayback} aria-label={playing ? "Пауза" : "Продолжить"}>
            {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
          <div className="campaign-promo-chapters" aria-label="Разделы ролика">
            {scenes.map((scene, index) => (
              <button
                type="button"
                key={scene.label}
                className={index === active ? "is-active" : index < active ? "is-done" : ""}
                onClick={() => goTo(index)}
                aria-label={`Перейти: ${scene.label}`}
              >
                <i style={{ width: index === active ? `${Math.max(2, progress * 100)}%` : undefined }} />
                <span>{scene.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={enterFullscreen} aria-label="На весь экран">
            <Maximize2 size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
