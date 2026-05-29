import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatSession, SessionStatus } from '@/types/session';
import type { ChatProject } from '@/types/project';
import {
  createProject,
  deleteProject,
  loadAllProjects,
  renameProject,
  touchProject,
} from '@/lib/chatProjects';
import { moveSessionToProject } from '@/lib/chatSessions';
import { ChevronLeft, FolderPlus, MessageSquare, Search } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

function lovableStatusClass(status: SessionStatus): string {
  switch (status) {
    case 'in_progress':
    case 'team':
      return 'border-accent/30 bg-accent/15 text-accent-foreground';
    case 'submitted':
      return 'border-primary/20 bg-primary/10 text-primary';
    default:
      return 'border-border bg-secondary text-secondary-foreground';
  }
}

interface HomeHistorySidebarProps {
  open: boolean;
  sessions: ChatSession[];
  activeProjectId: string | null;
  currentSessionId: string | null;
  sessionSearch: string;
  onSessionSearchChange: (value: string) => void;
  onCollapse: () => void;
  onExpand: () => void;
  onOpenSession: (id: string) => void;
  onDeleteSession: (id: string, title: string) => void;
  onActiveProjectChange: (projectId: string | null) => void;
  onProjectsChange: () => void;
  onSessionsChange: () => void;
  deriveSessionSubtitle: (session: ChatSession) => string;
  deriveSessionStatus: (session: ChatSession) => SessionStatus;
  sessionStatusLabel: (status: SessionStatus) => string;
  sessionStatusBadgeClass: (status: SessionStatus) => string;
  formatSessionTime: (ts: number) => string;
}

function SessionRow({
  session,
  isActive,
  deriveSessionSubtitle,
  deriveSessionStatus,
  sessionStatusLabel,
  sessionStatusBadgeClass,
  formatSessionTime,
  projects,
  onOpen,
  onDelete,
  onMoveToProject,
}: {
  session: ChatSession;
  isActive: boolean;
  deriveSessionSubtitle: (session: ChatSession) => string;
  deriveSessionStatus: (session: ChatSession) => SessionStatus;
  sessionStatusLabel: (status: SessionStatus) => string;
  sessionStatusBadgeClass: (status: SessionStatus) => string;
  formatSessionTime: (ts: number) => string;
  projects: ChatProject[];
  onOpen: () => void;
  onDelete: () => void;
  onMoveToProject: (projectId: string | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const status = deriveSessionStatus(session);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border border-transparent p-3 text-left transition',
        'hover:border-border/60 hover:bg-background/60 hover:shadow-soft',
        isActive && 'border-border/60 bg-background/60 shadow-soft'
      )}
      onClick={onOpen}
    >
      <div className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-hero-gradient opacity-0 transition group-hover:opacity-100" />
      <div className="home-history-item-top">
        <strong className="block truncate text-[13px] font-medium text-foreground">{session.title}</strong>
        <div className="home-history-item-actions" ref={menuRef}>
          <button
            type="button"
            className="home-history-item-menu-btn"
            title="更多操作"
            aria-label="更多操作"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="19" cy="12" r="1.75" />
            </svg>
          </button>
          {menuOpen && (
            <div className="home-history-menu" onClick={(e) => e.stopPropagation()}>
              <div className="home-history-menu-label">移至项目</div>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`home-history-menu-item ${session.projectId === p.id ? 'is-current' : ''}`}
                  onClick={() => {
                    onMoveToProject(p.id);
                    setMenuOpen(false);
                  }}
                >
                  {p.name}
                  {session.projectId === p.id ? ' ✓' : ''}
                </button>
              ))}
              {projects.length === 0 && (
                <div className="home-history-menu-empty">暂无项目，请先新建</div>
              )}
              {session.projectId && (
                <button
                  type="button"
                  className="home-history-menu-item home-history-menu-item-muted"
                  onClick={() => {
                    onMoveToProject(null);
                    setMenuOpen(false);
                  }}
                >
                  移出项目
                </button>
              )}
              <div className="home-history-menu-divider" />
              <button
                type="button"
                className="home-history-menu-item home-history-menu-item-danger"
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
              >
                删除对话
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{deriveSessionSubtitle(session)}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', lovableStatusClass(status))}>
          {sessionStatusLabel(status)}
        </span>
        <span className="text-[10px] text-muted-foreground">{formatSessionTime(session.updatedAt)}</span>
      </div>
    </div>
  );
}

