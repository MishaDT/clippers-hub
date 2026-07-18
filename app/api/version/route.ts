import { NextResponse } from "next/server";
import { resolveDeploymentVersion } from "@/lib/deployment-version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: resolveDeploymentVersion() },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
  );
}
