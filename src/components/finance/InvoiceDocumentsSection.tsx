"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EffectiveProjectScope } from "@/hooks/useEffectiveProjectScope";
import {
  DocumentCard,
  DocumentRenameDialog,
  openProjectDocument,
  PdfPreviewModal,
  sanitizeFilename,
  type ProjectDocumentRow,
} from "@/components/documents/DocumentWidgets";

type ScopeReady = Extract<EffectiveProjectScope, { kind: "single" } | { kind: "all" }>;

export function InvoiceDocumentsSection({
  scope,
  projectNameById,
}: {
  scope: ScopeReady;
  projectNameById: Record<string, string>;
}) {
  const [docs, setDocs] = useState<ProjectDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<ProjectDocumentRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Stable identity — avoid new [] each render (was causing infinite fetch → blink). */
  const projectIds = useMemo((): string[] => {
    if (scope.kind === "all") return scope.ids;
    return [scope.id];
  }, [scope.kind, scope.kind === "all" ? scope.ids.join(",") : scope.id]);

  const uploadDisabled = scope.kind !== "single";

  const fetchDocs = useCallback(async () => {
    if (projectIds.length === 0) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      setError("A Supabase nincs beállítva");
      return;
    }
    try {
      let q = supabase
        .from("documents")
        .select("id, project_id, file_path, original_name, display_name, file_type, created_at")
        .eq("category", "invoice")
        .order("created_at", { ascending: false });
      q = projectIds.length === 1 ? q.eq("project_id", projectIds[0]) : q.in("project_id", projectIds);
      const { data, error: err } = await q;
      if (err) {
        setError(err.message);
        setDocs([]);
      } else {
        setDocs((data ?? []) as ProjectDocumentRow[]);
      }
    } catch {
      setError("Számlák betöltése sikertelen");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [projectIds]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length || scope.kind !== "single") return;
    const supabase = createClient();
    if (!supabase) return;

    const files = Array.from(fileList);
    setUploading(true);
    setError(null);

    const allowed = ["docx", "xlsx", "pdf", "jpg", "jpeg", "png", "webp", "heic"];
    const skipped: string[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowed.includes(ext)) {
        skipped.push(file.name);
        continue;
      }

      const safeName = sanitizeFilename(file.name);
      const path = `${scope.id}/${crypto.randomUUID()}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("project_files")
        .upload(path, file, { upsert: false });

      if (uploadErr) {
        if (uploadErr.message.toLowerCase().includes("bucket not found")) {
          setError(
            "A 'project_files' tárhely-bucket hiányzik. Futtasd a legfrissebb Supabase migrációkat, majd próbáld újra."
          );
        } else {
          setError(uploadErr.message);
        }
        setUploading(false);
        void fetchDocs();
        return;
      }

      const { error: insertErr } = await supabase.from("documents").insert({
        project_id: scope.id,
        file_path: path,
        original_name: file.name,
        display_name: file.name,
        file_type: ext,
        category: "invoice",
      });

      if (insertErr) {
        setError(insertErr.message);
        setUploading(false);
        void fetchDocs();
        return;
      }
    }

    setUploading(false);
    if (skipped.length > 0) {
      setError(`Nem engedélyezett típus (kihagyva): ${skipped.join(", ")}`);
    }
    void fetchDocs();
  }

  async function renameFile(doc: ProjectDocumentRow, newName: string) {
    if (!newName.trim()) return;
    const supabase = createClient();
    if (!supabase) return;

    setError(null);
    const { error: upErr } = await supabase
      .from("documents")
      .update({ display_name: newName.trim() })
      .eq("id", doc.id);

    if (upErr) {
      setError(upErr.message);
      return;
    }
    setRenameDoc(null);
    setRenameValue("");
    void fetchDocs();
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files?.length) void uploadFiles(files);
    e.target.value = "";
  };

  const handleViewDocument = useCallback(async (doc: ProjectDocumentRow) => {
    const ft = (doc.file_type ?? "").toLowerCase();
    if (ft === "pdf") {
      const supabase = createClient();
      if (!supabase) {
        setError("A Supabase nincs beállítva");
        return;
      }
      setError(null);
      const { data, error: urlErr } = await supabase.storage
        .from("project_files")
        .createSignedUrl(doc.file_path, 60 * 5);
      if (urlErr || !data?.signedUrl) {
        setError(urlErr?.message ?? "PDF előnézet nem elérhető");
        return;
      }
      setPdfPreview({
        url: data.signedUrl,
        title: doc.display_name || doc.original_name || "Számla",
      });
      return;
    }
    await openProjectDocument(doc, setError);
  }, []);

  const showProjectLabel = scope.kind === "all";

  return (
    <div className="space-y-4">
      <p className="text-sm text-black/60 font-sans">
        {uploadDisabled ? (
          <>
            Számlák feltöltéséhez válassz egy konkrét projektet a fejlécben. Az „Összes projekt” nézetben a
            listát meg tudod nézni.
          </>
        ) : (
          <>
            A feltöltött fájlok a <strong className="text-black/80">Dokumentumok</strong> tárolóban vannak
            (ugyanaz a tárhely). Megnyitás és átnevezés ugyanúgy működik, mint a Dokumentumok oldalon.
          </>
        )}
      </p>

      {!uploadDisabled && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-10 px-4 rounded-lg bg-primary text-black font-sans text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Feltöltés…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Számla feltöltése
                </>
              )}
            </button>
            <span className="font-sans text-xs text-black/50">
              PDF, Office, kép — egyszerre több fájl is kiválasztható
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".docx,.xlsx,.pdf,.jpg,.jpeg,.png,.webp,.heic"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Számlák feltöltése (több fájl is választható)"
          />
        </>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 font-sans text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-6 text-black/60 font-sans text-sm">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          Számlák betöltése…
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-black/55 font-sans py-2">
          {uploadDisabled
            ? "Nincs feltöltött számla a kiválasztott projektekhez."
            : "Még nincs feltöltött számla ehhez a projekthez."}
        </p>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              projectLabel={showProjectLabel ? projectNameById[doc.project_id] : undefined}
              onView={() => void handleViewDocument(doc)}
              onRename={() => {
                setRenameDoc(doc);
                setRenameValue(doc.display_name || doc.original_name || "");
              }}
            />
          ))}
        </div>
      )}

      {renameDoc && (
        <DocumentRenameDialog
          title="Számla átnevezése"
          value={renameValue}
          onChange={setRenameValue}
          onSave={() => void renameFile(renameDoc, renameValue)}
          onCancel={() => {
            setRenameDoc(null);
            setRenameValue("");
          }}
        />
      )}

      {pdfPreview && (
        <PdfPreviewModal
          url={pdfPreview.url}
          title={pdfPreview.title}
          onClose={() => setPdfPreview(null)}
        />
      )}
    </div>
  );
}
