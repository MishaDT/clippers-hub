"use client";

import { PointerEvent, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Archive } from "lucide-react";
import { archiveThreadAction } from "@/app/actions";
import { ChatThreadMenu } from "@/components/chat-thread-menu";

export function SwipeChatRow({
  threadId,
  href,
  avatar,
  name,
  time,
  context,
  preview,
  unread,
  kind,
  current,
  archived
}: {
  threadId: string;
  href: string;
  avatar: string;
  name: string;
  time: string;
  context: string;
  preview: string;
  unread: number;
  kind: "CAMPAIGN" | "COLLAB";
  current: boolean;
  archived: boolean;
}) {
  const startX = useRef(0);
  const dragging = useRef(false);
  const [offset, setOffset] = useState(0);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    startX.current = event.clientX;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    setOffset(Math.max(-92, Math.min(0, event.clientX - startX.current)));
  }
  function finish() {
    if (!dragging.current) return;
    dragging.current = false;
    setOffset((value) => value < -48 ? -82 : 0);
  }

  return (
    <div className="chat-swipe-shell">
      <form className="chat-swipe-archive" action={archiveThreadAction}>
        <input type="hidden" name="threadId" value={threadId} />
        <input type="hidden" name="archive" value={archived ? "0" : "1"} />
        <button type="submit"><Archive size={20} /><span>{archived ? "Вернуть" : "В архив"}</span></button>
      </form>
      <div
        className={`chat-thread-row ${current ? "active" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <Link className="thread-rowlink" href={href} aria-label={`Открыть чат с ${name}`} prefetch />
        <Image className="thread-avatar" src={avatar} alt="" width={44} height={44} loading="lazy" unoptimized />
        <span className="thread-main">
          <span className="thread-name-line"><b>{name}</b><time>{time}</time></span>
          <em>{kind === "COLLAB" ? <i>Коллаб</i> : null}{context}</em>
          <small>{preview}</small>
        </span>
        {unread ? <span className="thread-unread">{unread > 99 ? "99+" : unread}</span> : null}
        <ChatThreadMenu threadId={threadId} archived={archived} />
      </div>
    </div>
  );
}
