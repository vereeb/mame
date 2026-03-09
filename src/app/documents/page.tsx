export default function DocumentsPage() {
  return (
    <div className="p-4 md:p-6">
      <h2 className="font-serif text-xl font-semibold text-black mb-4">
        Documents
      </h2>
      <p className="text-sm text-black/70 mb-8">
        List of .docx and .xlsx files. (Placeholder)
      </p>
      {/* FAB for Upload - will be wired in a later task */}
      <button
        type="button"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-primary text-black shadow-m3-fab flex items-center justify-center hover:bg-primary-600 active:scale-95 transition"
        aria-label="Upload document"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
