declare module "next-pwa" {
  import type { NextConfig } from "next";

  type PWAOptions = {
    dest: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    fallbacks?: {
      document?: string;
    };
    runtimeCaching?: Array<Record<string, unknown>>;
  };

  type WithPWA = (config: NextConfig) => NextConfig;
  export default function withPWAInit(options: PWAOptions): WithPWA;
}
