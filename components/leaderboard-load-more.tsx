"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, ChevronDown, Handshake, Play } from "lucide-react";
import { sendCollabInviteAction } from "@/app/actions";
import { LeagueBadge } from "@/components/league-badge";
import { compactNumber } from "@/lib/money";

type Row = { rank: number; id: string; name: string; handle: string; avatar: string; verified: boolean; lifetimeViews: number; views: number; clips: number; cover: string };

export function LeaderboardLoadMore({ rows, clientMode, currentUserId }: { rows: Row[]; clientMode: boolean; currentUserId?: string }) {
  const [limit, setLimit] = useState(7);
  const visible = rows.slice(0, limit);
  return (
    <>
      <ol className="leaderboard-table">
        {visible.map((row) => (
          <li className="leaderboard-row" key={row.id}>
            <span className="lr-rank">{row.rank}</span>
            <div className="lr-ava-wrap"><img src={row.avatar} alt="" loading="lazy" /></div>
            <div className="lr-id"><strong>{row.id === currentUserId ? "Я" : row.name}</strong>{row.verified ? <BadgeCheck size={14} className="verified" /> : null}<LeagueBadge views={row.lifetimeViews} size="sm" /></div>
            <div className="lr-views"><b>{compactNumber(row.views)}</b><em>просмотров</em></div>
            <div className="lr-clips"><b>{row.clips}</b><em>клипов</em></div>
            <Link className="lr-clip" href={`/clippers/${row.handle}`} aria-label="Открыть профиль"><img src={row.cover} alt="" loading="lazy" /><span className="lr-clip-play"><Play size={12} fill="#fff" /></span></Link>
            {clientMode && row.id !== currentUserId ? (
              <form className="invite-btn-form" action={sendCollabInviteAction}>
                <input type="hidden" name="workerId" value={row.id} /><input type="hidden" name="handle" value={row.handle} />
                <input type="hidden" name="message" value="Привет! Хочу позвать тебя на совместный клип в ReelPay. Обсудим?" />
                <button className="invite-btn" type="submit"><Handshake size={14} /><span className="invite-full">Пригласить</span><span className="invite-short">Звать</span></button>
              </form>
            ) : <Link className="invite-btn" href={`/clippers/${row.handle}`}>{row.id === currentUserId ? <><span className="invite-full">Мой профиль</span><span className="invite-short">Я</span></> : <><Handshake size={14} /><span className="invite-full">Открыть профиль</span><span className="invite-short">Открыть</span></>}</Link>}
          </li>
        ))}
      </ol>
      {limit < rows.length ? <button className="lb-more" type="button" onClick={() => setLimit((value) => value + 10)}>Показать ещё 10 <ChevronDown size={16} /></button> : null}
    </>
  );
}
