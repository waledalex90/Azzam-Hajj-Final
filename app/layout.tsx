import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import uxInteractions from "./ux-interactions.module.css";
import { IosInstallHint } from "@/components/pwa/ios-install-hint";
import { PwaReloadOnUpdate } from "@/components/pwa/pwa-reload-on-update";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "نظام عزام للحج",
  description: "Azzam Hajj System - Progressive Web App",
  applicationName: "نظام عزام للحج",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "نظام عزام للحج",
  },
  icons: {
    icon: [
      { url: "/icons/azzam-app-icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/azzam-app-icon.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/azzam-app-icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icons/azzam-app-icon.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
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
    <html lang="ar" dir="rtl" className={`theme-royal ${tajawal.variable} h-full antialiased`}>
      <body className={`${uxInteractions.root} min-h-full flex flex-col bg-[#0a0a0a] text-[#e8d4a8]`}>
        {children}
        <PwaReloadOnUpdate />
        <IosInstallHint />
      </body>
    </html>
  );
}
