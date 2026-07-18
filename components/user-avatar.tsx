import type { CSSProperties } from "react";
import Image from "next/image";
import styles from "./user-avatar.module.css";

type UserAvatarProps = {
  avatar?: string | null;
  name: string;
  handle?: string;
  size?: number;
  className?: string;
};

function safeAvatarSource(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("data:image/webp;base64,")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function initials(name: string, handle = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const value = parts.length
    ? parts.slice(0, 2).map((part) => part[0]).join("")
    : handle.slice(0, 2);
  return value.toUpperCase() || "RP";
}

function toneFor(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 6;
}

export function UserAvatar({ avatar, name, handle = "", size = 40, className = "" }: UserAvatarProps) {
  const source = safeAvatarSource(avatar);
  const style = {
    "--avatar-size": `${size}px`,
    "--avatar-font": `${Math.max(10, Math.round(size * .3))}px`
  } as CSSProperties;

  return (
    <span
      className={`${styles.avatar} ${styles[`tone${toneFor(handle || name)}`]} ${className}`.trim()}
      style={style}
      role="img"
      aria-label={name}
    >
      {source ? <Image src={source} alt="" width={size} height={size} loading="lazy" unoptimized /> : initials(name, handle)}
    </span>
  );
}
