"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/contexts/ProjectContext";

export default function FinancePage() {
  const { projectId } = useProject();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!projectId) {
        setAllowed(false);
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        setError("A Supabase nincs beállítva");
        setAllowed(false);
        return;
      }

      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
        if (!userId) {
          setAllowed(false);
          return;
        }

        // Superuser override.
        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_superuser")
          .eq("id", userId)
          .single();

        if (Boolean(profileData?.is_superuser)) {
          if (!cancelled) setAllowed(true);
          return;
        }

        const { data: ownerOk } = await supabase.rpc("user_has_project_access", {
          p_user_id: userId,
          p_project_id: projectId,
          p_min_role: "owner",
        });

        if (!cancelled) setAllowed(Boolean(ownerOk));
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Hozzáférés ellenőrzése sikertelen");
          setAllowed(false);
        }
      }
    }

    void loadAccess();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black mb-4">Pénzügy</h2>
        <p className="text-sm text-black/70 mb-6">Válassz egy projektet a folytatáshoz.</p>
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
      <h2 className="font-serif text-xl font-semibold text-black mb-4">Pénzügy</h2>
      <p className="text-sm text-black/70 mb-6">
        Munkavállalók követése, költségek és számlák. (Vázlat)
      </p>
      <div className="space-y-4">
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">Munkavállalók követése</h3>
          <p className="text-sm text-black/60">
            Nevek, napi bér, összes munka. Szűrés hónap/hét szerint.
          </p>
        </section>
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">Költségek</h3>
          <p className="text-sm text-black/60">
            Anyagok és szolgáltatások kategóriái.
          </p>
        </section>
        <section className="p-4 rounded-xl bg-surface-variant border border-outline">
          <h3 className="font-serif font-medium text-black mb-2">Számlák</h3>
          <p className="text-sm text-black/60">Számlázási státusz követése.</p>
        </section>
      </div>
    </div>
  );
}
