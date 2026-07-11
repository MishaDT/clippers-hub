import { AppShell } from "@/components/ui";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <article className="legal">{children}</article>
    </AppShell>
  );
}
