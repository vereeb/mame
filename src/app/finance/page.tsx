export default function FinancePage() {
  return (
    <div className="p-4 md:p-6">
      <h2 className="font-serif text-xl font-semibold text-black mb-4">
        Finance
      </h2>
      <p className="text-sm text-black/70 mb-6">
        Laborer tracking, expense tracking, and invoices. (Placeholder)
      </p>
      <div className="space-y-4">
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">Laborer Tracking</h3>
          <p className="text-sm text-black/60">Names, daily wages, total work. Filter by month/week.</p>
        </section>
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">Expenses</h3>
          <p className="text-sm text-black/60">Materials and Services categories.</p>
        </section>
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">Invoices</h3>
          <p className="text-sm text-black/60">Billing status tracking.</p>
        </section>
      </div>
    </div>
  );
}
