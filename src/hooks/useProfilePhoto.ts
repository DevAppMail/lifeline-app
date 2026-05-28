import { useState, useCallback, useRef, useEffect } from "react";
import { useProfile } from "@/context/profile-context";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";

const AVATAR_BUCKET = "avatars" as const;
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

function isDataUrl(url: string): boolean {
  return url.startsWith("data:");
}

export function useProfilePhoto() {
  const { profile, updateProfile } = useProfile();
  const { uploadPhoto, deletePhoto, migrateDataUrl } = usePhotoUpload();
  const [uploading, setUploading] = useState(false);
  const [hasMigrated, setHasMigrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const storedUrl = profile?.profile_photo_url ?? null;
  const photoUrl = storedUrl;

  const getPhotoPath = useCallback(() => {
    if (!profile?.phone) return "";
    const uid = profile.phone;
    return `${uid}/avatar.webp`;
  }, [profile?.phone]);

  useEffect(() => {
    if (hasMigrated) return;
    if (!storedUrl || !isDataUrl(storedUrl)) return;

    setHasMigrated(true);
    const path = getPhotoPath();
    if (!path) return;

    migrateDataUrl(storedUrl, AVATAR_BUCKET, path, {
      maxWidth: MAX_SIZE,
      quality: 0.75,
      format: "image/webp",
    }).then(({ publicUrl, error }) => {
      if (!error && publicUrl) {
        updateProfile({ profile_photo_url: publicUrl });
      }
    });
  }, [storedUrl, hasMigrated, migrateDataUrl, updateProfile, getPhotoPath]);

  const triggerUpload = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const path = getPhotoPath() || `avatar_${Date.now()}.webp`;
      const { publicUrl, error } = await uploadPhoto(file, AVATAR_BUCKET, path, {
        maxWidth: MAX_SIZE,
        quality: 0.75,
        format: "image/webp",
      });
      if (error) {
        const dataUrl = await compressImage(file);
        updateProfile({ profile_photo_url: dataUrl });
      } else if (publicUrl) {
        updateProfile({ profile_photo_url: publicUrl });
      }
    } catch {
      // silent
    }
    setUploading(false);
  }, [uploadPhoto, updateProfile, getPhotoPath]);

  const removePhoto = useCallback(async () => {
    const current = profile?.profile_photo_url;
    if (current && !isDataUrl(current)) {
      const path = getPhotoPath();
      if (path) await deletePhoto(AVATAR_BUCKET, path);
    }
    updateProfile({ profile_photo_url: undefined });
  }, [profile?.profile_photo_url, deletePhoto, updateProfile, getPhotoPath]);

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
