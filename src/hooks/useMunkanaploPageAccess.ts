"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { userHasOwnerRoleAnywhere } from "@/lib/ownerAccess";

/**
 * Munkanapló: allowed for superuser or if the user is Owner on at least one
 * project — independent of the header project dropdown selection.
 */
export function useMunkanaploPageAccess() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setError("A Supabase nincs beállítva");
          setAllowed(false);
        }
        return;
      }

      if (!cancelled) {
        setError(null);
        setAllowed(null);
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
        if (!userId) {
          if (!cancelled) setAllowed(false);
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_superuser")
          .eq("id", userId)
          .single();

        if (Boolean(profileData?.is_superuser)) {
          if (!cancelled) setAllowed(true);
          return;
        }

        const ok = await userHasOwnerRoleAnywhere(supabase, userId);
        if (!cancelled) setAllowed(ok);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Hozzáférés ellenőrzése sikertelen");
          setAllowed(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { allowed, error };
}
