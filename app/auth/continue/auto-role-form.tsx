"use client";

import { useEffect, useRef } from "react";
import { setRoleModeAction } from "@/app/actions";

export function AutoRoleForm({ mode, returnTo }: { mode: "client" | "worker"; returnTo: string }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.requestSubmit(); }, []);
  return <form ref={ref} action={setRoleModeAction}><input type="hidden" name="mode" value={mode} /><input type="hidden" name="returnTo" value={returnTo} /><button className="btn btn-primary" type="submit">Продолжить</button></form>;
}
