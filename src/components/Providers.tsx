"use client";

import { ProjectProvider } from "@/contexts/ProjectContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ProjectProvider>{children}</ProjectProvider>;
}
