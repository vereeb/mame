/** Sentinel value for "aggregate across all accessible projects" in the project dropdown. */
export const ALL_PROJECTS_VALUE = "__all__";

export function isAllProjects(projectId: string | null | undefined): boolean {
  return projectId === ALL_PROJECTS_VALUE;
}
