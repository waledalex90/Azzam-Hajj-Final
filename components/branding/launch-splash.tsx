import { BrandLogo } from "@/components/branding/brand-logo";
import { PRODUCT_NAME, PRODUCT_TAGLINE_AR } from "@/lib/product";

export function LaunchSplash() {
  return (
    <main className="launch-screen min-h-screen w-full">
      <div className="launch-screen__overlay">
        <div className="launch-screen__logo-wrap">
          <div className="launch-screen__icon flex justify-center px-2">
            <BrandLogo priority preset="launch" />
          </div>
          <p className="launch-screen__title">{PRODUCT_NAME}</p>
          <p className="launch-screen__subtitle">{PRODUCT_TAGLINE_AR}</p>
        </div>
      </div>
    </main>
  );
}
