"use client";

import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useMunkanaploPageAccess } from "@/hooks/useMunkanaploPageAccess";
import { CollapsibleBlock } from "@/components/CollapsibleBlock";
import { EmbernapokMatrix } from "@/components/munkanaplo/EmbernapokMatrix";

export default function MunkanaploPage() {
  const { projectsDirectoryLoaded } = useProject();
  const { allowed, error } = useMunkanaploPageAccess();
  const [elorehaladasOpen, setElorehaladasOpen] = useState(true);
  const [embernapokOpen, setEmbernapokOpen] = useState(true);

  if (!projectsDirectoryLoaded || allowed === null) {
    return (
      <div className="p-4 md:p-6 pb-28 md:pb-8">
        <h2 className="font-serif text-xl font-semibold text-black mb-4">Munkanapló</h2>
        <p className="text-sm text-black/70 mb-6">Betöltés…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="p-4 md:p-6 pb-28 md:pb-8">
        <h2 className="font-serif text-xl font-semibold text-black mb-4">Munkanapló</h2>
        <p className="text-sm text-black/70 mb-6">
          Csak projekttulajdonosként (Owner) vagy rendszergazdaként érhető el.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8">
      <h2 className="font-serif text-xl font-semibold text-black mb-2">Munkanapló</h2>
      <p className="text-sm text-black/70 mb-6">
        A fejléc projektválasztójától függetlenül az összes saját tulajdonú „Saját projekt” adatait mutatja.
      </p>

      <div className="space-y-4">
        <CollapsibleBlock
          id="munkanaplo-elorehaladas"
          title="Előrehaladás"
          open={elorehaladasOpen}
          onToggle={() => setElorehaladasOpen((v) => !v)}
        >
          <p className="text-sm text-black/70">
            A projekt állapotának és teljesítésének követése.
          </p>
          <p className="mt-3 text-sm text-black/60">
            A részletes tartalom és rögzítés hamarosan elérhető lesz itt.
          </p>
        </CollapsibleBlock>

        <CollapsibleBlock
          id="munkanaplo-embernapok"
          title="Embernapok"
          open={embernapokOpen}
          onToggle={() => setEmbernapokOpen((v) => !v)}
        >
          <EmbernapokMatrix />
        </CollapsibleBlock>
      </div>
    </div>
  );
}
