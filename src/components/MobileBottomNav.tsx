"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/contexts/ProjectContext";

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
    documents: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    calendar: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    finance: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return <>{icons[name] ?? null}</>;
}

function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center flex-1 h-full min-w-0 py-2 text-xs font-medium text-black hover:text-primary active:text-primary"
      aria-label={label}
    >
      <NavIcon name={icon} />
      <span className="mt-1 truncate max-w-full">{label}</span>
    </Link>
  );
}

export function MobileBottomNav() {
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
          if (!cancelled) {
            setIsSuperuser(false);
            setAuthUserId(null);
          }
          return;
        }

        if (!cancelled) setAuthUserId(userId);
        await loadSuperuserForUserId(userId);
      } catch {
        if (!cancelled) {
          setIsSuperuser(false);
          setAuthUserId(null);
        }
      }
    }

    void loadInitial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setIsSuperuser(false);
          setAuthUserId(null);
        }
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

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-outline safe-area-inset-bottom"
      aria-label="Fő navigáció"
    >
      <div className="flex items-center justify-around h-16">
        <NavLink href="/" label="Kezdőlap" icon="dashboard" />
        <NavLink href="/documents" label="Dokumentumok" icon="documents" />
        <NavLink href="/calendar" label="Naptár" icon="calendar" />
        {canViewFinance && <NavLink href="/finance" label="Pénzügy" icon="finance" />}
      </div>
    </nav>
  );
}

