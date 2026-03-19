"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { createClient } from "@/lib/supabase/client";

type DocType = "all" | "docx" | "xlsx" | "photos";

type Document = {
  id: string;
  project_id: string;
  file_path: string;
  original_name: string;
  display_name: string;
  file_type: string;
  created_at: string;
};

const PHOTO_TYPES = ["jpg", "jpeg", "png", "webp", "heic"];

function isPhoto(fileType: string) {
  return PHOTO_TYPES.includes(fileType.toLowerCase());
}

function sanitizeFilename(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DocumentsPage() {
  const { projectId } = useProject();
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
    if (!projectId) {
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
      const { data, error: err } = await supabase
        .from("documents")
        .select("id, project_id, file_path, original_name, display_name, file_type, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
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
  }, [projectId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const filteredDocs = docs.filter((d) => {
    const name = (d.display_name || d.original_name || "").toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filter === "all") return true;
    if (filter === "docx") return d.file_type?.toLowerCase() === "docx";
    if (filter === "xlsx") return d.file_type?.toLowerCase() === "xlsx";
    if (filter === "photos") return isPhoto(d.file_type);
    return true;
  });

  async function uploadFile(file: File) {
    if (!projectId) return;
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
    const path = `${projectId}/${crypto.randomUUID()}_${safeName}`;

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
      project_id: projectId,
      file_path: path,
      original_name: file.name,
      display_name: file.name,
      file_type: ext,
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

  async function viewFile(doc: Document) {
    const supabase = createClient();
    if (!supabase) {
      setError("A Supabase nincs beállítva");
      return;
    }

    setError(null);
    const { data, error: signedUrlError } = await supabase.storage
      .from("project_files")
      .createSignedUrl(doc.file_path, 60 * 5);

    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message ?? "Fájl megnyitása sikertelen");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  if (!projectId) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <p className="font-serif text-lg text-black/70">
          Válassz egy projektet a dokumentumok megtekintéséhez.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8">
      <h2 className="font-serif text-xl font-semibold text-black mb-4">
        Dokumentumok
      </h2>

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
              ? "Még nincsenek dokumentumok. A + gombra kattintva tölthetsz fel."
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
              onView={() => void viewFile(doc)}
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
        disabled={uploading}
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
        <RenameDialog
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

function DocumentCard({
  doc,
  onView,
  onRename,
}: {
  doc: Document;
  onView: () => void;
  onRename: () => void;
}) {
  const ft = doc.file_type?.toLowerCase();
  const isDoc = ft === "docx";
  const isSheet = ft === "xlsx";
  const isPic = isPhoto(ft);

  let Icon: React.ReactNode;
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
  } else {
    iconBg = "bg-amber-100";
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
      aria-label={`View document ${displayName}`}
      className="rounded-xl border border-outline bg-white p-4 shadow-m3-1 cursor-pointer hover:bg-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <div className="flex items-center gap-4">
        <div className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${iconBg}`}>
          {Icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-medium text-black truncate">{displayName}</p>
          <p className="font-sans text-sm text-black/60">{formatDate(doc.created_at)}</p>
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

function RenameDialog({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-m3-2"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="rename-dialog-title" className="font-serif text-lg font-semibold text-black mb-4">
          Dokumentum átnevezése
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
