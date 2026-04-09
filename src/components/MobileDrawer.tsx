"use client";

import Link from "next/link";
import { useOwnerOnlyNav } from "@/hooks/useOwnerOnlyNav";

export function MobileDrawer() {
  const { canViewOwnerOnlyPages, canViewMunkanaploNav } = useOwnerOnlyNav();

  return (
    <aside
      id="mobile-drawer"
      className="hidden fixed inset-y-0 right-0 z-50 w-72 bg-white border-l border-outline shadow-m3-2 transform translate-x-full transition-transform duration-200 ease-out"
      aria-hidden="true"
    >
      <div className="flex flex-col h-full pt-14">
        <div className="p-4 border-b border-outline">
          <span className="font-serif text-sm font-semibold text-black">Menü</span>
        </div>
        <nav className="flex flex-col p-4 gap-1">
          <Link
            href="/"
            className="px-4 py-3 rounded-lg text-sm font-medium text-black hover:bg-surface-variant"
          >
            Kezdőlap
          </Link>
          <Link
            href="/documents"
            className="px-4 py-3 rounded-lg text-sm font-medium text-black hover:bg-surface-variant"
          >
            Dokumentumok
          </Link>
          {canViewMunkanaploNav && (
            <Link
              href="/munkanaplo"
              className="px-4 py-3 rounded-lg text-sm font-medium text-black hover:bg-surface-variant"
            >
              Munkanapló
            </Link>
          )}
          {canViewOwnerOnlyPages && (
            <>
              <Link
                href="/calendar"
                className="px-4 py-3 rounded-lg text-sm font-medium text-black hover:bg-surface-variant"
              >
                Naptár
              </Link>
              <Link
                href="/finance"
                className="px-4 py-3 rounded-lg text-sm font-medium text-black hover:bg-surface-variant"
              >
                Pénzügy
              </Link>
            </>
          )}
        </nav>
      </div>
    </aside>
  );
}
