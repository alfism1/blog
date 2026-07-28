"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function DeletePostDialog({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [deleteImages, setDeleteImages] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  async function handleDelete() {
    setIsPending(true);
    try {
      const response = await fetch(
        `/api/admin/posts/${slug}?deleteImages=${deleteImages}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error("Could not delete the post", {
          description: data.error ?? `Request failed (${response.status}).`,
        });
        setIsPending(false);
        return;
      }

      setOpen(false);
      toast.success(`Deleted “${title}”`, {
        description: data.triggersDeploy
          ? "Committed to GitHub. The site will rebuild in about a minute."
          : "Removed from content/posts.",
      });
      router.refresh();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${title}`}
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this post?</DialogTitle>
          <DialogDescription>
            <span className="text-foreground font-medium">{title}</span> will be
            removed from the content repository. This cannot be undone from the
            admin panel — though the commit history keeps a copy.
          </DialogDescription>
        </DialogHeader>

        <div className="border-border flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor={`delete-images-${slug}`} className="cursor-pointer">
            Also delete <code className="text-xs">/images/{slug}/</code>
          </Label>
          <Switch
            id={`delete-images-${slug}`}
            checked={deleteImages}
            onCheckedChange={setDeleteImages}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                Deleting…
              </>
            ) : (
              "Delete post"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
