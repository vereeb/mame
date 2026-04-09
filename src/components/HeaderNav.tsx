"use client";

import Link from "next/link";
import { useOwnerOnlyNav } from "@/hooks/useOwnerOnlyNav";

type NavLinkItem = {
  href: string;
  label: string;
};

const BASE_LINKS: NavLinkItem[] = [
  { href: "/", label: "Kezdőlap" },
  { href: "/documents", label: "Dokumentumok" },
];

export function HeaderNav() {
  const { canViewOwnerOnlyPages, isSuperuser } = useOwnerOnlyNav();

  const ownerLinks: NavLinkItem[] = canViewOwnerOnlyPages
    ? [
        { href: "/calendar", label: "Naptár" },
        { href: "/finance", label: "Pénzügy" },
      ]
    : [];

  const links: NavLinkItem[] = [
    ...BASE_LINKS,
    ...ownerLinks,
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
