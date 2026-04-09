"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useOwnerProjectPageAccess } from "@/hooks/useOwnerProjectPageAccess";
import { useEffectiveProjectScope } from "@/hooks/useEffectiveProjectScope";
import { useProject } from "@/contexts/ProjectContext";
import { PlannedCashflowTable } from "@/components/finance/PlannedCashflowTable";
import { ProjectPlannedCosts } from "@/components/finance/ProjectPlannedCosts";
import { InvoiceDocumentsSection } from "@/components/finance/InvoiceDocumentsSection";

function CollapsibleBlock({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;
  const headingId = `${id}-heading`;
  return (
    <section className="rounded-xl bg-surface-variant border border-outline overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-black/[0.04] transition-colors"
        aria-expanded={open}
        aria-controls={panelId}
        id={headingId}
      >
        <h3 className="font-serif font-medium text-black">{title}</h3>
        <span
          className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline bg-white text-black/70 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="px-4 pb-4 pt-0 border-t border-outline/70"
        >
          <div className="pt-3">{children}</div>
        </div>
      )}
    </section>
  );
}

export default function FinancePage() {
  const scope = useEffectiveProjectScope();
  const { accessibleProjects } = useProject();
  const { allowed, error } = useOwnerProjectPageAccess();
  const [laborOpen, setLaborOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [cashflowOpen, setCashflowOpen] = useState(false);

  const projectNameById = useMemo(
    () => Object.fromEntries(accessibleProjects.map((p) => [p.id, p.name])),
    [accessibleProjects]
  );

  if (scope.kind === "none") {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black mb-4">Pénzügy</h2>
        <p className="text-sm text-black/70 mb-6">
          Válassz egy projektet vagy az „Összes projekt” nézetet a folytatáshoz.
        </p>
      </div>
    );
  }

  if (scope.kind === "loading_all") {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black mb-4">Pénzügy</h2>
        <p className="text-sm text-black/70 mb-6">Projektek betöltése…</p>
      </div>
    );
  }

  if (allowed === null) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black mb-4">Pénzügy</h2>
        <p className="text-sm text-black/70 mb-6">Betöltés...</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black mb-4">Pénzügy</h2>
        <p className="text-sm text-black/70 mb-6">Csak a projekt `Owner` jogosultságával férhetsz hozzá.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h2 className="font-serif text-xl font-semibold text-black mb-2">Pénzügy</h2>
      {scope.kind === "all" ? (
        <p className="text-sm text-black/70 mb-6">
          Összesített nézet: a későbbi adatok minden olyan projektből jelennek meg, ahol Owner vagy. (Vázlat)
        </p>
      ) : (
        <p className="text-sm text-black/70 mb-6">
          Munkavállalók követése, költségek, számlák és Cashflow. (Vázlat)
        </p>
      )}
      <div className="space-y-4">
        <CollapsibleBlock
          id="finance-labor"
          title="Munkavállalók követése"
          open={laborOpen}
          onToggle={() => setLaborOpen((v) => !v)}
        >
          <p className="text-sm text-black/60">
            Nevek, napi bér, összes munka. Szűrés hónap/hét szerint.
          </p>
        </CollapsibleBlock>
        <CollapsibleBlock
          id="finance-costs"
          title="Költségek"
          open={costsOpen}
          onToggle={() => setCostsOpen((v) => !v)}
        >
          <ProjectPlannedCosts
            projectId={scope.kind === "single" ? scope.id : null}
          />
        </CollapsibleBlock>
        <CollapsibleBlock
          id="finance-invoices"
          title="Számlák"
          open={invoicesOpen}
          onToggle={() => setInvoicesOpen((v) => !v)}
        >
          {scope.kind === "single" || scope.kind === "all" ? (
            <InvoiceDocumentsSection scope={scope} projectNameById={projectNameById} />
          ) : null}
        </CollapsibleBlock>
        <CollapsibleBlock
          id="finance-cashflow"
          title="Cashflow (tervezett)"
          open={cashflowOpen}
          onToggle={() => setCashflowOpen((v) => !v)}
        >
          <PlannedCashflowTable scope={scope} projectNameById={projectNameById} />
        </CollapsibleBlock>
      </div>
    </div>
  );
}
