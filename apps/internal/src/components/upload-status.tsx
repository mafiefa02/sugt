"use client";

import { cn } from "@sugt/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

/**
 * **What an upload to Google Drive is doing right now** (#420), said plainly enough to see on a
 * phone. There is deliberately no progress bar and no percentage: each file is one `PUT` with no
 * progress events, and what is wanted is an unmistakable sign that something is running, not a
 * measurement of it.
 *
 * `uploading` while the files are readied and their bytes go to Drive — `done` of `total` finished,
 * whether they go in parallel (receipts) or one after another (Foto & Video, #425) — then
 * `saving` while the server records and reconciles them.
 */
export type UploadProgress =
  | { phase: "uploading"; done: number; total: number }
  | { phase: "saving" };

/** The headline and the line under it. Pure, so the copy is tested without rendering. */
export function uploadStatusText(progress: UploadProgress): { title: string; hint: string } {
  if (progress.phase === "saving") {
    return { title: "Menyimpan…", hint: "Jangan tutup halaman ini sampai selesai." };
  }
  const { done, total } = progress;
  // The file being worked on: one past those finished, never past the last.
  const current = Math.min(done + 1, total);
  return {
    title:
      total > 1
        ? `Mengunggah ${current} dari ${total} berkas ke Google Drive…`
        : "Mengunggah ke Google Drive…",
    hint: "Jangan tutup halaman ini sampai selesai.",
  };
}

/**
 * The status itself: a spinner, the headline and "Jangan tutup…". A live region, so a screen reader
 * hears each change as the count moves on. Boxed and tinted in a popup, where it sits directly above
 * the buttons; `inline` drops the box for a control that is not in a popup (Unggah bukti on a row).
 */
export function UploadStatus({
  progress,
  inline = false,
  className,
}: {
  progress: UploadProgress;
  inline?: boolean;
  className?: string;
}) {
  const { title, hint } = uploadStatusText(progress);
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 text-sm",
        !inline && "shrink-0 rounded-lg border border-border bg-muted px-4 py-3",
        className,
      )}
    >
      <Loader2
        aria-hidden
        className="mt-0.5 size-4 shrink-0 animate-spin"
      />
      <div className="grid gap-0.5">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/**
 * Hand a popup's `onOpenChange` through only when it is not a close during an upload. Close
 * requests — the close button, Esc, a click outside — are ignored while `busy`, and opening is never
 * blocked. The popup's `open` is controlled, so ignoring the request is all it takes to stay open.
 */
export function holdOpenWhile(
  busy: boolean,
  onOpenChange: (open: boolean) => void,
): (open: boolean) => void {
  return (open) => {
    if (!open && busy) return;
    onOpenChange(open);
  };
}

/**
 * While `active`, unloading the page — a reload, closing the tab, typing another address — asks
 * first, with the browser's own prompt (it shows no custom text). Removed as soon as the upload is
 * over. An in-app link does not unload the page, so it is not caught; in a popup the overlay covers
 * the links anyway.
 */
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older Safari and Chrome only prompt when `returnValue` is set too.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [active]);
}
