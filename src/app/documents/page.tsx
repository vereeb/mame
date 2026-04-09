"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEffectiveProjectScope } from "@/hooks/useEffectiveProjectScope";
import {
  DocumentCard,
  DocumentRenameDialog,
  isPhotoFileType,
  openProjectDocument,
  sanitizeFilename,
  type ProjectDocumentRow,
} from "@/components/documents/DocumentWidgets";

type DocType = "all" | "docx" | "xlsx" | "photos";

type Document = ProjectDocumentRow;

export default function DocumentsPage() {
  const scope = useEffectiveProjectScope();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocType>("all");
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    if (scope.kind === "none") {
      setDocs([]);
      setLoading(false);
      return;
    }
    if (scope.kind === "loading_all") {
      setLoading(true);
      return;
    }

    const ids = scope.kind === "all" ? scope.ids : [scope.id];
    if (ids.length === 0) {
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
        .eq("category", "general");
      q = ids.length === 1 ? q.eq("project_id", ids[0]) : q.in("project_id", ids);
      const { data, error: err } = await q.order("created_at", { ascending: false });
      if (err) {
        setError(err.message);
        setDocs([]);
      } else {
        setDocs((data ?? []) as Document[]);
      }
    } catch {
      setError("Dokumentumok betöltése sikertelen");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const filteredDocs = docs.filter((d) => {
    const name = (d.display_name || d.original_name || "").toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filter === "all") return true;
    if (filter === "docx") return d.file_type?.toLowerCase() === "docx";
    if (filter === "xlsx") return d.file_type?.toLowerCase() === "xlsx";
    if (filter === "photos") return isPhotoFileType(d.file_type);
    return true;
  });

  async function uploadFile(file: File) {
    if (scope.kind !== "single") return;
    const supabase = createClient();
    if (!supabase) return;

    setUploading(true);
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = ["docx", "xlsx", "pdf", "jpg", "jpeg", "png", "webp", "heic"];
    if (!allowed.includes(ext)) {
      setError("Engedélyezett: .docx, .xlsx, .pdf, .jpg, .png, .webp, .heic");
      setUploading(false);
      return;
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
      return;
    }

    const { error: insertErr } = await supabase.from("documents").insert({
      project_id: scope.id,
      file_path: path,
      original_name: file.name,
      display_name: file.name,
      file_type: ext,
      category: "general",
    });

    if (insertErr) {
      setError(insertErr.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    fetchDocs();
  }

  async function renameFile(doc: Document, newName: string) {
    if (!newName.trim()) return;
    const supabase = createClient();
    if (!supabase) return;

    setError(null);
    const { error } = await supabase
      .from("documents")
      .update({ display_name: newName.trim() })
      .eq("id", doc.id);

    if (error) {
      setError(error.message);
      return;
    }
    setRenameDoc(null);
    setRenameValue("");
    fetchDocs();
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  if (scope.kind === "none") {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <p className="font-serif text-lg text-black/70">
          Válassz egy projektet vagy az „Összes projekt” nézetet a dokumentumok megtekintéséhez.
        </p>
      </div>
    );
  }

  if (scope.kind === "loading_all") {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-serif text-lg text-black/70">Projektek betöltése…</p>
      </div>
    );
  }

  const projectNameById = Object.fromEntries(
    scope.kind === "all" ? scope.projects.map((p) => [p.id, p.name]) : []
  );
  const uploadDisabled = scope.kind !== "single";

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8">
      <h2 className="font-serif text-xl font-semibold text-black mb-2">Dokumentumok</h2>
      {scope.kind === "all" && (
        <p className="font-sans text-sm text-black/60 mb-4">
          Összes elérhető projekt dokumentumai egy listában. Feltöltéshez válassz egy konkrét projektet.
        </p>
      )}

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Dokumentumok keresése…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 pl-4 pr-4 rounded-xl border border-outline bg-surface-variant font-sans text-sm text-black placeholder:text-black/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          aria-label="Dokumentumok keresése"
        />
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {(["all", "docx", "xlsx", "photos"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`shrink-0 px-4 py-2 rounded-full font-sans text-sm font-medium transition ${
              filter === t
                ? "bg-primary text-black"
                : "bg-surface-variant text-black/80 hover:bg-outline/50"
            }`}
          >
            {t === "all"
              ? "Összes"
              : t === "docx"
                ? "Dokumentumok"
                : t === "xlsx"
                  ? "Táblázatok"
                  : "Fotók"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 font-sans text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-8 flex flex-col items-center justify-center py-12">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-sans text-sm text-black/60">
            Dokumentumok betöltése…
          </p>
        </div>
      )}

      {/* Empty */}
      {!loading && filteredDocs.length === 0 && (
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
          <p className="font-sans text-sm text-black/60">
            {docs.length === 0
              ? uploadDisabled
                ? "Még nincsenek dokumentumok. Feltöltéshez válassz egy konkrét projektet."
                : "Még nincsenek dokumentumok. A + gombra kattintva tölthetsz fel."
              : "Nincs találat a keresés vagy szűrő alapján."}
          </p>
        </div>
      )}

      {/* List */}
      {!loading && filteredDocs.length > 0 && (
        <div className="mt-6 space-y-3">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              projectLabel={projectNameById[doc.project_id]}
              onView={() => void openProjectDocument(doc, setError)}
              onRename={() => {
                setRenameDoc(doc);
                setRenameValue(doc.display_name || doc.original_name || "");
              }}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || uploadDisabled}
        title={
          uploadDisabled
            ? "Válassz egy konkrét projektet a feltöltéshez"
            : "Dokumentum feltöltése"
        }
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-primary text-black shadow-m3-fab flex items-center justify-center hover:opacity-90 active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed z-30"
        aria-label="Dokumentum feltöltése"
      >
        {uploading ? (
          <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.xlsx,.pdf,.jpg,.jpeg,.png,.webp,.heic"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Rename Dialog */}
      {renameDoc && (
        <DocumentRenameDialog
          value={renameValue}
          onChange={setRenameValue}
          onSave={() => renameFile(renameDoc, renameValue)}
          onCancel={() => {
            setRenameDoc(null);
            setRenameValue("");
          }}
        />
      )}
    </div>
  );
}
