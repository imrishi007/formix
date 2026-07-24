"use client";

/**
 * components/workspace/project-explorer.tsx
 *
 * Left panel of the workspace. Lists the signed-in author's real backend
 * projects (GET /projects) and, for the selected project, its forms
 * (GET /projects/{id} -> forms: FormSummary[]) — this replaces the old
 * in-memory virtual file system (lib/forml-file-system.ts) as the source of
 * truth for what shows up here.
 */

import { useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  FileCode2,
  Globe,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ProjectResponse, ProjectDetail, FormSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

interface ProjectExplorerProps {
  projects: ProjectResponse[];
  projectDetails: Map<string, ProjectDetail>;
  activeProjectId: string | null;
  activeFormId: string | null;
  loadingProjects: boolean;
  onSelectProject: (id: string) => void;
  onSelectForm: (projectId: string, formId: string) => void;
  onCreateProject: (title: string) => Promise<void>;
  onCreateForm: (projectId: string, title: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onDeleteForm: (projectId: string, formId: string) => Promise<void>;
}

export function ProjectExplorer({
  projects,
  projectDetails,
  activeProjectId,
  activeFormId,
  loadingProjects,
  onSelectProject,
  onSelectForm,
  onCreateProject,
  onCreateForm,
  onDeleteProject,
  onDeleteForm,
}: ProjectExplorerProps) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newFormFor, setNewFormFor] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-12 flex-none items-center justify-between border-b border-border px-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Project Explorer
        </span>
        <button
          type="button"
          aria-label="New project"
          title="New project"
          onClick={() => setNewProjectOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="formix-scroll min-h-0 flex-1 overflow-auto p-2">
        {loadingProjects && (
          <div className="flex items-center gap-2 px-3 py-3 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-mono text-xs">Loading projects…</span>
          </div>
        )}

        {!loadingProjects && projects.length === 0 && (
          <Empty className="mt-4 border border-dashed border-border bg-dot-grid">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderPlus />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No projects yet</EmptyTitle>
              <EmptyDescription>Projects group related forms together.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" variant="outline" onClick={() => setNewProjectOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New project
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            forms={projectDetails.get(project.id)?.forms ?? null}
            isOpen={activeProjectId === project.id}
            activeFormId={activeFormId}
            onSelectProject={() => onSelectProject(project.id)}
            onSelectForm={(formId) => onSelectForm(project.id, formId)}
            onNewForm={() => setNewFormFor(project.id)}
            onDeleteProject={() => onDeleteProject(project.id)}
            onDeleteForm={(formId) => onDeleteForm(project.id, formId)}
          />
        ))}
      </div>

      <NewEntityDialog
        open={newProjectOpen}
        title="New project"
        label="Project name"
        placeholder="e.g. Customer Intake"
        onCancel={() => setNewProjectOpen(false)}
        onSubmit={async (name) => {
          await onCreateProject(name);
          setNewProjectOpen(false);
        }}
      />
      <NewEntityDialog
        open={newFormFor !== null}
        title="New form"
        label="Form title"
        placeholder="e.g. Feedback Survey"
        onCancel={() => setNewFormFor(null)}
        onSubmit={async (name) => {
          if (newFormFor) await onCreateForm(newFormFor, name);
          setNewFormFor(null);
        }}
      />
    </div>
  );
}

function ProjectRow({
  project,
  forms,
  isOpen,
  activeFormId,
  onSelectProject,
  onSelectForm,
  onNewForm,
  onDeleteProject,
  onDeleteForm,
}: {
  project: ProjectResponse;
  forms: FormSummary[] | null;
  isOpen: boolean;
  activeFormId: string | null;
  onSelectProject: () => void;
  onSelectForm: (formId: string) => void;
  onNewForm: () => void;
  onDeleteProject: () => void;
  onDeleteForm: (formId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="mb-0.5">
      <div
        className="group flex items-center gap-1.5 rounded-md py-1.5 pr-1.5 pl-1.5 text-left transition-colors hover:bg-accent/10"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button type="button" onClick={onSelectProject} className="flex min-w-0 flex-1 items-center gap-2">
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }} className="flex-none text-muted-foreground">
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.span>
          {isOpen ? <FolderOpen className="h-4 w-4 flex-none text-accent" /> : <Folder className="h-4 w-4 flex-none text-muted-foreground" />}
          <span className="flex-1 truncate font-inter text-sm font-medium text-foreground">{project.title}</span>
        </button>
        <button
          type="button"
          aria-label={`New form in ${project.title}`}
          title="New form"
          onClick={onNewForm}
          className={`flex h-6 w-6 flex-none items-center justify-center rounded transition-colors hover:bg-accent/10 hover:text-foreground ${hovered ? "text-foreground opacity-100" : "text-muted-foreground opacity-0"}`}
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label={`Delete project ${project.title}`}
          title="Delete project"
          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete project "${project.title}" and all its forms?`)) onDeleteProject(); }}
          className={`flex h-6 w-6 flex-none items-center justify-center rounded transition-colors hover:bg-destructive/10 hover:text-destructive ${hovered ? "text-muted-foreground opacity-100" : "text-muted-foreground opacity-0"}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden pl-4"
          >
            {forms === null && (
              <div className="flex items-center gap-2 px-2 py-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="font-mono text-xs">Loading forms…</span>
              </div>
            )}
            {forms?.length === 0 && (
              <p className="px-2 py-2 font-inter text-xs text-muted-foreground">No forms yet — use the + above to add one.</p>
            )}
            {forms?.map((form) => (
              <FormRow
                key={form.id}
                form={form}
                isActive={activeFormId === form.id}
                onSelect={() => onSelectForm(form.id)}
                onDelete={() => onDeleteForm(form.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FormRow({ form, isActive, onSelect, onDelete }: {
  form: FormSummary; isActive: boolean; onSelect: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`group relative flex items-center gap-2 rounded-md py-1.5 pr-1.5 pl-2 transition-colors ${
        isActive ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-accent/5 hover:text-foreground"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <FileCode2 className="h-3.5 w-3.5 flex-none text-muted-foreground" />
        <span className={`flex-1 truncate font-inter text-sm ${isActive ? "font-medium" : ""}`}>{form.title}</span>
        {form.is_published && <Globe className="h-3 w-3 flex-none text-success" aria-label="Published" />}
      </button>
      <button
        type="button"
        aria-label={`Delete form ${form.title}`}
        title="Delete form"
        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete form "${form.title}"?`)) onDelete(); }}
        className={`flex h-5 w-5 flex-none items-center justify-center rounded transition-colors hover:bg-destructive/10 hover:text-destructive ${hovered ? "text-muted-foreground opacity-100" : "text-muted-foreground opacity-0"}`}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function NewEntityDialog({ open, title, label, placeholder, onCancel, onSubmit }: {
  open: boolean; title: string; label: string; placeholder: string;
  onCancel: () => void; onSubmit: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (!trimmed) return;
            setSubmitting(true);
            try {
              await onSubmit(trimmed);
              setValue("");
            } catch {
              // The caller (workspace-shell) already surfaced a toast with
              // details — just keep this dialog open, with its value intact,
              // so the user can retry without retyping.
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={submitting || !value.trim()}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
