import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";

// New-clipper onboarding checklist. Shown until the first verified result: small user
// investment (profile) + a clear next action beat generic dashboards for early retention.
export function FirstSteps({ profileDone, orderTaken }: { profileDone: boolean; orderTaken: boolean }) {
  const steps = [
    {
      done: profileDone,
      title: "Заполни профиль",
      hint: "Тематики и пара слов о себе — заказы начнут подбираться под тебя",
      href: "/settings/profile"
    },
    {
      done: orderTaken,
      title: "Возьми первый заказ",
      hint: "Выбери задание ниже — выплата резервируется сразу",
      href: "#"
    },
    {
      done: false,
      title: "Сдай первый клип",
      hint: "Смонтируй, опубликуй и отправь ссылку — проверка обычно до 24 часов",
      href: "/upload"
    }
  ];
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <aside className="fs-card" aria-label="Первые шаги">
      <div className="fs-head">
        <b>Первые шаги · {doneCount} из 3</b>
        <span className="fs-bar" aria-hidden="true"><i style={{ width: `${Math.max(8, (doneCount / 3) * 100)}%` }} /></span>
      </div>
      <ol className="fs-steps">
        {steps.map((step) => (
          <li key={step.title} data-done={step.done}>
            <span className="fs-mark">{step.done ? <Check size={13} /> : null}</span>
            <div>
              <b>{step.title}</b>
              <small>{step.hint}</small>
            </div>
            {!step.done && step.href !== "#" ? (
              <Link className="fs-go" href={step.href} aria-label={step.title}><ChevronRight size={16} /></Link>
            ) : null}
          </li>
        ))}
      </ol>
    </aside>
  );
}