export function HomeHistorySidebar({
  open,
  sessions,
  activeProjectId,
  currentSessionId,
  sessionSearch,
  onSessionSearchChange,
  onCollapse,
  onExpand,
  onOpenSession,
  onDeleteSession,
  onActiveProjectChange,
  onProjectsChange,
  onSessionsChange,
  deriveSessionSubtitle,
  deriveSessionStatus,
  sessionStatusLabel,
  sessionStatusBadgeClass,
  formatSessionTime,
}: HomeHistorySidebarProps) {
  const [projects, setProjects] = useState<ChatProject[]>(() => loadAllProjects());
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refreshProjects = () => {
    setProjects(loadAllProjects());
    onProjectsChange();
  };

  const q = sessionSearch.trim().toLowerCase();
  const filterSession = (s: ChatSession) => {
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      deriveSessionSubtitle(s).toLowerCase().includes(q)
    );
  };

  const filteredSessions = useMemo(
    () => sessions.filter(filterSession),
    [sessions, q, deriveSessionSubtitle]
  );

  const sessionsByProject = useMemo(() => {
    const map = new Map<string, ChatSession[]>();
    for (const p of projects) map.set(p.id, []);
    const ungrouped: ChatSession[] = [];
    for (const s of filteredSessions) {
      if (s.projectId && map.has(s.projectId)) {
        map.get(s.projectId)!.push(s);
      } else {
        ungrouped.push(s);
      }
    }
    return { map, ungrouped };
  }, [filteredSessions, projects]);

  const isSearching = q.length > 0;

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const isExp = prev[projectId] !== false;
      return { ...prev, [projectId]: isExp ? false : true };
    });
    onActiveProjectChange(projectId);
  };

  const isProjectExpanded = (projectId: string) => expandedProjects[projectId] !== false;

  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const project = createProject(name);
    setExpandedProjects((prev) => ({ ...prev, [project.id]: true }));
    onActiveProjectChange(project.id);
    setNewProjectName('');
    setCreatingProject(false);
    refreshProjects();
  };

  const handleRenameProject = (projectId: string) => {
    const updated = renameProject(projectId, renameValue);
    if (updated) {
      setRenamingProjectId(null);
      setRenameValue('');
      refreshProjects();
    }
  };

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId);
    if (activeProjectId === projectId) onActiveProjectChange(null);
    refreshProjects();
    onSessionsChange();
  };

  const handleMoveSession = (sessionId: string, projectId: string | null) => {
    moveSessionToProject(sessionId, projectId);
    if (projectId) {
      touchProject(projectId);
      setExpandedProjects((prev) => ({ ...prev, [projectId]: true }));
      refreshProjects();
    }
    onSessionsChange();
  };

  const renderSession = (session: ChatSession) => (
    <SessionRow
      key={session.id}
      session={session}
      isActive={session.id === currentSessionId}
      deriveSessionSubtitle={deriveSessionSubtitle}
      deriveSessionStatus={deriveSessionStatus}
      sessionStatusLabel={sessionStatusLabel}
      sessionStatusBadgeClass={sessionStatusBadgeClass}
      formatSessionTime={formatSessionTime}
      projects={projects}
      onOpen={() => onOpenSession(session.id)}
      onDelete={() => onDeleteSession(session.id, session.title)}
      onMoveToProject={(projectId) => handleMoveSession(session.id, projectId)}
    />
  );

  if (!open) {
    return (
      <aside className="w-16 shrink-0 self-stretch transition-[width] duration-500 ease-out">
        <button
          type="button"
          className="flex h-[calc(100vh-7rem)] w-full flex-col items-center gap-2 rounded-3xl border border-white/30 bg-white/60 py-4 shadow-soft backdrop-blur-xl transition hover:border-primary/40"
          onClick={onExpand}
          title="展开历史对话"
          aria-label="展开历史对话"
        >
          <MessageSquare className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
          <span className="text-[10px] font-medium text-muted-foreground [writing-mode:vertical-rl]">历史</span>
          {sessions.length > 0 && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#8AD329]" />
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[19rem] shrink-0 self-stretch transition-[width] duration-500 ease-out animate-fade-up">
      <div className="flex h-[calc(100vh-7rem)] flex-col rounded-3xl border border-white/30 bg-white/60 p-3 shadow-soft backdrop-blur-xl">
      <div className="home-history-head">
        <div className="flex items-center justify-between px-2 pb-3 pt-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-[0_4px_10px_-2px_oklch(0.55_0.18_220/0.45)] ring-1 ring-white/40">
              <MessageSquare className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
            </span>
            <span>历史对话</span>
            {sessions.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {sessions.length}
              </span>
            )}
          </div>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            onClick={onCollapse}
            title="收起历史对话"
            aria-label="收起历史对话"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className="group relative mb-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-hero-gradient px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:brightness-110"
          onClick={() => {
            setCreatingProject(true);
            setNewProjectName('');
          }}
        >
          <FolderPlus className="h-4 w-4" />
          新建项目
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        </button>

        {creatingProject && (
          <div className="mb-3 space-y-2 rounded-xl border border-border/50 bg-background/50 p-2.5">
            <input
              className="w-full rounded-lg border border-border/60 bg-white/80 px-3 py-2 text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              placeholder="项目名称"
              value={newProjectName}
              autoFocus
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') setCreatingProject(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium transition hover:border-primary/40"
                onClick={() => setCreatingProject(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-lg bg-hero-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
              >
                创建
              </button>
            </div>
          </div>
        )}

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-xl border border-border/60 bg-background/60 py-2 pl-9 pr-3 text-xs outline-none transition focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10"
            placeholder="搜索对话标题或内容"
            value={sessionSearch}
            onChange={(e) => onSessionSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="max-h-[calc(100vh-22rem)] flex-1 space-y-1 overflow-y-auto pr-1">
        {isSearching ? (
          filteredSessions.length > 0 ? (
            filteredSessions.map(renderSession)
          ) : (
            <div className="home-history-empty">
              <p>未找到匹配的对话</p>
            </div>
          )
        ) : (
          <>
            {projects.length > 0 && (
              <div className="home-project-section">
                {projects.map((project) => {
                  const projectSessions = sessionsByProject.map.get(project.id) || [];
                  const expanded = isProjectExpanded(project.id);
                  const isActive = activeProjectId === project.id;
                  return (
                    <div key={project.id} className={`home-project-group ${isActive ? 'is-active' : ''}`}>
                      <div className="home-project-head">
                        <button
                          type="button"
                          className="home-project-toggle"
                          onClick={() => toggleProject(project.id)}
                          aria-expanded={expanded}
                        >
                          <svg
                            className={`home-project-chevron ${expanded ? 'is-open' : ''}`}
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="home-project-folder-icon">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                          {renamingProjectId === project.id ? (
                            <input
                              className="input home-project-rename-input"
                              value={renameValue}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameProject(project.id);
                                if (e.key === 'Escape') setRenamingProjectId(null);
                              }}
                              onBlur={() => handleRenameProject(project.id)}
                            />
                          ) : (
                            <span className="home-project-name">{project.name}</span>
                          )}
                          <span className="home-project-count">{projectSessions.length}</span>
                        </button>
                        <div className="home-project-head-actions">
                          <button
                            type="button"
                            className="home-project-action-btn"
                            title="重命名项目"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingProjectId(project.id);
                              setRenameValue(project.name);
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="home-project-action-btn home-project-action-btn-danger"
                            title="删除项目"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="home-project-sessions">
                          {projectSessions.length > 0 ? (
                            projectSessions.map(renderSession)
                          ) : (
                            <div className="home-project-empty">将对话移入此项目，或在此项目下新建对话</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="home-ungrouped-section">
              {projects.length > 0 && (
                <div className="home-ungrouped-label">未分组对话</div>
              )}
              {sessionsByProject.ungrouped.length > 0 ? (
                sessionsByProject.ungrouped.map(renderSession)
              ) : projects.length === 0 && sessions.length === 0 ? (
                <div className="home-history-empty">
                  <div className="home-history-empty-icon" aria-hidden>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p>暂无历史对话</p>
                  <span>在右侧输入灵感，开始第一次创作</span>
                </div>
              ) : projects.length > 0 ? (
                <div className="home-project-empty">暂无未分组对话</div>
              ) : null}
            </div>
          </>
        )}
      </div>
      </div>
    </aside>
  );
}
