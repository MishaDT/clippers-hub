"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { markChatThreadReadAction } from "@/app/support/actions";

export function ReadStateTracker() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadId = pathname === "/chats" ? searchParams.get("thread") : null;

  useEffect(() => {
    if (!threadId) return;
    let active = true;
    void markChatThreadReadAction(threadId).then(() => {
      if (active) router.refresh();
    });
    return () => { active = false; };
  }, [router, threadId]);

  return null;
}
