"use client";

import type { ReactNode } from "react";

export function CollapsibleBlock({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;
  const headingId = `${id}-heading`;
  return (
    <section className="rounded-xl bg-surface-variant border border-outline overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-black/[0.04] transition-colors"
        aria-expanded={open}
        aria-controls={panelId}
        id={headingId}
      >
        <h3 className="font-serif font-medium text-black">{title}</h3>
        <span
          className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline bg-white text-black/70 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="px-4 pb-4 pt-0 border-t border-outline/70"
        >
          <div className="pt-3">{children}</div>
        </div>
      )}
    </section>
  );
}
