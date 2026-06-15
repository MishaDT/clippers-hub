"use client";

import { useState } from "react";
import { Download, FileVideo, Scissors, ShieldCheck, Sparkles, Smartphone, Subtitles } from "lucide-react";
import { parseJson } from "@/lib/json";

type Props = {
  description: string;
  platformsJson: string;
  rulesJson: string;
  sourcePlatform: string;
  sourceUrl: string;
};

const tabs = ["Описание", "Что сделать", "Исходники", "Критерии"] as const;

export function CampaignTabs({ description, platformsJson, rulesJson, sourcePlatform, sourceUrl }: Props) {
  const [active, setActive] = useState<(typeof tabs)[number]>("Описание");
  const platforms = parseJson<string[]>(platformsJson, []);
  const rules = parseJson<{ requiredTags?: string[]; bans?: string[]; watermarkBonus?: boolean }>(rulesJson, {});

  return (
    <>
      <div className="fake-tabs" role="tablist">
        {tabs.map((tab) => (
          <button className={active === tab ? "active" : ""} type="button" onClick={() => setActive(tab)} key={tab}>{tab}</button>
        ))}
      </div>

      {active === "Описание" ? (
        <div className="tab-panel">
          <p>{description}</p>
          <p className="muted">Оплата начисляется после проверки ссылки, просмотров и базового антифрода. Клип можно выложить в TikTok, Shorts, Reels или VK Clips.</p>
        </div>
      ) : null}

      {active === "Что сделать" ? (
        <div className="check-list">
          <div><Scissors /> <span>Выбрать 3-5 самых сильных моментов</span><b>✓</b></div>
          <div><Smartphone /> <span>Сделать вертикальный формат 9:16</span><b>✓</b></div>
          <div><Subtitles /> <span>Добавить крупные субтитры и быстрый первый кадр</span><b>✓</b></div>
          <div><Sparkles /> <span>Собрать заголовок и хештеги под площадку</span><b>✓</b></div>
        </div>
      ) : null}

      {active === "Исходники" ? (
        <div className="source-file">
          <FileVideo />
          <div>
            <strong>{sourcePlatform}-source.mp4</strong>
            <span>{platforms.join(" · ")} · {rules.requiredTags?.join(", ")}</span>
          </div>
          <a href={sourceUrl || "/assets/gaming-order.png"} target="_blank" rel="noreferrer" aria-label="Открыть исходник"><Download size={18} /></a>
        </div>
      ) : null}

      {active === "Критерии" ? (
        <div className="check-list">
          <div><ShieldCheck /> <span>Ссылка публичная и содержит tracking-code</span><b>✓</b></div>
          <div><ShieldCheck /> <span>Нет запрещённых тем: {rules.bans?.slice(0, 3).join(", ") || "NSFW, политика, оскорбления"}</span><b>✓</b></div>
          <div><ShieldCheck /> <span>Просмотры проходят 48-часовую проверку перед выплатой</span><b>✓</b></div>
        </div>
      ) : null}
    </>
  );
}
