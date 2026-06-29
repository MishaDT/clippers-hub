"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

export function ProfileDisclosure({ storageKey, title, summary, defaultOpen = false, children }: { storageKey: string; title: string; summary?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const saved = localStorage.getItem(`profile-section:${storageKey}`);
    if (saved !== null) setOpen(saved === "1");
  }, [storageKey]);
  function toggle() {
    setOpen((value) => {
      localStorage.setItem(`profile-section:${storageKey}`, value ? "0" : "1");
      return !value;
    });
  }
  return (
    <section className="profile-disclosure" data-open={open}>
      <button type="button" onClick={toggle} aria-expanded={open}>
        <span><b>{title}</b>{summary ? <small>{summary}</small> : null}</span><ChevronDown size={19} />
      </button>
      {open ? <div className="profile-disclosure-content">{children}</div> : null}
    </section>
  );
}
