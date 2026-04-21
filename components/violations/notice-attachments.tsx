"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  readOnly?: boolean;
  initialUrls?: string[];
};

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url) || url.includes("/video");
}

async function downloadMediaUrl(url: string, fallbackName: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fallbackName;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function DownloadBlobButton({ blobUrl, fileName }: { blobUrl: string; fileName: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="mt-1 h-8 gap-1 px-2 text-xs"
      onClick={() => {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        a.click();
      }}
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      تحميل
    </Button>
  );
}

export function NoticeAttachments({ readOnly, initialUrls = [] }: Props) {
  const [files, setFiles] = useState<File[]>([]);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isVideo: file.type.startsWith("video/"),
        name: file.name || "مرفق",
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list);
  }, []);

  if (readOnly) {
    if (!initialUrls.length) {
      return (
        <div className="notice-media-block">
          <div className="section-title notice-media-title">مرفقات (صورة / فيديو)</div>
          <p className="notice-media-empty">لا توجد مرفقات لهذا الإشعار.</p>
        </div>
      );
    }
    return (
      <div className="notice-media-block print-attachments">
        <div className="section-title notice-media-title">مرفقات (صورة / فيديو)</div>
        <div className="notice-media-grid">
          {initialUrls.map((url, i) => (
            <div key={url} className="notice-media-tile">
              {isVideoUrl(url) ? (
                <video className="notice-media-item" controls playsInline src={url} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="notice-media-item" alt="مرفق إشعار مخالفة" src={url} />
              )}
              <Button
                type="button"
                variant="secondary"
                className="no-print mt-1 h-8 gap-1 px-2 text-xs"
                onClick={() => void downloadMediaUrl(url, `notice-attachment-${i + 1}`)}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                تحميل
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="notice-media-block no-print">
      <div className="section-title notice-media-title">مرفقات (صورة / فيديو)</div>
      <p className="notice-media-hint no-print">
        التقط من الكاميرا أو اختر من المعرض. الصور تُضغط تلقائياً قبل الرفع عند الحاجة؛ الفيديو يُرفع كما هو مع
        شريط تقدم أثناء الحفظ.
      </p>
      <input
        type="file"
        name="mediaFiles"
        accept="image/*,video/*"
        capture="environment"
        multiple
        className="notice-file-input no-print"
        onChange={onFileChange}
      />
      {previews.length > 0 && (
        <div className="notice-media-grid notice-media-preview">
          {previews.map((p) => (
            <div key={p.url} className="notice-media-tile">
              {p.isVideo ? (
                <video className="notice-media-item" controls playsInline src={p.url} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="notice-media-item" alt="" src={p.url} />
              )}
              <DownloadBlobButton blobUrl={p.url} fileName={p.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
