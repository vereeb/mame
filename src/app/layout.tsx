import type { Metadata } from "next";
import { Roboto, Lora } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Providers } from "@/components/Providers";
import { AccountButton } from "@/components/AccountButton";
import { HeaderNav } from "@/components/HeaderNav";
import { ProjectDropdown } from "@/components/ProjectDropdown";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileDrawer } from "@/components/MobileDrawer";
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
        <MobileBottomNav />

        {/* Mobile drawer overlay (for larger screens / drawer fallback) */}
        <MobileDrawer />
        </Providers>
      </body>
    </html>
  );
}

// --- Mobile Nav Trigger (visible on mobile as menu) ---
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
