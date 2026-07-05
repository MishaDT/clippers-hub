import { AppShell } from "@/components/ui";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell publicOnly>
      <article className="legal">{children}</article>
    </AppShell>
  );
}
