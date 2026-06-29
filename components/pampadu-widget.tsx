"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { ExternalLink, LoaderCircle, MonitorDown, RefreshCw, ShieldCheck, X } from "lucide-react";

export function PampaduWidget({ url, qrDataUrl }: { url: string; qrDataUrl: string }) {
  const [showFrame, setShowFrame] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!showFrame) return;
    setLoaded(false);
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 9000);
    return () => window.clearTimeout(timer);
  }, [reloadKey, showFrame, url]);

  return (
    <section className="pampadu-panel">
      <header className="pampadu-intro">
        <div className="pampadu-copy">
          <span>Партнёрская витрина</span>
          <h2>Финансовые предложения Pampadu</h2>
          <p>Оформление проходит на защищённой стороне партнёра. ReelPay не получает банковские данные.</p>
          <div className="pampadu-actions">
            <a className="pampadu-primary" href={url} target="_blank" rel="noopener noreferrer sponsored nofollow">
              Открыть предложения <ExternalLink size={16} />
            </a>
            <button className="pampadu-secondary" type="button" onClick={() => setShowFrame(true)}>
              <MonitorDown size={16} /> Показать внутри ReelPay
            </button>
          </div>
          <small className="pampadu-network-note"><ShieldCheck size={14} /> Для корректного учёта заявки партнёр рекомендует переход без VPN и прокси.</small>
        </div>
        <a className="pampadu-qr" href={url} target="_blank" rel="noopener noreferrer sponsored nofollow" aria-label="Открыть витрину Pampadu">
          <img src={qrDataUrl} alt="QR-код витрины Pampadu" width={112} height={112} />
          <small>Открыть на телефоне</small>
        </a>
      </header>

      {showFrame ? (
        <div className="pampadu-embed">
          <Script src="https://ppdu.ru/ppdw.js" strategy="afterInteractive" />
          <div className="pampadu-embed-head">
            <span>Встроенная витрина</span>
            <button type="button" onClick={() => setShowFrame(false)} aria-label="Закрыть встроенную витрину"><X size={17} /></button>
          </div>
          <div className="pampadu-frame-wrap">
            {!loaded ? <span className="pampadu-loading"><LoaderCircle className="spin" size={20} /> Загружаем витрину…</span> : null}
            <iframe
              key={reloadKey}
              src={url}
              id="ppdwiOffer"
              title="Витрина предложений Pampadu"
              scrolling="no"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => { setLoaded(true); setSlow(false); }}
            />
          </div>
          <div className="pampadu-embed-help" role="status">
            <span>{slow ? "Витрина загружается дольше обычного." : "Если партнёр показывает блокировку внутри окна, откройте витрину отдельно."}</span>
            {slow ? <button type="button" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw size={15} /> Повторить</button> : null}
            <a href={url} target="_blank" rel="noopener noreferrer sponsored nofollow">Открыть отдельно <ExternalLink size={15} /></a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
