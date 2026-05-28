import { useState, useCallback, useRef } from "react";
import { useProfile } from "@/context/profile-context";

const MAX_SIZE = 480;
const JPEG_QUALITY = 0.75;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.naturalWidth, img.naturalHeight, MAX_SIZE);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const offsetX = (img.naturalWidth - size) / 2;
        const offsetY = (img.naturalHeight - size) / 2;
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useProfilePhoto() {
  const { profile, updateProfile } = useProfile();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const photoUrl = profile?.profile_photo_url ?? null;

  const triggerUpload = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      updateProfile({ profile_photo_url: dataUrl });
    } catch {
      // silent
    }
    setUploading(false);
  }, [updateProfile]);

  const removePhoto = useCallback(() => {
    updateProfile({ profile_photo_url: undefined });
  }, [updateProfile]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return {
    photoUrl,
    uploading,
    inputRef,
    triggerUpload,
    onChange,
    removePhoto,
    hasPhoto: !!photoUrl,
  };
}
