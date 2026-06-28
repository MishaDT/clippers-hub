"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Flag, X } from "lucide-react";
import { reportContentAction } from "@/app/actions";
import { REPORT_REASONS, isSafeRussianReport } from "@/lib/report-reasons";

export function ReportDialog({
  contentType,
  entityId,
  authorId,
  returnTo,
  label = "Пожаловаться"
}: {
  contentType: string;
  entityId: string;
  authorId?: string;
  returnTo: string;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState("SPAM");
  const [details, setDetails] = useState("");
  const words = details.trim() ? details.trim().split(/\s+/).length : 0;
  const customValid = category !== "OTHER" || isSafeRussianReport(details);

  useEffect(() => {
    const dialog = dialogRef.current;
    const close = () => dialog?.close();
    dialog?.addEventListener("cancel", close);
    return () => dialog?.removeEventListener("cancel", close);
  }, []);

  return (
    <>
      <button className="btn btn-ghost btn-small report-trigger" type="button" onClick={() => dialogRef.current?.showModal()}>
        <Flag size={15} /> {label}
      </button>
      <dialog className="report-dialog" ref={dialogRef}>
        <form action={reportContentAction}>
          <input type="hidden" name="contentType" value={contentType} />
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="authorId" value={authorId || ""} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <header>
            <span><AlertTriangle size={18} /> Жалоба</span>
            <button type="button" aria-label="Закрыть" onClick={() => dialogRef.current?.close()}><X size={18} /></button>
          </header>
          <p>Что случилось? Автор жалобы не раскрывается пользователю.</p>
          <div className="report-reasons">
            {REPORT_REASONS.map((reason) => (
              <label key={reason.value}>
                <input type="radio" name="category" value={reason.value} checked={category === reason.value} onChange={() => setCategory(reason.value)} />
                <span>{reason.label}</span>
              </label>
            ))}
          </div>
          {category === "OTHER" ? (
            <label className="report-details">
              <span>Опишите по-русски, без ссылок</span>
              <textarea name="details" value={details} onChange={(event) => setDetails(event.target.value.slice(0, 220))} maxLength={220} rows={4} required />
              <small className={customValid ? "" : "error"}>{details.length}/220 · {words}/35 слов</small>
            </label>
          ) : <input type="hidden" name="details" value="" />}
          <footer>
            <button className="btn" type="button" onClick={() => dialogRef.current?.close()}>Отмена</button>
            <button className="btn btn-danger" type="submit" disabled={!customValid}>Отправить жалобу</button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
