"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AdminSection = "projects" | "laborers" | "subcontractors";
type ProjectKind = "Sajat projekt" | "Alvallalkozo";
type Project = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  project_kind: ProjectKind;
};
type Laborer = { id: string; name: string; daily_wage: number; email: string | null };
type LaborerRole = "owner" | "admin" | "member" | "viewer";
type ProjectLaborerMember = { project_id: string; laborer_id: string; role: LaborerRole };
type ProjectSubcontractorMember = { project_id: string; subcontractor_id: string };
type Subcontractor = {
  id: string;
  company_name: string;
  specialty: string;
  tax_number: string | null;
  registered_office: string | null;
  email: string;
};
const SUBCONTRACTOR_SPECIALTIES = [
  "szerkezet",
  "generál",
  "alapozás",
  "földmunka",
  "geodézia",
  "FMV",
] as const;

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [section, setSection] = useState<AdminSection>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [laborers, setLaborers] = useState<Laborer[]>([]);
  const [memberships, setMemberships] = useState<ProjectLaborerMember[]>([]);
  const [subcontractorMemberships, setSubcontractorMemberships] = useState<ProjectSubcontractorMember[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [subcontractorsWarning, setSubcontractorsWarning] = useState<string | null>(null);
  const [subcontractorAssignmentsWarning, setSubcontractorAssignmentsWarning] = useState<string | null>(null);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [editingProjectKind, setEditingProjectKind] = useState<ProjectKind>("Sajat projekt");
  const [savingProjectEdit, setSavingProjectEdit] = useState(false);
  // projectId -> laborerId -> role
  const [selectedByProject, setSelectedByProject] = useState<
    Record<string, Record<string, LaborerRole>>
  >({});
  const [selectedSubcontractorsByProject, setSelectedSubcontractorsByProject] = useState<Record<string, string[]>>({});

  const [newLaborerName, setNewLaborerName] = useState("");
  const [newLaborerDailyWage, setNewLaborerDailyWage] = useState("");
  const [newLaborerEmail, setNewLaborerEmail] = useState("");
  
  const [creatingLaborer, setCreatingLaborer] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectAddress, setNewProjectAddress] = useState("");
  const [newProjectKind, setNewProjectKind] = useState<ProjectKind>("Sajat projekt");
  const [creatingProject, setCreatingProject] = useState(false);
  const [editingLaborerId, setEditingLaborerId] = useState<string | null>(null);
  const [editingLaborerName, setEditingLaborerName] = useState("");
  const [editingLaborerDailyWage, setEditingLaborerDailyWage] = useState("");
  const [editingLaborerEmail, setEditingLaborerEmail] = useState("");
  const [savingLaborerEdit, setSavingLaborerEdit] = useState(false);
  const [newSubcontractorCompanyName, setNewSubcontractorCompanyName] = useState("");
  const [newSubcontractorSpecialties, setNewSubcontractorSpecialties] = useState<string[]>([]);
  const [specialtiesOpen, setSpecialtiesOpen] = useState(false);
  const [newSubcontractorTaxNumber, setNewSubcontractorTaxNumber] = useState("");
  const [newSubcontractorRegisteredOffice, setNewSubcontractorRegisteredOffice] = useState("");
  const [newSubcontractorEmail, setNewSubcontractorEmail] = useState("");
  const [creatingSubcontractor, setCreatingSubcontractor] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) {
          if (!cancelled) setIsSuperuser(false);
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("is_superuser")
          .eq("id", userId)
          .single();

        const superuser = Boolean(data?.is_superuser);
        if (!cancelled) {
          setIsSuperuser(superuser);
        }

        if (superuser) {
          const [
            { data: projectsData, error: projectsErr },
            { data: laborersData, error: laborersErr },
            { data: membershipData, error: membershipErr },
          ] = await Promise.all([
            supabase
              .from("projects")
              .select("id, name, description, address, project_kind")
              .order("name"),
            supabase.from("laborers").select("id, name, daily_wage, email").order("name"),
            supabase
              .from("project_laborer_members")
              .select("project_id, laborer_id, role"),
          ]);

          if (projectsErr) throw new Error(projectsErr.message);
          if (laborersErr) throw new Error(laborersErr.message);
          if (membershipErr) throw new Error(membershipErr.message);

          if (!cancelled) {
            const allProjects = (projectsData ?? []) as Project[];
            const allLaborers = (laborersData ?? []) as Laborer[];
            const allMemberships = (membershipData ?? []) as ProjectLaborerMember[];
            setProjects(allProjects);
            setLaborers(allLaborers);
            setMemberships(allMemberships);
            setSubcontractorsWarning(null);

            const nextSelectedByProject: Record<string, Record<string, LaborerRole>> = {};
            allProjects.forEach((p) => {
              const perProject: Record<string, LaborerRole> = {};
              allMemberships
                .filter((m) => m.project_id === p.id)
                .forEach((m) => {
                  perProject[m.laborer_id] = m.role;
                });
              nextSelectedByProject[p.id] = perProject;
            });
            setSelectedByProject(nextSelectedByProject);
          }

          const { data: subcontractorsData, error: subcontractorsErr } = await supabase
            .from("subcontractors")
            .select("id, company_name, specialty, tax_number, registered_office, email")
            .order("company_name");

          if (!cancelled) {
            if (subcontractorsErr) {
              setSubcontractors([]);
              setSubcontractorsWarning(
                "Az alvállalkozók táblázat még nem elérhető. Futtasd a Supabase migrációkat a szekció engedélyezéséhez."
              );
              setSubcontractorMemberships([]);
              setSelectedSubcontractorsByProject({});
              setSubcontractorAssignmentsWarning(null);
            } else {
              setSubcontractors((subcontractorsData ?? []) as Subcontractor[]);
              setSubcontractorsWarning(null);

              const { data: subMembershipData, error: subMembershipErr } = await supabase
                .from("project_subcontractor_members")
                .select("project_id, subcontractor_id");

              if (subMembershipErr) {
                setSubcontractorMemberships([]);
                setSelectedSubcontractorsByProject({});
                setSubcontractorAssignmentsWarning(
                  "A projekt-alvállalkozó hozzárendelések még nem elérhetők. Futtasd a Supabase migrációkat a szekció engedélyezéséhez."
                );
              } else {
                const allSubMemberships = (subMembershipData ?? []) as ProjectSubcontractorMember[];
                setSubcontractorMemberships(allSubMemberships);
                setSubcontractorAssignmentsWarning(null);
                const nextSelectedSubcontractorsByProject: Record<string, string[]> = {};
                projectsData?.forEach((p: any) => {
                  nextSelectedSubcontractorsByProject[p.id] = allSubMemberships
                    .filter((m) => m.project_id === p.id)
                    .map((m) => m.subcontractor_id);
                });
                setSelectedSubcontractorsByProject(nextSelectedSubcontractorsByProject);
              }
            }
          }
        }
      } catch (e: any) {
        if (!cancelled)
          setScreenError(e?.message ?? "Admin adatok betöltése sikertelen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProjectLaborers(projectId: string) {
    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setScreenError(null);
    setSavingProjectId(projectId);

    const currentlyAssigned = memberships
      .filter((m) => m.project_id === projectId)
      .map((m) => m.laborer_id);
    const selectedRoles = selectedByProject[projectId] ?? {};
    const selected = Object.keys(selectedRoles);

    const toAdd = selected.filter((id) => !currentlyAssigned.includes(id));
    const toRemove = currentlyAssigned.filter((id) => !selected.includes(id));

    try {
      if (toAdd.length > 0) {
        const rows = toAdd.map((laborerId) => ({
          project_id: projectId,
          laborer_id: laborerId,
          role: selectedRoles[laborerId] ?? "member",
        }));
        const { error } = await supabase.from("project_laborer_members").insert(rows);
        if (error) throw error;
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("project_laborer_members")
          .delete()
          .eq("project_id", projectId)
          .in("laborer_id", toRemove);
        if (error) throw error;
      }

      const { data: refreshedMemberships, error: refreshErr } = await supabase
        .from("project_laborer_members")
        .select("project_id, laborer_id, role");
      if (refreshErr) throw refreshErr;
      setMemberships((refreshedMemberships ?? []) as ProjectLaborerMember[]);
    } catch (e: any) {
      setScreenError(e?.message ?? "Projekt tagok mentése sikertelen");
    } finally {
      setSavingProjectId(null);
    }
  }

  async function deleteProject(project: Project) {
    const typedName = window.prompt(
      `A törlés megerősítéséhez írd be pontosan a következőt: "${project.name}". A művelet törli a kapcsolódó munkavállalókat, dokumentumokat és hozzárendeléseket is.`
    );
    if (typedName !== project.name) {
      if (typedName !== null) {
        setScreenError("A megadott projekt név nem egyezik. A törlés megszakítva.");
      }
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setScreenError(null);
    setDeletingProjectId(project.id);
    try {
      const { error } = await supabase.from("projects").delete().eq("id", project.id);
      if (error) throw error;

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setSelectedByProject((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      setSelectedSubcontractorsByProject((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      setMemberships((prev) => prev.filter((m) => m.project_id !== project.id));
      setSubcontractorMemberships((prev) => prev.filter((m) => m.project_id !== project.id));
    } catch (e: any) {
      setScreenError(e?.message ?? "Projekt törlése sikertelen");
    } finally {
      setDeletingProjectId(null);
    }
  }

  async function addLaborer() {
    if (!newLaborerName.trim()) return;
    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setCreatingLaborer(true);
    setScreenError(null);
    try {
      const wage = Number(newLaborerDailyWage || 0);
      const { data, error } = await supabase
        .from("laborers")
        .insert({
          name: newLaborerName.trim(),
          daily_wage: Number.isFinite(wage) ? wage : 0,
          email: newLaborerEmail.trim() || null,
        })
        .select("id, name, daily_wage, email")
        .single();
      if (error) throw error;

      setLaborers((prev) => [...prev, data as Laborer].sort((a, b) => a.name.localeCompare(b.name)));
      setNewLaborerName("");
      setNewLaborerDailyWage("");
      setNewLaborerEmail("");
    } catch (e: any) {
      setScreenError(e?.message ?? "Munkavállaló hozzáadása sikertelen");
    } finally {
      setCreatingLaborer(false);
    }
  }

  async function addProject() {
    if (!newProjectName.trim()) return;
    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setCreatingProject(true);
    setScreenError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Jelentkezz be szuperfelhasználóként");

      const { data: projectInsert, error: projectErr } = await supabase
        .from("projects")
        .insert({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
          address: newProjectAddress.trim() || null,
          project_kind: newProjectKind,
        })
        .select("id, name, description, address, project_kind")
        .single();
      if (projectErr) throw projectErr;

      const newProject = projectInsert as Project;

      const { error: memberErr } = await supabase.from("project_members").insert({
        project_id: newProject.id,
        user_id: userId,
        role: "owner",
      });
      if (memberErr) throw memberErr;

      setProjects((prev) => [...prev, newProject].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedByProject((prev) => ({ ...prev, [newProject.id]: [] }));
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectAddress("");
      setNewProjectKind("Sajat projekt");
    } catch (e: any) {
      setScreenError(e?.message ?? "Projekt létrehozása sikertelen");
    } finally {
      setCreatingProject(false);
    }
  }

  function startEditLaborer(laborer: Laborer) {
    setEditingLaborerId(laborer.id);
    setEditingLaborerName(laborer.name);
    setEditingLaborerDailyWage(String(laborer.daily_wage ?? 0));
    setEditingLaborerEmail(laborer.email ?? "");
  }

  function cancelEditLaborer() {
    setEditingLaborerId(null);
    setEditingLaborerName("");
    setEditingLaborerDailyWage("");
    setEditingLaborerEmail("");
  }

  async function saveEditLaborer() {
    if (!editingLaborerId || !editingLaborerName.trim()) return;
    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setScreenError(null);
    setSavingLaborerEdit(true);
    try {
      const wage = Number(editingLaborerDailyWage || 0);
      const { data, error } = await supabase
        .from("laborers")
        .update({
          name: editingLaborerName.trim(),
          daily_wage: Number.isFinite(wage) ? wage : 0,
          email: editingLaborerEmail.trim() || null,
        })
        .eq("id", editingLaborerId)
        .select("id, name, daily_wage, email")
        .single();

      if (error) throw error;

      const updated = data as Laborer;
      setLaborers((prev) =>
        prev
          .map((l) => (l.id === editingLaborerId ? updated : l))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      cancelEditLaborer();
    } catch (e: any) {
      setScreenError(e?.message ?? "Munkavállaló frissítése sikertelen");
    } finally {
      setSavingLaborerEdit(false);
    }
  }

  async function deleteLaborer(laborer: Laborer) {
    const confirmed = window.confirm(
      `Törli a munkavállalót: "${laborer.name}"? A művelet törli a kapcsolódó munkaidő-bejegyzéseket és hozzárendeléseket is.`
    );
    if (!confirmed) return;

    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setScreenError(null);
    try {
      const { error } = await supabase.from("laborers").delete().eq("id", laborer.id);
      if (error) throw error;

      setLaborers((prev) => prev.filter((l) => l.id !== laborer.id));
      setMemberships((prev) => prev.filter((m) => m.laborer_id !== laborer.id));
      if (editingLaborerId === laborer.id) {
        cancelEditLaborer();
      }
    } catch (e: any) {
      setScreenError(e?.message ?? "Munkavállaló törlése sikertelen");
    }
  }

  function startEditProject(project: Project) {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
    setEditingProjectKind(project.project_kind);
  }

  function cancelEditProject() {
    setEditingProjectId(null);
    setEditingProjectName("");
    setEditingProjectKind("Sajat projekt");
  }

  async function saveEditProject() {
    if (!editingProjectId || !editingProjectName.trim()) return;
    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setSavingProjectEdit(true);
    setScreenError(null);
    try {
      const { data, error } = await supabase
        .from("projects")
        .update({
          name: editingProjectName.trim(),
          project_kind: editingProjectKind,
        })
        .eq("id", editingProjectId)
        .select("id, name, description, address, project_kind")
        .single();
      if (error) throw error;

      const updatedProject = data as Project;
      setProjects((prev) =>
        prev
          .map((p) => (p.id === editingProjectId ? updatedProject : p))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      cancelEditProject();
    } catch (e: any) {
      setScreenError(e?.message ?? "Projekt frissítése sikertelen");
    } finally {
      setSavingProjectEdit(false);
    }
  }

  async function addSubcontractor() {
    if (
      !newSubcontractorCompanyName.trim() ||
      newSubcontractorSpecialties.length === 0 ||
      !newSubcontractorEmail.trim()
    ) {
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setCreatingSubcontractor(true);
    setScreenError(null);
    try {
      const { data, error } = await supabase
        .from("subcontractors")
        .insert({
          company_name: newSubcontractorCompanyName.trim(),
          specialty: newSubcontractorSpecialties.join(", "),
          tax_number: newSubcontractorTaxNumber.trim() || null,
          registered_office: newSubcontractorRegisteredOffice.trim() || null,
          email: newSubcontractorEmail.trim(),
        })
        .select("id, company_name, specialty, tax_number, registered_office, email")
        .single();
      if (error) throw error;

      setSubcontractors((prev) =>
        [...prev, data as Subcontractor].sort((a, b) =>
          a.company_name.localeCompare(b.company_name)
        )
      );
      setNewSubcontractorCompanyName("");
      setNewSubcontractorSpecialties([]);
      setSpecialtiesOpen(false);
      setNewSubcontractorTaxNumber("");
      setNewSubcontractorRegisteredOffice("");
      setNewSubcontractorEmail("");
    } catch (e: any) {
      setScreenError(e?.message ?? "Alvállalkozó hozzáadása sikertelen");
    } finally {
      setCreatingSubcontractor(false);
    }
  }

  async function saveProjectSubcontractors(projectId: string) {
    const supabase = createClient();
    if (!supabase) {
      setScreenError("A Supabase nincs beállítva");
      return;
    }

    setScreenError(null);
    setSavingProjectId(projectId);

    const currentlyAssigned = subcontractorMemberships
      .filter((m) => m.project_id === projectId)
      .map((m) => m.subcontractor_id);
    const selected = selectedSubcontractorsByProject[projectId] ?? [];

    const toAdd = selected.filter((id) => !currentlyAssigned.includes(id));
    const toRemove = currentlyAssigned.filter((id) => !selected.includes(id));

    try {
      if (toAdd.length > 0) {
        const rows = toAdd.map((subcontractorId) => ({
          project_id: projectId,
          subcontractor_id: subcontractorId,
        }));
        const { error } = await supabase.from("project_subcontractor_members").insert(rows);
        if (error) throw error;
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("project_subcontractor_members")
          .delete()
          .eq("project_id", projectId)
          .in("subcontractor_id", toRemove);
        if (error) throw error;
      }

      const { data: refreshedMemberships, error: refreshErr } = await supabase
        .from("project_subcontractor_members")
        .select("project_id, subcontractor_id");
      if (refreshErr) throw refreshErr;
      setSubcontractorMemberships((refreshedMemberships ?? []) as ProjectSubcontractorMember[]);
    } catch (e: any) {
      setScreenError(e?.message ?? "Projekt-alvállalkozó hozzárendelések mentése sikertelen");
    } finally {
      setSavingProjectId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black">Admin</h2>
        <p className="mt-2 font-sans text-sm text-black/60">Betöltés...</p>
      </div>
    );
  }

  if (!isSuperuser) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-black">Admin</h2>
        <p className="mt-2 font-sans text-sm text-black/70">
          Nincs jogosultságod ehhez az oldalhoz.
        </p>
      </div>
    );
  }

  const menuItems: Array<{ key: AdminSection; label: string }> = [
    { key: "projects", label: "Projektek" },
    { key: "laborers", label: "Munkavállalók" },
    { key: "subcontractors", label: "Alvállalkozók" },
  ];

  return (
    <div className="p-4 md:p-6">
      <h2 className="font-serif text-xl font-semibold text-black">Admin</h2>
      <p className="mt-2 font-sans text-sm text-black/70">
        Superuser area for managing global administration tasks.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-[220px,1fr] gap-4">
        <aside className="rounded-xl border border-outline bg-white shadow-m3-1 p-2 h-fit">
          <nav className="flex md:flex-col gap-2" aria-label="Admin sections">
            {menuItems.map((item) => {
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={`px-4 py-2.5 rounded-lg text-left font-sans text-sm font-medium transition ${
                    active
                      ? "bg-primary text-black"
                      : "text-black/80 hover:bg-surface-variant"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="rounded-xl border border-outline bg-white shadow-m3-1 p-4 md:p-5">
          {screenError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 font-sans text-sm">
              {screenError}
            </div>
          )}

          {section === "projects" && (
            <>
              <h3 className="font-serif text-lg font-semibold text-black">Projektek</h3>
              <p className="mt-2 font-sans text-sm text-black/70">
                Ha a projekt típusa „Saját projekt”, akkor munkavállalókat rendelsz hozzá. Ha „Alvállalkozó”, akkor alvállalkozókat.
              </p>
              {subcontractorAssignmentsWarning && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 text-amber-800 font-sans text-sm">
                  {subcontractorAssignmentsWarning}
                </div>
              )}

              <div className="mt-4 space-y-4">
                {projects.length === 0 && (
                  <p className="font-sans text-sm text-black/60">
                    Nem található projekt.
                  </p>
                )}

                {projects.map((project) => {
                  const selectedRoles = selectedByProject[project.id] ?? {};
                  const selectedSubcontractors = selectedSubcontractorsByProject[project.id] ?? [];
                  const isEditing = editingProjectId === project.id;
                  const effectiveProjectKind = isEditing ? editingProjectKind : project.project_kind;
                  const isSubcontractorProject = effectiveProjectKind === "Alvallalkozo";
                  return (
                    <div
                      key={project.id}
                      className="rounded-xl border border-outline bg-surface p-4"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                          {isEditing ? (
                            <input
                              value={editingProjectName}
                              onChange={(e) => setEditingProjectName(e.target.value)}
                              className="h-10 flex-1 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          ) : (
                            <div className="font-sans text-sm font-semibold text-black">
                              {project.name}
                            </div>
                          )}
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => startEditProject(project)}
                              className="h-8 px-3 rounded-md border border-outline text-xs font-medium text-black hover:bg-surface-variant"
                            >
                              Szerkesztés
                            </button>
                          )}
                        </div>
                        <div>
                          {isEditing ? (
                            <select
                              value={editingProjectKind}
                              onChange={(e) => setEditingProjectKind(e.target.value as ProjectKind)}
                              className="h-9 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              <option value="Sajat projekt">Saját projekt</option>
                              <option value="Alvallalkozo">Alvállalkozó</option>
                            </select>
                          ) : (
                            <span className="inline-flex h-7 items-center px-3 rounded-full bg-surface-variant text-xs font-sans font-medium text-black/80">
                              {project.project_kind === "Sajat projekt"
                                ? "Saját projekt"
                                : "Alvállalkozó"}
                            </span>
                          )}
                        </div>
                        <div
                          className="w-full max-h-56 overflow-auto rounded-lg border border-outline bg-white p-2"
                          aria-label={`Select laborers for ${project.name}`}
                        >
                          {!isSubcontractorProject && laborers.length === 0 && (
                            <p className="px-2 py-1 font-sans text-sm text-black/60">
                              Nincsenek munkavállalók.
                            </p>
                          )}
                          {isSubcontractorProject && subcontractors.length === 0 && (
                            <p className="px-2 py-1 font-sans text-sm text-black/60">
                              Nincsenek alvállalkozók.
                            </p>
                          )}
                          {!isSubcontractorProject && (
                            <div className="space-y-1">
                              {laborers.map((laborer) => {
                                const checked = Boolean(selectedRoles[laborer.id]);
                                const currentRole = selectedRoles[laborer.id] ?? "member";
                                return (
                                  <div
                                    key={laborer.id}
                                    className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-surface-variant"
                                  >
                                    <label
                                      className="flex items-center gap-2 cursor-pointer flex-1"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          setSelectedByProject((prev) => {
                                            const current = prev[project.id] ?? {};
                                            const next = { ...current };

                                            if (e.target.checked) {
                                              next[laborer.id] = next[laborer.id] ?? "member";
                                            } else {
                                              delete next[laborer.id];
                                            }

                                            return {
                                              ...prev,
                                              [project.id]: next,
                                            };
                                          });
                                        }}
                                        className="h-4 w-4 rounded border-outline text-primary focus:ring-primary/50"
                                      />
                                      <span className="font-sans text-sm text-black">
                                        {laborer.name}
                                      </span>
                                    </label>

                                    {checked && (
                                      <select
                                        value={currentRole}
                                        onChange={(e) => {
                                          const role = e.target.value as LaborerRole;
                                          setSelectedByProject((prev) => {
                                            const current = prev[project.id] ?? {};
                                            return {
                                              ...prev,
                                              [project.id]: {
                                                ...current,
                                                [laborer.id]: role,
                                              },
                                            };
                                          });
                                        }}
                                        className="h-8 px-2 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        aria-label={`Role for ${laborer.name}`}
                                      >
                                        <option value="viewer">viewer</option>
                                        <option value="member">member</option>
                                        <option value="admin">admin</option>
                                        <option value="owner">owner</option>
                                      </select>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {isSubcontractorProject && (
                            <div className="space-y-1">
                              {subcontractors.map((sub) => {
                                const checked = selectedSubcontractors.includes(sub.id);
                                return (
                                  <label
                                    key={sub.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-variant cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setSelectedSubcontractorsByProject((prev) => {
                                          const current = prev[project.id] ?? [];
                                          const next = e.target.checked
                                            ? [...current, sub.id]
                                            : current.filter((id) => id !== sub.id);
                                          return {
                                            ...prev,
                                            [project.id]: next,
                                          };
                                        });
                                      }}
                                      className="h-4 w-4 rounded border-outline text-primary focus:ring-primary/50"
                                    />
                                    <span className="font-sans text-sm text-black">
                                      {sub.company_name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-sans text-xs text-black/60">
                              {isSubcontractorProject
                                ? "Jelöld be az alvállalkozókat, amelyeket ehhez a projekthez rendelsz."
                                : "Jelöld be a munkavállalókat, amelyeket ehhez a projekthez rendelsz."}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                isSubcontractorProject
                                  ? void saveProjectSubcontractors(project.id)
                                  : void saveProjectLaborers(project.id)
                              }
                              disabled={
                                savingProjectId === project.id ||
                                deletingProjectId === project.id ||
                                isEditing
                              }
                              className="h-9 px-4 rounded-lg bg-primary text-black font-sans text-sm font-medium disabled:opacity-60"
                            >
                              {savingProjectId === project.id ? "Mentés..." : "Mentés"}
                            </button>
                            {isEditing && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void saveEditProject()}
                                  disabled={savingProjectEdit || !editingProjectName.trim()}
                                  className="h-9 px-4 rounded-lg bg-black text-white font-sans text-sm font-medium disabled:opacity-60"
                                >
                                  {savingProjectEdit ? "Frissítés..." : "Frissítés"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditProject}
                                  disabled={savingProjectEdit}
                                  className="h-9 px-4 rounded-lg border border-outline text-black font-sans text-sm font-medium disabled:opacity-60"
                                >
                                  Mégse
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => void deleteProject(project)}
                              disabled={
                                deletingProjectId === project.id ||
                                savingProjectId === project.id ||
                                isEditing
                              }
                              className="h-9 px-4 rounded-lg border border-red-200 text-red-700 font-sans text-sm font-medium hover:bg-red-50 disabled:opacity-60"
                            >
                              {deletingProjectId === project.id ? "Törlés..." : "Törlés"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl border border-outline bg-surface p-4">
                <h4 className="font-serif text-base font-semibold text-black">
                  Projekt létrehozása
                </h4>
                <p className="mt-1 font-sans text-sm text-black/70">
                  Új projekt létrehozása adminból.
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Projekt neve"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Leírás (opcionális)"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    value={newProjectAddress}
                    onChange={(e) => setNewProjectAddress(e.target.value)}
                    placeholder="Cím (opcionális)"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="mt-3">
                  <select
                    value={newProjectKind}
                    onChange={(e) => setNewProjectKind(e.target.value as ProjectKind)}
                    className="h-11 w-full md:w-[260px] px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="Sajat projekt">Saját projekt</option>
                    <option value="Alvallalkozo">Alvállalkozó</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void addProject()}
                  disabled={creatingProject || !newProjectName.trim()}
                  className="mt-3 h-10 px-4 rounded-lg bg-primary text-black font-sans text-sm font-medium disabled:opacity-60"
                >
                  {creatingProject ? "Hozzáadás..." : "Projekt hozzáadása"}
                </button>
              </div>
            </>
          )}

          {section === "laborers" && (
            <>
              <h3 className="font-serif text-lg font-semibold text-black">Munkavállalók</h3>
              <p className="mt-2 font-sans text-sm text-black/70">
                Add meg a munkavállalókat itt, majd rendeld hozzá őket a Projektek fülön.
              </p>

              <div className="mt-4 rounded-xl border border-outline bg-surface p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={newLaborerName}
                    onChange={(e) => setNewLaborerName(e.target.value)}
                    placeholder="Munkavállaló neve"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newLaborerDailyWage}
                    onChange={(e) => setNewLaborerDailyWage(e.target.value)}
                    placeholder="Napi bér"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    type="email"
                    value={newLaborerEmail}
                    onChange={(e) => setNewLaborerEmail(e.target.value)}
                    placeholder="Email (opcionális)"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <p className="mt-2 font-sans text-xs text-black/60">
                  Az új munkavállalók nincsenek automatikusan projekthez rendelve.
                </p>
                <button
                  type="button"
                  onClick={() => void addLaborer()}
                  disabled={creatingLaborer || !newLaborerName.trim()}
                  className="mt-3 h-10 px-4 rounded-lg bg-primary text-black font-sans text-sm font-medium disabled:opacity-60"
                >
                  {creatingLaborer ? "Hozzáadás..." : "Munkavállaló hozzáadása"}
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-separate border-spacing-y-2">
                  <thead>
                    <tr>
                      <th className="text-left font-sans text-xs text-black/60 px-2">
                        Név
                      </th>
                      <th className="text-left font-sans text-xs text-black/60 px-2">
                        Napi bér
                      </th>
                      <th className="text-left font-sans text-xs text-black/60 px-2">
                        E-mail
                      </th>
                      <th className="text-right font-sans text-xs text-black/60 px-2">
                        Műveletek
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborers.map((laborer) => (
                      <tr key={laborer.id} className="bg-surface">
                        <td className="px-2 py-2 rounded-l-lg font-sans text-sm text-black">
                          {editingLaborerId === laborer.id ? (
                            <input
                              value={editingLaborerName}
                              onChange={(e) => setEditingLaborerName(e.target.value)}
                              className="h-9 w-full px-2 rounded-md border border-outline bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          ) : (
                            laborer.name
                          )}
                        </td>
                        <td className="px-2 py-2 font-sans text-sm text-black">
                          {editingLaborerId === laborer.id ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingLaborerDailyWage}
                              onChange={(e) => setEditingLaborerDailyWage(e.target.value)}
                              className="h-9 w-full px-2 rounded-md border border-outline bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          ) : (
                            Number(laborer.daily_wage).toFixed(2)
                          )}
                        </td>
                        <td className="px-2 py-2 font-sans text-sm text-black">
                          {editingLaborerId === laborer.id ? (
                            <input
                              type="email"
                              value={editingLaborerEmail}
                              onChange={(e) => setEditingLaborerEmail(e.target.value)}
                              className="h-9 w-full px-2 rounded-md border border-outline bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          ) : (
                            laborer.email ?? "-"
                          )}
                        </td>
                        <td className="px-2 py-2 rounded-r-lg font-sans text-sm text-black/80">
                          {editingLaborerId === laborer.id ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => void saveEditLaborer()}
                                disabled={
                                  savingLaborerEdit ||
                                  !editingLaborerName.trim()
                                }
                                className="h-8 px-3 rounded-md bg-primary text-black text-xs font-medium disabled:opacity-60"
                              >
                                {savingLaborerEdit ? "Mentés..." : "Mentés"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditLaborer}
                                disabled={savingLaborerEdit}
                                className="h-8 px-3 rounded-md border border-outline text-xs font-medium text-black/80 disabled:opacity-60"
                              >
                                Mégse
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEditLaborer(laborer)}
                                className="h-8 px-3 rounded-md border border-outline text-xs font-medium text-black hover:bg-surface-variant"
                              >
                                Szerkesztés
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteLaborer(laborer)}
                                className="h-8 px-3 rounded-md border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Törlés
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {laborers.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-2 py-4 font-sans text-sm text-black/60"
                        >
                          Nincsenek munkavállalók.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {section === "subcontractors" && (
            <>
              <h3 className="font-serif text-lg font-semibold text-black">Alvállalkozók</h3>
              <p className="mt-2 font-sans text-sm text-black/70">
                Alvállalkozók adatainak kezelése.
              </p>
              {subcontractorsWarning && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 text-amber-800 font-sans text-sm">
                  {subcontractorsWarning}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-outline bg-surface p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={newSubcontractorCompanyName}
                    onChange={(e) => setNewSubcontractorCompanyName(e.target.value)}
                    placeholder="Cégnév"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSpecialtiesOpen((v) => !v)}
                      className="h-11 w-full px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black text-left focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {newSubcontractorSpecialties.length > 0
                        ? newSubcontractorSpecialties.join(", ")
                        : "Szakterület"}
                    </button>
                    {specialtiesOpen && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-outline bg-white shadow-m3-1 p-2">
                        <div className="space-y-1">
                          {SUBCONTRACTOR_SPECIALTIES.map((item) => {
                            const checked = newSubcontractorSpecialties.includes(item);
                            return (
                              <label
                                key={item}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-variant cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setNewSubcontractorSpecialties((prev) =>
                                      e.target.checked
                                        ? [...prev, item]
                                        : prev.filter((v) => v !== item)
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-outline text-primary focus:ring-primary/50"
                                />
                                <span className="font-sans text-sm text-black">{item}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    value={newSubcontractorTaxNumber}
                    onChange={(e) => setNewSubcontractorTaxNumber(e.target.value)}
                    placeholder="Adószám (opcionális)"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    value={newSubcontractorRegisteredOffice}
                    onChange={(e) => setNewSubcontractorRegisteredOffice(e.target.value)}
                    placeholder="Székhely (opcionális)"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    value={newSubcontractorEmail}
                    onChange={(e) => setNewSubcontractorEmail(e.target.value)}
                    placeholder="Email cím"
                    className="h-11 px-3 rounded-lg border border-outline bg-white font-sans text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/50 md:col-span-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void addSubcontractor()}
                  disabled={
                    creatingSubcontractor ||
                    !newSubcontractorCompanyName.trim() ||
                    newSubcontractorSpecialties.length === 0 ||
                    !newSubcontractorEmail.trim()
                  }
                  className="mt-3 h-10 px-4 rounded-lg bg-primary text-black font-sans text-sm font-medium disabled:opacity-60"
                >
                  {creatingSubcontractor ? "Hozzáadás..." : "Hozzáadás"}
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-2">
                  <thead>
                    <tr>
                      <th className="text-left font-sans text-xs text-black/60 px-2">Cégnév</th>
                      <th className="text-left font-sans text-xs text-black/60 px-2">Szakterület</th>
                      <th className="text-left font-sans text-xs text-black/60 px-2">Adószám</th>
                      <th className="text-left font-sans text-xs text-black/60 px-2">Székhely</th>
                      <th className="text-left font-sans text-xs text-black/60 px-2">Email cím</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subcontractors.map((s) => (
                      <tr key={s.id} className="bg-surface">
                        <td className="px-2 py-2 rounded-l-lg font-sans text-sm text-black">
                          {s.company_name}
                        </td>
                        <td className="px-2 py-2 font-sans text-sm text-black">
                          {s.specialty}
                        </td>
                        <td className="px-2 py-2 font-sans text-sm text-black">
                          {s.tax_number ?? "-"}
                        </td>
                        <td className="px-2 py-2 font-sans text-sm text-black">
                          {s.registered_office ?? "-"}
                        </td>
                        <td className="px-2 py-2 rounded-r-lg font-sans text-sm text-black">
                          {s.email}
                        </td>
                      </tr>
                    ))}
                    {subcontractors.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-4 font-sans text-sm text-black/60"
                        >
                          Nincsenek alvállalkozók.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
