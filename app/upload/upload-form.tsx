"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Heart, Link2, Play, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { submitClipAction } from "@/app/actions";
import { compactNumber } from "@/lib/money";

type UploadSubmission = {
  id: string;
  title: string;
  trackingCode: string;
  currentViews: number;
};

export function UploadForm({ submissions }: { submissions: UploadSubmission[] }) {
  const [selectedId, setSelectedId] = useState(submissions[0]?.id || "");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const selected = useMemo(() => submissions.find((item) => item.id === selectedId) || submissions[0], [selectedId, submissions]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <form className="upload-layout" action={submitClipAction}>
      <aside className="upload-steps">
        {[
          ["1", "Загрузите готовый вертикальный ролик", "Формат 9:16, до 60 сек."],
          ["2", "Вставьте публичную ссылку", "TikTok, Shorts, Reels или VK Clips"],
          ["3", "Подтвердите кампанию", "Проверьте tracking-code"],
          ["4", "Отправьте на проверку", "Мы начнем трекинг просмотров"]
        ].map(([num, title, text]) => (
          <div className="upload-step" key={num}>
            <b>{num}</b>
            <strong>{title}</strong>
            <span>{text}</span>
          </div>
        ))}
      </aside>

      <div className="upload-panels">
        <label className="upload-preview upload-preview-live" style={previewUrl ? undefined : { backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.03), rgba(0,0,0,.45)), url(/assets/gaming-order.png)" }}>
          {previewUrl ? <video src={previewUrl} controls playsInline /> : <span className="upload-play"><Play size={28} fill="white" /></span>}
          <input
            className="sr-only"
            type="file"
            name="videoFile"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(URL.createObjectURL(file));
              setFileName(file.name);
            }}
          />
          <span>{fileName || "00:45"}</span>
          <em><UploadCloud size={16} /> {previewUrl ? "Заменить видео" : "Выбрать видео"}</em>
        </label>

        <section className="card upload-card">
          <label className="field-title">Ссылка на опубликованный ролик</label>
          <div className="inline-input">
            <Link2 size={18} />
            <input name="postUrl" type="url" defaultValue="https://www.instagram.com/reel/demo" required />
            <CheckCircle2 size={18} color="#22c55e" />
          </div>
          <p className="small">После отправки ссылка попадет в трекинг просмотров.</p>
        </section>

        <section className="card upload-card campaign-select-card">
          <select name="submissionId" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {submissions.map((submission) => (
              <option value={submission.id} key={submission.id}>{submission.title}</option>
            ))}
          </select>
          <span><span className="tag good">Выбрана</span> ID кампании: {selected?.trackingCode}</span>
        </section>

        <section className="card upload-card stats-card">
          <div className="field-title"><span>Статистика ролика</span><small>обновлено 2 мин назад</small></div>
          <input type="hidden" name="platform" value="INSTAGRAM" />
          <div className="upload-stats">
            <div><Eye color="#38bdf8" /><strong>{compactNumber(Math.max(selected?.currentViews || 0, 10000))}</strong><span>Просмотры</span></div>
            <div><Heart color="#f43f8f" /><strong>1,2K</strong><span>Лайки</span></div>
            <div><ShieldCheck color="#f59e0b" /><strong>Ожидает</strong><span>Статус проверки</span></div>
          </div>
          <p className="safe-note"><ShieldCheck size={18} /> Выплата произойдет после выполнения условий кампании и успешной проверки.</p>
        </section>

        <button className="btn btn-primary btn-publish" type="submit"><Send size={22} /> Отправить</button>
        <p className="small centered">Нажимая “Отправить”, вы подтверждаете, что работа выполнена по условиям кампании.</p>
      </div>
    </form>
  );
}
