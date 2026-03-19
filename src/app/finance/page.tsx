export default function FinancePage() {
  return (
    <div className="p-4 md:p-6">
      <h2 className="font-serif text-xl font-semibold text-black mb-4">
        Pénzügy
      </h2>
      <p className="text-sm text-black/70 mb-6">
        Munkavállalók követése, költségek és számlák. (Vázlat)
      </p>
      <div className="space-y-4">
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">
            Munkavállalók követése
          </h3>
          <p className="text-sm text-black/60">
            Nevek, napi bér, összes munka. Szűrés hónap/hét szerint.
          </p>
        </section>
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">
            Költségek
          </h3>
          <p className="text-sm text-black/60">
            Anyagok és szolgáltatások kategóriái.
          </p>
        </section>
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">
            Számlák
          </h3>
          <p className="text-sm text-black/60">
            Számlázási státusz követése.
          </p>
        </section>
      </div>
    </div>
  );
}
