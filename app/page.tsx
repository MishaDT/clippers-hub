import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { LandingExperience } from "@/components/landing-experience";
import { LandingStats } from "@/components/landing-stats";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/campaigns");

  return (
    <AppShell>
      <LandingExperience proof={<LandingStats />} />
    </AppShell>
  );
}
