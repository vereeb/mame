import type { Metadata } from "next";
import { Roboto, Lora } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Providers } from "@/components/Providers";
import { AccountButton } from "@/components/AccountButton";
import { HeaderNav } from "@/components/HeaderNav";
import { ProjectDropdown } from "@/components/ProjectDropdown";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lora",
});

export const metadata: Metadata = {
  title: "Mame",
  description: "Mobil-first építésmenedzsment webalkalmazás",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${lora.variable}`}
    >
      <body className="min-h-screen flex flex-col">
        <Providers>
        {/* Sticky Header with Project Dropdown */}
        <header className="sticky top-0 z-50 w-full bg-white border-b border-outline shadow-m3-1">
          <div className="flex items-center justify-between h-14 px-4 gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link href="/" className="shrink-0" aria-label="Promenade home">
                <Image
                  src="/logo.png"
                  alt="Promenade logo"
                  width={120}
                  height={28}
                  priority
                  className="hidden h-7 w-auto md:block"
                />
                <Image
                  src="/icon.png"
                  alt="Promenade icon"
                  width={28}
                  height={28}
                  priority
                  className="block h-7 w-7 md:hidden"
                />
              </Link>
              <ProjectDropdown />
            </div>
            <HeaderNav />
            <AccountButton />
            <MobileNavTrigger />
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 flex flex-col pb-20 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom navigation (thumb-friendly) */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-outline safe-area-inset-bottom"
          aria-label="Fő navigáció"
        >
          <div className="flex items-center justify-around h-16">
            <NavLink href="/" label="Kezdőlap" icon="dashboard" />
            <NavLink href="/documents" label="Dokumentumok" icon="documents" />
            <NavLink href="/calendar" label="Naptár" icon="calendar" />
            <NavLink href="/finance" label="Pénzügy" icon="finance" />
          </div>
        </nav>

        {/* Mobile drawer overlay (for larger screens / drawer fallback) */}
        <MobileDrawer />
        </Providers>
      </body>
    </html>
  );
}

// --- Mobile Nav Trigger (visible on desktop as menu) ---
function MobileNavTrigger() {
  return (
    <button
      type="button"
      className="md:hidden p-2 -mr-2 rounded-full text-black hover:bg-surface-variant active:bg-outline"
      aria-label="Menü megnyitása"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  );
}

// --- Mobile Bottom Nav Link ---
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

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    documents: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    calendar: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    finance: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };
  return <>{icons[name] ?? null}</>;
}

// --- Mobile Drawer (slide-out panel) ---
function MobileDrawer() {
  return (
    <aside
      id="mobile-drawer"
      className="hidden fixed inset-y-0 right-0 z-50 w-72 bg-white border-l border-outline shadow-m3-2 transform translate-x-full transition-transform duration-200 ease-out"
      aria-hidden="true"
    >
      <div className="flex flex-col h-full pt-14">
        <div className="p-4 border-b border-outline">
          <span className="font-serif text-sm font-semibold text-black">
            Menü
          </span>
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
        </nav>
      </div>
    </aside>
  );
}
