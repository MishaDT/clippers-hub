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

export const metadata: Metadata = {
  title: "Clippers Hub",
  description: "UGC CPV marketplace for creators and clippers"
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
