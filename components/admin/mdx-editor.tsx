"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { LoaderCircleIcon } from "lucide-react";

import { renderMdxPreview } from "@/app/admin/preview-action";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The editor pulls in a syntax highlighter; keep it out of the initial payload.
const CodeEditor = dynamic(
  () => import("@uiw/react-textarea-code-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[28rem] w-full" />,
  },
);

const PREVIEW_DEBOUNCE_MS = 700;

type Pane = "write" | "preview";

interface MdxEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Rendered above the editor so the toolbar can insert image markdown. */
  toolbarExtra?: React.ReactNode;
}

/**
 * MDX body editor with a server-rendered live preview.
 *
 * Side-by-side on wide screens; a write/preview toggle on narrow ones, where
 * two panes would each be unusably cramped.
 */
export function MdxEditor({ value, onChange, toolbarExtra }: MdxEditorProps) {
  const [pane, setPane] = React.useState<Pane>("write");

  /**
   * The preview is stored together with the source it was produced from, so
   * "is a render pending?" is *derived* (`rendered.source !== value`) rather
   * than tracked in a second state variable that has to be kept in sync.
   */
  const [rendered, setRendered] = React.useState<{
    source: string | null;
    content: React.ReactNode;
    error: string | null;
  }>({ source: null, content: null, error: null });

  React.useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const result = await renderMdxPreview(value);
        if (cancelled) return;
        setRendered({
          source: value,
          content: result.ok ? (result.content ?? null) : null,
          error: result.ok ? null : (result.error ?? "Preview failed."),
        });
      } catch (error) {
        if (cancelled) return;
        setRendered({
          source: value,
          content: null,
          error: (error as Error).message || "Preview failed.",
        });
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  const isRendering = rendered.source !== value;
  const previewError = rendered.error;
  const preview = rendered.content;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Pane switch is only meaningful below lg, where panes are stacked. */}
          <div
            role="tablist"
            aria-label="Editor pane"
            className="border-border flex rounded-md border p-0.5 lg:hidden"
          >
            {(["write", "preview"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={pane === option}
                onClick={() => setPane(option)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
                  pane === option
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          {toolbarExtra}
        </div>

        <p
          className="text-muted-foreground flex items-center gap-1.5 text-xs"
          role="status"
          aria-live="polite"
        >
          {isRendering ? (
            <>
              <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />
              Rendering preview…
            </>
          ) : (
            `${value.length.toLocaleString()} characters`
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className={cn(
            "border-border overflow-hidden rounded-lg border",
            pane === "preview" && "hidden lg:block",
          )}
        >
          <CodeEditor
            value={value}
            language="mdx"
            placeholder="Write your post in MDX…"
            onChange={(event) => onChange(event.target.value)}
            padding={16}
            data-color-mode="light"
            className="!bg-background min-h-[28rem] text-sm text-foreground"
            style={{
              color: "var(--foreground)",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "0.875rem",
              minHeight: "28rem",
            }}
            aria-label="MDX body"
          />
        </div>

        <div
          className={cn(
            "border-border bg-card overflow-x-auto rounded-lg border p-5",
            pane === "write" && "hidden lg:block",
          )}
        >
          {previewError ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/8 text-destructive rounded-md border p-3 text-sm"
            >
              <p className="font-medium">MDX did not compile</p>
              <pre className="mt-2 text-xs whitespace-pre-wrap">
                {previewError}
              </pre>
            </div>
          ) : value.trim().length === 0 ? (
            <p className="text-muted-foreground text-sm">
              The preview appears here as you type.
            </p>
          ) : (
            <div className="prose max-w-none">{preview}</div>
          )}
        </div>
      </div>
    </div>
  );
}
