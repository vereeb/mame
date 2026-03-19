"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/documents");
  }

  return (
    <div className="p-4 md:p-6 max-w-md mx-auto">
      <h1 className="font-serif text-2xl font-semibold text-black mb-4">Bejelentkezés</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full h-11 px-4 rounded-xl border border-outline bg-surface-variant font-sans text-sm text-black"
          placeholder="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="w-full h-11 px-4 rounded-xl border border-outline bg-surface-variant font-sans text-sm text-black"
          placeholder="Jelszó"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 font-sans text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-primary text-black font-sans font-medium disabled:opacity-60"
        >
          {loading ? "Bejelentkezés..." : "Bejelentkezés"}
        </button>
      </form>
    </div>
  );
}