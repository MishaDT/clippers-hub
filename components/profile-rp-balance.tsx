"use client";

import { useEffect, useState } from "react";

export function ProfileRpBalance({ initial }: { initial: number }) {
  const [balance, setBalance] = useState(initial);
  useEffect(() => {
    const update = (event: Event) => setBalance((event as CustomEvent<number>).detail);
    window.addEventListener("rp-balance", update);
    return () => window.removeEventListener("rp-balance", update);
  }, []);
  return <b>{balance.toLocaleString("ru-RU")} RP</b>;
}
