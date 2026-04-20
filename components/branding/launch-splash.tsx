import Image from "next/image";

export function LaunchSplash() {
  return (
    <main className="launch-screen min-h-screen w-full">
      <div className="launch-screen__overlay">
        <div className="launch-screen__logo-wrap">
          <Image
            src="/icons/abn-icon-512.svg"
            alt="أيقونة نظام عزام للحج"
            width={164}
            height={164}
            priority
            className="launch-screen__icon"
          />
          <p className="launch-screen__title">نظام عزام للحج</p>
          <p className="launch-screen__subtitle">النسخة الملكية - هوية أسود وذهب</p>
        </div>
      </div>
    </main>
  );
}
