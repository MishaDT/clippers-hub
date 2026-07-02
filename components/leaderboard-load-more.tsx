"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, ChevronDown, Handshake, Play } from "lucide-react";
import { LeagueBadge } from "@/components/league-badge";
import { compactNumber } from "@/lib/money";
import styles from "./leaderboard-load-more.module.css";

type Row = { rank: number; id: string; name: string; handle: string; avatar: string; verified: boolean; lifetimeViews: number; views: number; clips: number; cover: string; demo: boolean };

export function LeaderboardLoadMore({ rows, clientMode, currentUserId, returnTo }: { rows: Row[]; clientMode: boolean; currentUserId?: string; returnTo: string }) {
  const [limit, setLimit] = useState(7);
  const visible = rows.slice(0, limit);
  return (
    <>
      <ol className={styles.list}>
        {visible.map((row) => (
          <li className={styles.row} key={row.id}>
            <Link className={styles.overlay} href={`/clippers/${row.handle}?returnTo=${encodeURIComponent(returnTo)}`} aria-label={`Открыть профиль ${row.name}`} />
            <span className={styles.rank}>{row.rank}</span>
            <span className={styles.avatar}><img src={row.avatar} alt="" loading="lazy" /></span>
            <div className={styles.identity}><strong>{row.id === currentUserId ? "Я" : row.name}</strong>{row.verified ? <BadgeCheck size={14} className="verified" /> : null}{row.demo ? <span className={styles.demo}>Демо</span> : null}<LeagueBadge views={row.lifetimeViews} size="sm" /></div>
            <div className={`${styles.metric} ${styles.views}`}><b>{compactNumber(row.views)}</b><em>просмотров</em></div>
            <div className={`${styles.metric} ${styles.clips}`}><b>{row.clips}</b><em>клипов</em></div>
            <span className={styles.cover}><img src={row.cover} alt="" loading="lazy" /><span className="lr-clip-play"><Play size={12} fill="#fff" /></span></span>
            {clientMode && row.id !== currentUserId ? (
              <div className={styles.actions}>
                <Link
                  className="invite-btn"
                  href={`/clippers/${row.handle}?returnTo=${encodeURIComponent(returnTo)}#cp-invite`}
                >
                  <Handshake size={14} /><span className="invite-full">Пригласить</span><span className="invite-short">Звать</span>
                </Link>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {limit < rows.length ? <button className="lb-more" type="button" onClick={() => setLimit((value) => value + 10)}>Показать ещё 10 <ChevronDown size={16} /></button> : null}
    </>
  );
}
