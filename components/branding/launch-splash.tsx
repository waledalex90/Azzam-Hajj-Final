import { BrandLogo } from "@/components/branding/brand-logo";

export function LaunchSplash() {
  return (
    <main className="launch-screen min-h-screen w-full">
      <div className="launch-screen__overlay">
        <div className="launch-screen__logo-wrap">
          <div className="launch-screen__icon flex justify-center px-2">
            <BrandLogo priority className="!w-[min(88vw,320px)] sm:!w-[360px]" surface="dark" />
          </div>
          <p className="launch-screen__title">نظام عزام للحج</p>
          <p className="launch-screen__subtitle">النسخة الملكية - هوية أسود وذهب</p>
        </div>
      </div>
    </main>
  );
}
