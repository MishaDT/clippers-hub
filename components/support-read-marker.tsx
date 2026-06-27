"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markAdminSupportReadAction, markSupportReadAction } from "@/app/support/actions";

export function SupportReadMarker({ threadId, admin = false }: { threadId: string; admin?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const action = admin ? markAdminSupportReadAction(threadId) : markSupportReadAction(threadId);
    void action.then(() => {
      if (active) router.refresh();
    });
    return () => { active = false; };
  }, [admin, router, threadId]);
  return null;
}
