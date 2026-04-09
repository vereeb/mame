"use client";

import { useEffect, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type ProjectDocumentRow = {
  id: string;
  project_id: string;
  file_path: string;
  original_name: string;
  display_name: string;
  file_type: string;
  created_at: string;
};

const PHOTO_TYPES = ["jpg", "jpeg", "png", "webp", "heic"];

export function isPhotoFileType(fileType: string) {
  return PHOTO_TYPES.includes(fileType.toLowerCase());
}

export function sanitizeFilename(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function formatDocumentDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Same viewing behavior as Dokumentumok: signed URL; Office Online for docx/xlsx. */
export async function openProjectDocument(
  doc: ProjectDocumentRow,
  onError: (message: string) => void
): Promise<void> {
  const supabase = createClient();
  if (!supabase) {
    onError("A Supabase nincs beállítva");
    return;
  }
  onError("");
  const { data, error: signedUrlError } = await supabase.storage
    .from("project_files")
    .createSignedUrl(doc.file_path, 60 * 5);

  if (signedUrlError || !data?.signedUrl) {
    onError(signedUrlError?.message ?? "Fájl megnyitása sikertelen");
    return;
  }

  const fileType = (doc.file_type ?? "").toLowerCase();
  if (fileType === "docx" || fileType === "xlsx") {
    const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
      data.signedUrl
    )}`;
    window.open(officeViewerUrl, "_blank", "noopener,noreferrer");
    return;
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function DocumentCard({
  doc,
  projectLabel,
  onView,
  onRename,
}: {
  doc: ProjectDocumentRow;
  projectLabel?: string;
  onView: () => void;
  onRename: () => void;
}) {
  const ft = doc.file_type?.toLowerCase();
  const isDoc = ft === "docx";
  const isSheet = ft === "xlsx";
  const isPdf = ft === "pdf";
  const isPic = isPhotoFileType(ft);

  let Icon: ReactNode;
  let iconBg = "bg-black/10";

  if (isDoc) {
    iconBg = "bg-blue-100";
    Icon = (
      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
      </svg>
    );
  } else if (isSheet) {
    iconBg = "bg-green-100";
    Icon = (
      <svg className="w-8 h-8 text-green-700" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-2 14v-2h4v2h-4zm0-4v-2h4v2h-4zm0-4V8h4v2h-4z" />
      </svg>
    );
  } else if (isPdf) {
    iconBg = "bg-red-100";
    Icon = (
      <svg className="w-8 h-8 text-red-700" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 9H8v2h5v-2zm0-4H8v2h8V7H8v2z" />
      </svg>
    );
  } else {
    iconBg = isPic ? "bg-amber-100" : "bg-slate-100";
    Icon = (
      <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }

  const displayName = doc.display_name || doc.original_name || "Untitled";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      aria-label={`Megnyitás: ${displayName}`}
      className="rounded-xl border border-outline bg-white p-4 shadow-m3-1 cursor-pointer hover:bg-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <div className="flex items-center gap-4">
        <div className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${iconBg}`}>
          {Icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-medium text-black truncate">{displayName}</p>
          <p className="font-sans text-sm text-black/60">
            {projectLabel ? (
              <>
                <span className="font-medium text-black/70">{projectLabel}</span>
                <span className="text-black/40"> · </span>
              </>
            ) : null}
            {formatDocumentDate(doc.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="shrink-0 px-3 py-2 rounded-lg font-sans text-sm font-medium text-primary hover:bg-primary/10"
        >
          Átnevezés
        </button>
      </div>
    </div>
  );
}

export function DocumentRenameDialog({
  value,
  onChange,
  onSave,
  onCancel,
  title = "Dokumentum átnevezése",
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  title?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-rename-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-m3-2"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="document-rename-dialog-title" className="font-serif text-lg font-semibold text-black mb-4">
          {title}
        </h3>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-12 px-4 rounded-lg border border-outline bg-surface-variant font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Megjelenített név"
        />
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-lg font-sans text-sm font-medium text-black/80 hover:bg-surface-variant"
          >
            Mégse
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!value.trim()}
            className="flex-1 h-11 rounded-lg font-sans text-sm font-medium bg-primary text-black disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
}

/** In-app PDF preview (iframe). Use signed storage URL from createSignedUrl. */
export function PdfPreviewModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-center bg-black/55 p-2 sm:p-4 md:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="mx-auto flex h-[min(92dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-outline bg-white shadow-m3-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-variant px-3 py-2.5 sm:px-4">
          <h2 id="pdf-preview-title" className="min-w-0 flex-1 font-serif text-base sm:text-lg font-semibold text-black truncate">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-xs sm:text-sm font-medium text-primary hover:underline whitespace-nowrap"
            >
              Új lapon
            </a>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-lg border border-outline bg-white font-sans text-sm font-medium text-black hover:bg-surface-variant"
            >
              Bezárás
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-black/[0.04]">
          <iframe title={title} src={url} className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  );
}
