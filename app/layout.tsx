import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import uxInteractions from "./ux-interactions.module.css";
import { IosInstallHint } from "@/components/pwa/ios-install-hint";

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
      { url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
      { url: "/icons/abn-icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/abn-icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/apple-touch-icon.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
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
      <body className={`${uxInteractions.root} min-h-full flex flex-col bg-slate-50 text-slate-900`}>
        {children}
        <IosInstallHint />
      </body>
    </html>
  );
}
