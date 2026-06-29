"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";

export function PampaduWidget({ url, qrDataUrl }: { url: string; qrDataUrl: string }) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [reloadKey, url]);

  return (
    <section className="pampadu-panel">
      <Script src="https://ppdu.ru/ppdw.js" strategy="afterInteractive" />
      <header>
        <div>
          <span>Партнёрская витрина</span>
          <h2>Финансовые предложения Pampadu</h2>
          <p>Оформление проходит на стороне партнёра. ReelPay не получает ваши банковские данные.</p>
        </div>
        <div className="pampadu-qr">
          <img src={qrDataUrl} alt="QR-код витрины Pampadu" width={92} height={92} />
          <small>Открыть на телефоне</small>
        </div>
      </header>
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
      {slow ? (
        <div className="pampadu-fallback" role="status">
          <span>Витрина загружается дольше обычного.</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw size={15} /> Повторить</button>
          <a href={url} target="_blank" rel="noopener noreferrer sponsored nofollow">Открыть напрямую <ExternalLink size={15} /></a>
        </div>
      ) : (
        <a className="pampadu-direct" href={url} target="_blank" rel="noopener noreferrer sponsored nofollow">
          Открыть витрину отдельно <ExternalLink size={14} />
        </a>
      )}
    </section>
  );
}
