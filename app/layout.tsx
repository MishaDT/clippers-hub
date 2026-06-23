import type { Metadata, Viewport } from "next";
import { Unbounded } from "next/font/google";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  display: "swap"
});

const description = "Заказчики публикуют задачи, клипперы делают рилсы из стримов, подкастов и видео. Оплата за результат.";

export const metadata: Metadata = {
  metadataBase: new URL("https://clippers-hub-mdt.netlify.app"),
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
    images: [{ url: "/assets/hero-studio.png", width: 1200, height: 630, alt: "ReelPay" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "ReelPay — биржа коротких видео",
    description,
    images: ["/assets/hero-studio.png"]
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
    <html lang="ru" className={display.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
