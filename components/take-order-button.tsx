"use client";

import { useState } from "react";
import { Clock3, ShieldCheck, WalletCards, X } from "lucide-react";
import { joinCampaignAction } from "@/app/actions";
import styles from "./take-order-button.module.css";

export function TakeOrderButton({
  campaignId,
  payout,
  deadline,
  disabled
}: {
  campaignId: string;
  payout: string;
  deadline: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary od-apply-btn" type="button" disabled={disabled} onClick={() => setOpen(true)}>
        Взять заказ
      </button>
      {open ? (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="take-order-title">
            <header>
              <div><span>Подтверждение</span><h2 id="take-order-title">Взять заказ?</h2></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            </header>
            <div className={styles.facts}>
              <span><WalletCards size={18} /><div><small>Чистая выплата</small><b>{payout}</b></div></span>
              <span><Clock3 size={18} /><div><small>Дедлайн</small><b>{deadline}</b></div></span>
            </div>
            <p><ShieldCheck size={16} /> После подтверждения сумма закрепится за вами. Опубликуйте ролик по брифу и отправьте ссылку до дедлайна.</p>
            <form action={joinCampaignAction}>
              <input type="hidden" name="campaignId" value={campaignId} />
              <button className="btn btn-primary" type="submit">Подтвердить и взять заказ</button>
              <button className="btn" type="button" onClick={() => setOpen(false)}>Отмена</button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
