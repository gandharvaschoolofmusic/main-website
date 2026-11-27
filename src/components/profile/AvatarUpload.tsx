"use client";

import { ProfileImage } from "@/components/profile/ProfileImage";
import { useState, useRef, useTransition, useEffect } from "react";
import { prepareAvatar } from "@/lib/prepare-avatar";
import { uploadAvatarAction, removeAvatarAction } from "@/actions/profile";
import { Camera, Trash2, Upload, Loader2, Check, AlertCircle } from "lucide-react";

interface AvatarUploadProps {
  currentImage?: string | null;
  userName?: string;
  onImageUpdated?: (newUrl: string | null) => void;
}

export function AvatarUpload({
  currentImage: initialImage,
  userName = "User",
  onImageUpdated,
}: AvatarUploadProps) {
  const [currentImage, setCurrentImage] = useState<string | null>(initialImage || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    if (statusMessage?.type !== "success") return;
    const timer = setTimeout(() => setStatusMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "GS";

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers event
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Validate mime type
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type.toLowerCase())) {
      setStatusMessage({
        type: "error",
        text: "Please select a JPG, PNG, WEBP, or GIF image.",
      });
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({
        type: "error",
        text: "Image size exceeds 5MB. Please choose a smaller photo.",
      });
      return;
    }

    // Generate local preview
    const tempUrl = URL.createObjectURL(file);
    setPreviewUrl(tempUrl);
    setStatusMessage(null);

    // Upload
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", await prepareAvatar(file), "avatar.webp");

        const res = await uploadAvatarAction(formData);
        if (res.success && res.image) {
          setCurrentImage(res.image);
          setPreviewUrl(null);
          setStatusMessage({
            type: "success",
            text: "Profile picture updated successfully!",
          });
          onImageUpdated?.(res.image);
        } else {
          setPreviewUrl(null);
          setStatusMessage({
            type: "error",
            text: res.error || "Failed to upload image. Please try again.",
          });
        }
      } catch {
        setPreviewUrl(null);
        setStatusMessage({ type: "error", text: "Could not upload the photo. Check your connection and try again." });
      }
    });
  };

  const handleRemoveAvatar = () => {
    if (!currentImage) return;
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const res = await removeAvatarAction();
        if (res.success) {
          setCurrentImage(null);
          setPreviewUrl(null);
          setStatusMessage({
            type: "success",
            text: "Profile picture removed.",
          });
          onImageUpdated?.(null);
        } else {
          setStatusMessage({
            type: "error",
            text: res.error || "Failed to remove image.",
          });
        }
      } catch {
        setStatusMessage({ type: "error", text: "Could not remove the photo. Please try again." });
      }
    });
  };

  const displayImage = previewUrl || currentImage;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Avatar Ring Container */}
        <div className="relative group shrink-0 w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 shadow-md bg-[#160A29] flex items-center justify-center transition-all hover:border-cta hover:shadow-lg">
          {displayImage ? (
            <ProfileImage
              src={displayImage}
              alt={userName}
              width={96}
              height={96}
              unoptimized
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary via-[#241040] to-accent-dark/80 text-white font-serif font-bold text-2xl select-none tracking-wider">
              {initials}
            </div>
          )}

          {/* Quick Hover Camera Button */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-semibold cursor-pointer gap-1"
            title="Upload photo"
          >
            <Camera className="w-4 h-4" />
            <span>Change</span>
          </button>

          {/* Uploading Spinner Overlay */}
          {isPending && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <Loader2 className="w-6 h-6 text-cta animate-spin" />
            </div>
          )}
        </div>

        {/* Action Controls & Requirements */}
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </>
              )}
            </button>

            {currentImage && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleRemoveAvatar}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-alt hover:bg-rose-50 text-body hover:text-rose-700 border border-border-default hover:border-rose-200 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-body-muted leading-relaxed">
            Upload your personal portrait or studio headshot. PNG, JPG, WEBP, or GIF up to 5MB. Recommended minimum 400×400px.
          </p>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileSelected}
          className="hidden"
        />
      </div>

      {/* Feedback Messages */}
      {statusMessage && (
        <div
          className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium animate-fade-in-up ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-rose-50 border border-rose-200 text-rose-700"
          }`}
        >
          {statusMessage.type === "success" ? (
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
