"use client";

import { useEffectiveProjectScope } from "@/hooks/useEffectiveProjectScope";

export default function DashboardPage() {
  const scope = useEffectiveProjectScope();

  let subtitle: string;
  if (scope.kind === "none") {
    subtitle = "Válassz egy projektet vagy az „Összes projekt” nézetet az összefoglalóhoz.";
  } else if (scope.kind === "loading_all") {
    subtitle = "Projektek betöltése…";
  } else if (scope.kind === "all") {
    subtitle = `Összesített nézet: ${scope.projects.length} elérhető projekt. (Vázlat)`;
  } else {
    subtitle = "Összefoglaló a kiválasztott projekthez. (Vázlat)";
  }

  return (
    <div className="p-4 md:p-6">
      <h2 className="font-serif text-xl font-semibold text-black mb-4">Irányítópult</h2>
      <p className="text-sm text-black/70">{subtitle}</p>
    </div>
  );
}
