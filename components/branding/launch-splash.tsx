import Image from "next/image";

export function LaunchSplash() {
  return (
    <main className="launch-screen min-h-screen w-full">
      <div className="launch-screen__overlay">
        <div className="launch-screen__logo-wrap">
          <Image
            src="/icons/icon-512.svg"
            alt="Azzam Hajj Launch Icon"
            width={164}
            height={164}
            priority
            className="launch-screen__icon"
          />
          <p className="launch-screen__title">نظام عزام للحج</p>
          <p className="launch-screen__subtitle">نسخة UAT - جاهزة للاختبار</p>
        </div>
      </div>
    </main>
  );
}
