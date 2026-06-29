"use client";

import { Archive, ArchiveRestore, MoreVertical, Trash2 } from "lucide-react";
import { archiveThreadAction, clearThreadAction } from "@/app/actions";

export function ChatThreadMenu({ threadId, archived }: { threadId: string; archived: boolean }) {
  return (
    <details className="thread-menu">
      <summary aria-label="Действия с чатом"><MoreVertical size={18} /></summary>
      <div>
      <form action={archiveThreadAction}>
        <input type="hidden" name="threadId" value={threadId} />
        <input type="hidden" name="archive" value={archived ? "0" : "1"} />
        <button
          type="submit"
          aria-label={archived ? "Вернуть из архива" : "В архив"}
          title={archived ? "Вернуть из архива" : "В архив"}
        >
          {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
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
        <button type="submit" className="danger" aria-label="Удалить у себя" title="Удалить у себя">
          <Trash2 size={16} />
          <span>Удалить у себя</span>
        </button>
      </form>
      </div>
    </details>
  );
}
