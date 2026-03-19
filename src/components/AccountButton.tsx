"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AppUser = {
  id: string;
  email?: string | null;
};

export function AccountButton() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const initials = useMemo(() => {
    const email = user?.email ?? "";
    const base = email.split("@")[0] || user?.id || "U";
    const parts = base.split(/[.\-_ ]+/).filter(Boolean);
    const first = parts[0]?.[0] ?? base[0] ?? "U";
    const second = parts[1]?.[0] ?? base[1] ?? "";
    return (first + second).toUpperCase();
  }, [user]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      setUser(null);
      return;
    }

    let subscription: { unsubscribe?: () => void } | null = null;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          setUser(null);
        } else {
          setUser((data.user ?? null) as unknown as AppUser | null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();

    // Keep user in sync with auth state.
    const res: any = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        setUser((session?.user ?? null) as unknown as AppUser | null);
      }
    );

    subscription = res?.data?.subscription ?? null;

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  async function logout() {
    const supabase = createClient();
    if (!supabase) return;
    setOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!user) {
            router.push("/login");
            return;
          }
          setOpen((v) => !v);
        }}
        disabled={loading}
        aria-label="Account menu"
        aria-expanded={open}
        title={user?.email ? "fiók" : "bejelentkezés"}
        className="md:inline-flex items-center gap-2 h-9 px-2.5 rounded-xl border border-outline bg-surface-variant text-black disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center font-sans text-sm font-semibold">
          {initials}
        </span>
        <span className="hidden md:block text-sm font-sans font-medium truncate max-w-[180px]">
          {user?.email ?? "Bejelentkezés"}
        </span>
      </button>

      {open && user && (
        <div
          role="menu"
          aria-label="Account actions"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-outline shadow-m3-2 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-outline">
            <div className="font-serif text-sm font-semibold text-black truncate">
              {user?.email ?? "Nincs bejelentkezve"}
            </div>
            <div className="font-sans text-xs text-black/60 truncate">
              {user?.id ?? ""}
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={logout}
              className="w-full h-10 rounded-xl font-sans text-sm font-medium text-black hover:bg-surface-variant active:bg-outline"
            >
              Kijelentkezés
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

