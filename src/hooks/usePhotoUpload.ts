import { supabase } from "@/lib/supabase";

type BucketName = "avatars" | "verification-selfies" | "donation-photos" | "clinic-banners";

interface CompressOptions {
  maxWidth?: number;
  quality?: number;
  format?: "image/webp" | "image/jpeg";
}

interface UploadResult {
  publicUrl: string;
  path: string;
  error?: string;
}

async function compressImage(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const { maxWidth = 800, quality = 0.75, format = "image/webp" } = opts;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((maxWidth / width) * height);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob returned null"));
        },
        format,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error("Failed to convert data URL to blob");
  return res.blob();
}

export function usePhotoUpload() {
  async function uploadPhoto(
    file: File | Blob,
    bucket: BucketName,
    path: string,
    opts?: CompressOptions
  ): Promise<UploadResult> {
    if (!supabase) {
      return { publicUrl: "", path, error: "Supabase client not configured" };
    }

    try {
      const compressed = await compressImage(file as File, opts);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, compressed, { upsert: true, contentType: opts?.format ?? "image/webp" });

      if (error) throw new Error(error.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);

      return { publicUrl, path };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return { publicUrl: "", path, error: message };
    }
  }

  async function migrateDataUrl(
    dataUrl: string,
    bucket: BucketName,
    path: string,
    opts?: CompressOptions
  ): Promise<UploadResult> {
    const blob = await dataUrlToBlob(dataUrl);
    return uploadPhoto(blob, bucket, path, opts);
  }

  async function deletePhoto(bucket: BucketName, path: string): Promise<{ error?: string }> {
    if (!supabase) return { error: "Supabase client not configured" };

    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw new Error(error.message);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Delete failed" };
    }
  }

  return { uploadPhoto, migrateDataUrl, deletePhoto };
}
