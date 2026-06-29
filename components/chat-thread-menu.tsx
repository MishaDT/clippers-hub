"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, MoreVertical, Trash2 } from "lucide-react";
import { archiveThreadAction, clearThreadAction } from "@/app/actions";

const MENU_WIDTH = 190;
const MENU_HEIGHT = 94;
const EDGE_GAP = 8;

export function ChatThreadMenu({ threadId, archived }: { threadId: string; archived: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;

    function placeMenu() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const left = Math.min(
        window.innerWidth - MENU_WIDTH - EDGE_GAP,
        Math.max(EDGE_GAP, rect.right - MENU_WIDTH)
      );
      const top = rect.bottom + MENU_HEIGHT + EDGE_GAP <= window.innerHeight
        ? rect.bottom + 6
        : Math.max(EDGE_GAP, rect.top - MENU_HEIGHT - 6);

      setPosition({ left, top, width: MENU_WIDTH });
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    placeMenu();
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);

  return (
    <div className={`thread-menu ${open ? "is-open" : ""}`} onPointerDown={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        className="thread-menu-trigger"
        type="button"
        aria-label="Действия с чатом"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={18} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div ref={menuRef} className="thread-menu-popover" style={position} role="menu">
              <form action={archiveThreadAction}>
                <input type="hidden" name="threadId" value={threadId} />
                <input type="hidden" name="archive" value={archived ? "0" : "1"} />
                <button type="submit" role="menuitem">
                  {archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
                  <span>{archived ? "Вернуть из архива" : "В архив"}</span>
                </button>
              </form>

              <form
                action={clearThreadAction}
                onSubmit={(event) => {
                  if (!window.confirm("Удалить чат у себя? История скроется, пока не придёт новое сообщение.")) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="threadId" value={threadId} />
                <button type="submit" className="danger" role="menuitem">
                  <Trash2 size={17} />
                  <span>Удалить у себя</span>
                </button>
              </form>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
