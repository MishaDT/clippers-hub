import type { CSSProperties } from "react";
import { clientTier, leagueForViews } from "@/lib/leagues";

export function LeagueBadge({ views, size = "md" }: { views: number; size?: "sm" | "md" }) {
  const league = leagueForViews(views);
  return (
    <span
      className={`league-badge league-${league.key} league-${size}`}
      style={{ "--lg": league.color, "--lg-glow": league.glow } as CSSProperties}
      title={`Лига: ${league.name}`}
    >
      <span aria-hidden="true">{league.emoji}</span> {league.name}
    </span>
  );
}

export function ClientTierBadge({ orders, size = "md" }: { orders: number; size?: "sm" | "md" }) {
  const tier = clientTier(orders);
  return (
    <span className={`client-tier client-tier-${tier.key} league-${size}`} title={`Заказчик: ${tier.name}`}>
      <span aria-hidden="true">{tier.emoji}</span> {tier.name}
    </span>
  );
}
