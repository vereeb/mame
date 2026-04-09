"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type SetStateAction,
} from "react";

export type AccessibleProject = { id: string; name: string };

type ProjectContextValue = {
  projectId: string | null;
  setProjectId: (value: SetStateAction<string | null>) => void;
  /** From the last successful projects directory fetch (RLS-scoped). */
  accessibleProjects: AccessibleProject[];
  /** False until ProjectDropdown finishes a fetch cycle (call `markProjectsDirectoryStale` when starting). */
  projectsDirectoryLoaded: boolean;
  setProjectsFromDirectory: (projects: AccessibleProject[]) => void;
  markProjectsDirectoryStale: () => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);
const PROJECT_STORAGE_KEY = "promenade:selected-project-id";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState<string | null>(null);
  const [accessibleProjects, setAccessibleProjects] = useState<AccessibleProject[]>([]);
  const [projectsDirectoryLoaded, setProjectsDirectoryLoaded] = useState(false);

  const setProjectId = useCallback((value: SetStateAction<string | null>) => {
    setProjectIdState(value);
  }, []);

  const markProjectsDirectoryStale = useCallback(() => {
    setProjectsDirectoryLoaded(false);
  }, []);

  const setProjectsFromDirectory = useCallback((projects: AccessibleProject[]) => {
    setAccessibleProjects(projects);
    setProjectsDirectoryLoaded(true);
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
    <ProjectContext.Provider
      value={{
        projectId,
        setProjectId,
        accessibleProjects,
        projectsDirectoryLoaded,
        setProjectsFromDirectory,
        markProjectsDirectoryStale,
      }}
    >
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
