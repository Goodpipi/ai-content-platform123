import type { ChatProject } from '@/types/project';
import { loadAllSessions, saveSession } from '@/lib/chatSessions';

const STORAGE_KEY = 'acp_chat_projects_v1';

function genProjectId() {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadAllProjects(): ChatProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatProject[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

function saveAllProjects(projects: ChatProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function createProject(name: string): ChatProject {
  const trimmed = name.trim() || '未命名项目';
  const now = Date.now();
  const project: ChatProject = {
    id: genProjectId(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  };
  const all = loadAllProjects();
  all.unshift(project);
  saveAllProjects(all);
  return project;
}

export function renameProject(id: string, name: string): ChatProject | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const all = loadAllProjects();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const updated: ChatProject = { ...all[idx], name: trimmed, updatedAt: Date.now() };
  all[idx] = updated;
  saveAllProjects(all);
  return updated;
}

export function deleteProject(id: string): void {
  saveAllProjects(loadAllProjects().filter((p) => p.id !== id));
  for (const session of loadAllSessions()) {
    if (session.projectId === id) {
      saveSession({ ...session, projectId: undefined });
    }
  }
}

export function touchProject(id: string): void {
  const all = loadAllProjects();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], updatedAt: Date.now() };
  all.sort((a, b) => b.updatedAt - a.updatedAt);
  saveAllProjects(all);
}
