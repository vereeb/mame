"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

type ProjectContextValue = {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);
const PROJECT_STORAGE_KEY = "promenade:selected-project-id";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState<string | null>(null);

  const setProjectId = useCallback((id: string | null) => {
    setProjectIdState(id);
  }, []);

  useEffect(() => {
    const savedProjectId = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (savedProjectId) {
      setProjectIdState(savedProjectId);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, projectId);
      return;
    }
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
  }, [projectId]);

  return (
    <ProjectContext.Provider value={{ projectId, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return ctx;
}
