"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NavLinkItem = {
  href: string;
  label: string;
};

const BASE_LINKS: NavLinkItem[] = [
  { href: "/", label: "Kezdőlap" },
  { href: "/documents", label: "Dokumentumok" },
  { href: "/calendar", label: "Naptár" },
  { href: "/finance", label: "Pénzügy" },
];

export function HeaderNav() {
  const [isSuperuser, setIsSuperuser] = useState(false);

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
          return;
        }

        await loadSuperuserForUserId(userId);
      } catch {
        if (!cancelled) setIsSuperuser(false);
      }
    }

    void loadInitial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) setIsSuperuser(false);
        return;
      }

      void loadSuperuserForUserId(userId);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const links = isSuperuser
    ? [...BASE_LINKS, { href: "/admin", label: "Admin" }]
    : BASE_LINKS;

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
