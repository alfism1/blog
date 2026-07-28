"use client";

import * as React from "react";
import { ImagePlusIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  /** Images are stored under `/images/{slug}/`, so a slug is required. */
  slug: string;
  onUploaded: (path: string) => void;
  label?: string;
}

/**
 * Uploads an image through `/api/admin/upload`, which commits it to the content
 * repository via the same adapter that stores posts.
 */
export function ImageUpload({
  slug,
  onUploaded,
  label = "Upload image",
}: ImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!slug) {
      toast.error("Set a slug first", {
        description: "Uploads are stored under /images/{slug}/.",
      });
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("slug", slug);

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error("Upload failed", {
          description: data.error ?? `Request failed (${response.status}).`,
        });
        return;
      }

      onUploaded(data.path);
      toast.success("Image uploaded", {
        description: data.triggersDeploy
          ? `Committed as ${data.path}. Live after the next build.`
          : `Saved to public${data.path}.`,
      });
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setIsUploading(false);
      // Reset so re-picking the same file fires `change` again.
      event.target.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
        className="sr-only"
        onChange={handleFile}
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <>
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            Uploading…
          </>
        ) : (
          <>
            <ImagePlusIcon aria-hidden="true" />
            {label}
          </>
        )}
      </Button>
    </>
  );
}
