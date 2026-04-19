"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  readOnly?: boolean;
  initialUrls?: string[];
};

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url) || url.includes("/video");
}

export function NoticeAttachments({ readOnly, initialUrls = [] }: Props) {
  const [files, setFiles] = useState<File[]>([]);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isVideo: file.type.startsWith("video/"),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

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
          {initialUrls.map((url) =>
            isVideoUrl(url) ? (
              <video key={url} className="notice-media-item" controls playsInline src={url} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} className="notice-media-item" alt="مرفق إشعار مخالفة" src={url} />
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="notice-media-block no-print">
      <div className="section-title notice-media-title">مرفقات (صورة / فيديو)</div>
      <p className="notice-media-hint no-print">يمكن إرفاق أكثر من ملف؛ يُعرَض في الطباعة أسفل النموذج.</p>
      <input
        type="file"
        name="mediaFiles"
        accept="image/*,video/*"
        multiple
        className="notice-file-input no-print"
        onChange={(e) => {
          const list = e.target.files ? Array.from(e.target.files) : [];
          setFiles(list);
        }}
      />
      {previews.length > 0 && (
        <div className="notice-media-grid notice-media-preview">
          {previews.map((p) =>
            p.isVideo ? (
              <video key={p.url} className="notice-media-item" controls playsInline src={p.url} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.url} className="notice-media-item" alt="" src={p.url} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
