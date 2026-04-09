"use client";

import { useEffectiveProjectScope } from "@/hooks/useEffectiveProjectScope";
import { ProjectDashboardSummary } from "@/components/dashboard/ProjectDashboardSummary";

export default function DashboardPage() {
  const scope = useEffectiveProjectScope();

  let subtitle: string;
  if (scope.kind === "none") {
    subtitle = "Válassz egy projektet vagy az „Összes projekt” nézetet az összefoglalóhoz.";
  } else if (scope.kind === "loading_all") {
    subtitle = "Projektek betöltése…";
  } else if (scope.kind === "all") {
    subtitle = `Összesített nézet: ${scope.projects.length} elérhető projekt.`;
  } else {
    subtitle = "A kiválasztott projekt legfontosabb adatai.";
  }

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8">
      <h2 className="font-serif text-xl font-semibold text-black mb-2">Irányítópult</h2>
      <p className="text-sm text-black/70 mb-2">{subtitle}</p>
      {(scope.kind === "single" || scope.kind === "all") && <ProjectDashboardSummary scope={scope} />}
    </div>
  );
}
