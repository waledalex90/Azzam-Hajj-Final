import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import uxInteractions from "./ux-interactions.module.css";
import { IosInstallHint } from "@/components/pwa/ios-install-hint";
import { PwaReloadOnUpdate } from "@/components/pwa/pwa-reload-on-update";
import { PRODUCT_NAME, PRODUCT_TAGLINE_AR } from "@/lib/product";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_TAGLINE_AR,
  applicationName: PRODUCT_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: PRODUCT_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/app-icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/pwa-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/pwa-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/pwa-192.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1730",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} h-full antialiased`}>
      <body className={`${uxInteractions.root} flex min-h-full flex-col bg-background text-foreground`}>
        {children}
        <PwaReloadOnUpdate />
        <IosInstallHint />
      </body>
    </html>
  );
}
