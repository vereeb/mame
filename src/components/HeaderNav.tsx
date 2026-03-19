"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/contexts/ProjectContext";

type NavLinkItem = {
  href: string;
  label: string;
};

const BASE_LINKS: NavLinkItem[] = [
  { href: "/", label: "Kezdőlap" },
  { href: "/documents", label: "Dokumentumok" },
  { href: "/calendar", label: "Naptár" },
];

export function HeaderNav() {
  const { projectId } = useProject();
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isOwnerForProject, setIsOwnerForProject] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const supabase = createClient();
    if (!supabase) return;

    async function loadSuperuserForUserId(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("is_superuser")
        .eq("id", userId)
        .single();

      if (!cancelled) setIsSuperuser(Boolean(data?.is_superuser));
    }

    async function loadInitial() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId =
          session?.user?.id ??
          (await supabase.auth.getUser()).data.user?.id ??
          null;

        if (!userId) {
          if (!cancelled) setIsSuperuser(false);
          if (!cancelled) setAuthUserId(null);
          return;
        }

        if (!cancelled) setAuthUserId(userId);
        await loadSuperuserForUserId(userId);
      } catch {
        if (!cancelled) setIsSuperuser(false);
        if (!cancelled) setAuthUserId(null);
      }
    }

    void loadInitial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) setIsSuperuser(false);
        if (!cancelled) setAuthUserId(null);
        return;
      }

      if (!cancelled) setAuthUserId(userId);
      void loadSuperuserForUserId(userId);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const supabase = createClient();
    if (!supabase) {
      setIsOwnerForProject(false);
      return;
    }

    if (!projectId || !authUserId) {
      setIsOwnerForProject(false);
      return;
    }

    void (async () => {
      const { data } = await supabase.rpc("user_has_project_access", {
        p_user_id: authUserId,
        p_project_id: projectId,
        p_min_role: "owner",
      });

      if (!cancelled) setIsOwnerForProject(Boolean(data));
    })();

    return () => {
      cancelled = true;
    };
  }, [authUserId, projectId]);

  const canViewFinance = isSuperuser || isOwnerForProject;

  const links: NavLinkItem[] = [
    ...BASE_LINKS,
    ...(canViewFinance ? [{ href: "/finance", label: "Pénzügy" }] : []),
    ...(isSuperuser ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="hidden md:flex items-center gap-1">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="px-3 py-2 rounded-lg text-sm font-medium text-black hover:bg-surface-variant hover:text-primary"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
