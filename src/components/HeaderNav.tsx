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

    (async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const { data } = await supabase
        .from("profiles")
        .select("is_superuser")
        .eq("id", userId)
        .single();

      if (!cancelled) {
        setIsSuperuser(Boolean(data?.is_superuser));
      }
    })();

    return () => {
      cancelled = true;
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
