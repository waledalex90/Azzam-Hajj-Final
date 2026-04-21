/**
 * ضغط بسيط للصور في المتصفح قبل الرفع — يقلل الحجم على شبكات الموبايل.
 * الفيديو يُرفع كما هو (ضغط الفيديو يحتاج مكتبات إضافية).
 */
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
const MIN_BYTES_TO_COMPRESS = 350_000;

export async function compressImageFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < MIN_BYTES_TO_COMPRESS) {
    return file;
  }
  if (typeof createImageBitmap === "undefined") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    let w = width;
    let h = height;
    if (w > MAX_EDGE || h > MAX_EDGE) {
      const scale = MAX_EDGE / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    const ext = mime === "image/png" ? "png" : "jpg";
    return new File([blob], `${base}-compressed.${ext}`, { type: mime });
  } catch {
    return file;
  }
}
