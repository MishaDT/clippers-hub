import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Suspense } from "react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { CookieConsent } from "@/components/cookie-consent";
import { DeploymentRefresh } from "@/components/deployment-refresh";
import { resolveDeploymentVersion } from "@/lib/deployment-version";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://clippers-hub-mdt.netlify.app");

const description = "Заказчики публикуют задачи, клипперы делают рилсы из стримов, подкастов и видео. Оплата за результат.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "ReelPay — биржа коротких видео", template: "%s · ReelPay" },
  description,
  applicationName: "ReelPay",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "ReelPay",
    title: "ReelPay — биржа коротких видео",
    description,
    images: [{ url: "/assets/hero-studio.webp", width: 1200, height: 675, alt: "ReelPay" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "ReelPay — биржа коротких видео",
    description,
    images: ["/assets/hero-studio.webp"]
  }
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body>
        <DeploymentRefresh version={resolveDeploymentVersion()} />
        {children}
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
        <CookieConsent />
      </body>
    </html>
  );
}
