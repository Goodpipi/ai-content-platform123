import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as api from '@/lib/api';
import type {
  TopicItem,
  CopyItem,
  TeamContentType,
  TeamResult,
  VideoResult,
  VideoRenderVersion,
  PptResult,
  PptOutline,
  PptDesignVersion,
} from '@/types/content';
import {
  buildTeamReviewPayload,
  TEAM_CONTENT_LABELS,
} from '@/app/components/teamReviewUtils';
import { buildVideoPosterDataUrl } from '@/app/components/videoUtils';
import { VisualEditor } from '@/app/components/VisualEditor';
import { parseSvgFromDataUrl } from '@/app/components/svgEditorUtils';
import { PptOutlineEditor } from '@/app/components/PptOutlineEditor';
import { getPptTemplate, pptTemplateIdFromTitle } from '@/app/components/pptTemplates';
import { getImageTemplatesByIds } from '@/app/components/imageTemplates';
import { ImageTemplatePickerModal } from '@/app/components/ImageTemplatePickerModal';
import { MaterialPickerModal, type PickedMaterial } from '@/app/components/MaterialPickerModal';
import { MaterialDetailModal } from '@/app/components/MaterialDetailModal';
import { ContextMaterialsPanel } from '@/app/components/ContextMaterialsPanel';
import type { LibraryItem } from '@/types/library';
import { materialAttachmentPill } from '@/lib/libraryUtils';
import { buildPreviewFieldsFromTitle } from '@/lib/materialContent';
import {
  normalizeOutline,
  parseAudience,
  parseScenario,
  slideToPreviewUrl,
} from '@/app/components/pptUtils';
import { RoleSwitcher } from '@/app/components/RoleSwitcher';
import { ReviewerHome } from '@/app/components/ReviewerHome';
import { CopyReviewEditor } from '@/app/components/CopyReviewEditor';
import { CopyRevisionDisplay } from '@/app/components/CopyRevisionDisplay';
import { OpsImageReviewPanel } from '@/app/components/OpsImageReviewPanel';
import { alignImageReviewArrays } from '@/lib/imageReviewUtils';
import { parseFigmaCaptureId } from '@/lib/figmaCapture';
import { PptSlidesPanel } from '@/app/components/PptSlidesPanel';
import { ReviewerVisualPanel } from '@/app/components/ReviewerVisualPanel';
import { loadUserRole, saveUserRole, isReviewerRole } from '@/lib/userRole';
import {
  loadReviewTasks,
  upsertReviewTask,
  getReviewTask,
  tasksForRole,
  updateTaskStatus,
  seedReviewTasksIfEmpty,
  reviewerTabsForContentType,
  mergeSessionCopyRevisions,
  sessionCopyRevisionBase,
  propagateCopyRevisionsToSession,
} from '@/lib/reviewTasks';
import { createCopyRevision, downloadDataUrl, latestCopyText } from '@/lib/copyRevisionUtils';
import type { UserRole, ReviewTask } from '@/types/review';
import { ROLE_PROFILES } from '@/types/review';
import type { CopyRevision, ImageReviewStatus } from '@/types/review';
import {
  detectHomeIntent,
  getEntryWelcome,
  getHomeInputGuidance,
  isPptEntryIntent,
  isVisualEntryIntent,
  shouldPreferVisualFlow,
  type HomeEntryContext,
  type HomeEntryIntent,
} from '@/app/components/homeGuide';
import {
  analyzeBrief,
  getMissingForPpt,
  guideMissingFields,
  isStartAction,
  isInsightQuickAction,
  parseScenarioExplicit,
} from '@/app/components/conversationGuide';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { HomeHistorySidebar } from '@/app/components/HomeHistorySidebar';
import { HomeAttachMenu, HomeAgentIcon, getHomeAgentLabel } from '@/app/components/HomeAttachMenu';
import { AmbientOrbs } from '@/app/components/shell/AmbientOrbs';
import { SparkleField } from '@/app/components/shell/SparkleField';
import { cn } from '@/app/components/ui/utils';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Database,
  FileBarChart,
  FileText,
  Filter,
  FolderOpen,
  Image as ImageIcon,
  Library as LibraryIcon,
  Presentation,
  Search,
  Sparkles,
  Star,
  Upload,
  UploadCloud,
  Video,
  X,
} from 'lucide-react';
import { LibraryMaterialCard } from '@/app/components/LibraryMaterialCard';
import { loadAllProjects } from '@/lib/chatProjects';
import {
  DEFAULT_SESSION_TITLE,
  DEMO_SESSION_ID,
  deleteSession,
  deriveSessionStatus,
  deriveSessionSubtitle,
  fallbackSessionTitle,
  formatSessionTime,
  getSession,
  loadAllSessions,
  saveSession,
  seedSessionsIfEmpty,
  sessionStatusBadgeClass,
  sessionStatusLabel,
} from '@/lib/chatSessions';
import type {
  ChatMessage as Message,
  ChatSession,
  SessionAppState as AppState,
  TabKey,
} from '@/types/session';

const cats = ['热点洞察', '合规手册', '参考知识', '品牌briefing', '渠道特色'];

const initialLibrary: LibraryItem[] = [
  { id: 1, cat: '热点洞察', title: '小红书肾脏健康热点观察 2026-05', meta: 'CMS洞察 · 热点词/互动趋势', cms: true, def: true, addedAt: Date.now() - 9 * 86400000 },
  { id: 2, cat: '合规手册', title: '公众渠道疾病教育合规手册', meta: 'Word · 全局资料 · 最新版', cms: false, def: true, addedAt: Date.now() - 8 * 86400000 },
  { id: 3, cat: '参考知识', title: '肾脏健康疾病教育参考知识包', meta: 'PDF/Excel · 12条知识点', cms: false, def: true, addedAt: Date.now() - 7 * 86400000 },
  { id: 4, cat: '品牌briefing', title: '可申达 2026 品牌沟通 Briefing', meta: 'PDF · 2.4MB · 本地上传', cms: false, def: true, addedAt: Date.now() - 6 * 86400000 },
  { id: 5, cat: '渠道特色', title: '小红书渠道表达与视觉偏好', meta: '上传资料 · 风格案例 15 个', cms: false, def: true, addedAt: Date.now() - 5 * 86400000 },
  { id: 6, cat: '参考知识', title: '可申达 Approved Claims Library', meta: 'CMS · Approved · 可追溯', cms: true, def: true, addedAt: Date.now() - 4 * 86400000 },
  { id: 7, cat: '渠道特色', title: 'Bayer Blue-Green Visual Kit 2026', meta: 'CMS · Brand Kit · Approved', cms: true, def: true, addedAt: Date.now() - 3 * 86400000 },
  { id: 8, cat: '参考知识', title: '患者教育手册:慢性肾病风险认知', meta: 'CMS · Approved · 2026-04-12', cms: true, def: false, addedAt: Date.now() - 2 * 86400000 },
  { id: 9, cat: '热点洞察', title: '公众平台高互动标题样本', meta: '本地上传 · 20条样本', cms: false, def: false, addedAt: Date.now() - 86400000 },
];

const tabNames = {
  insight: '话题洞察',
  copy: '文案生成',
  team: '团队修改',
  visual: '图片生成',
  'video-script': '视频脚本',
  'video-render': '视频生成',
  'ppt-outline': 'PPT大纲',
  'ppt-design': 'PPT生成',
  submit: 'Veeva提交',
};

const posterData = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 560'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23eaf7ff'/%3E%3Cstop offset='1' stop-color='%23f4fff0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='900' height='560' fill='url(%23g)'/%3E%3Ccircle cx='720' cy='110' r='100' fill='%2369BE28' opacity='.22'/%3E%3Ccircle cx='145' cy='115' r='82' fill='%231d6bff' opacity='.16'/%3E%3Cpath d='M560 360c90-100 190-85 260-28v228H520c-35-68-27-137 40-200z' fill='%2369BE28' opacity='.24'/%3E%3Crect x='54' y='46' width='118' height='42' rx='21' fill='%23103C8F'/%3E%3Ctext x='83' y='73' font-size='24' font-weight='700' fill='white'%3EBayer%3C/text%3E%3Ctext x='70' y='175' font-size='58' font-weight='900' fill='%23103C8F'%3E%E8%82%BE%E8%84%8F%E5%81%A5%E5%BA%B7%3C/text%3E%3Ctext x='70' y='248' font-size='58' font-weight='900' fill='%23103C8F'%3E%E4%B8%8D%E6%AD%A2%E7%9C%8B%E7%97%87%E7%8A%B6%3C/text%3E%3Ctext x='74' y='316' font-size='28' fill='%2340536a'%3E%E4%BA%86%E8%A7%A3%E9%A3%8E%E9%99%A9%E5%9B%A0%E7%B4%A0%EF%BC%8C%E5%87%BA%E7%8E%B0%E7%96%91%E9%97%AE%E6%97%B6%E8%AF%B7%E5%92%A8%E8%AF%A2%E4%B8%93%E4%B8%9A%E5%8C%BB%E7%94%9F%3C/text%3E%3Crect x='70' y='410' width='420' height='64' rx='32' fill='%23fff' stroke='%23cfe0f1'/%3E%3Ctext x='100' y='452' font-size='24' fill='%231d5aa7'%3E%E7%96%BE%E7%97%85%E6%95%99%E8%82%B2%E5%86%85%E5%AE%B9%EF%BD%9C%E4%BB%85%E4%BE%9B%E7%A7%91%E6%99%AE%E5%8F%82%E8%80%83%3C/text%3E%3C/svg%3E";

const HOME_CREATION_MODES: {
  intent: HomeEntryIntent;
  label: string;
  gradient: string;
  Icon: typeof FileBarChart;
}[] = [
  { intent: 'insight', label: '洞察报告', gradient: 'from-[#54B9F9] to-[#2E8FD6]', Icon: FileBarChart },
  { intent: 'copy', label: '文案', gradient: 'from-[#7DC8F7] to-[#54B9F9]', Icon: FileText },
  { intent: 'visual', label: '图片', gradient: 'from-[#54B9F9] to-[#8AD329]', Icon: ImageIcon },
  { intent: 'video', label: '视频', gradient: 'from-[#2E8FD6] to-[#54B9F9]', Icon: Video },
  { intent: 'ppt', label: 'PPT', gradient: 'from-[#8AD329] to-[#6FCFC0]', Icon: Presentation },
];

type Screen = 'home' | 'library' | 'workspace';

type EditorTarget =
  | { kind: 'image'; index: number }
  | { kind: 'ppt-slide'; index: number };

const emptyWorkspaceState = (): AppState => ({
  tabs: [],
  active: null,
  insight: false,
  copy: false,
  team: false,
  visual: false,
  videoScript: false,
  videoRender: false,
  pptOutline: false,
  pptDesign: false,
  submit: false,
});

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [activeCat, setActiveCat] = useState(cats[0]);
  const [onlyDefault, setOnlyDefault] = useState(false);
  const [library, setLibrary] = useState(initialLibrary);
  const [libSearch, setLibSearch] = useState('');
  const [libSelectedIds, setLibSelectedIds] = useState<number[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [homeAgentIntent, setHomeAgentIntent] = useState<HomeEntryIntent | null>(null);
  const [selectedModel, setSelectedModel] = useState('DeepSeek-V3.1');
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [insightSummary, setInsightSummary] = useState('');
  const [copies, setCopies] = useState<CopyItem[]>([]);
  const [teamResult, setTeamResult] = useState<TeamResult | null>(null);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [videoVersions, setVideoVersions] = useState<VideoRenderVersion[]>([]);
  const [selectedVideoVersionId, setSelectedVideoVersionId] = useState<string | null>(null);
  const [pptResult, setPptResult] = useState<PptResult | null>(null);
  const [pptOutline, setPptOutline] = useState<PptOutline | null>(null);
  const [pptVersions, setPptVersions] = useState<PptDesignVersion[]>([]);
  const [selectedPptVersionId, setSelectedPptVersionId] = useState<string | null>(null);
  const [selectedPptTemplateId, setSelectedPptTemplateId] = useState<string | null>(null);
  const [pptWizard, setPptWizard] = useState<{
    active: boolean;
    step: 'audience' | 'scenario' | null;
    audience: string;
    scenario: string;
    pendingNote: string;
  } | null>(null);
  const [visualWizard, setVisualWizard] = useState<{
    active: boolean;
    step: 'ask';
    pendingNote: string;
    templateHint: string;
  } | null>(null);
  const [imageTemplateModal, setImageTemplateModal] = useState<{
    pendingNote: string;
    templateHint: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [state, setState] = useState<AppState>(emptyWorkspaceState());
  const [guides, setGuides] = useState<string[]>(['基于默认素材生成话题洞察:']);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [toastText, setToastText] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(() => loadUserRole());
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>(() => loadReviewTasks());
  const [activeReviewTaskId, setActiveReviewTaskId] = useState<string | null>(null);
  const [copyRevisions, setCopyRevisions] = useState<CopyRevision[]>([]);
  const [copyRevisionBase, setCopyRevisionBase] = useState('');
  const [teamAssigneeRoles, setTeamAssigneeRoles] = useState<('medical' | 'marketing')[]>([]);
  const [editorSrc, setEditorSrc] = useState('');
  const [editorSvg, setEditorSvg] = useState<string | undefined>();
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const [showModal, setShowModal] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imageReviewOrigins, setImageReviewOrigins] = useState<string[]>([]);
  const [imageReviewStatuses, setImageReviewStatuses] = useState<ImageReviewStatus[]>([]);
  const [selectedImages, setSelectedImages] = useState<boolean[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<boolean[]>([true, true, false, false]);
  const [selectedCopies, setSelectedCopies] = useState<boolean[]>([true, false, false]);
  const [editingCopy, setEditingCopy] = useState('');
  const [showCopyEditModal, setShowCopyEditModal] = useState(false);
  const [teamModificationInProgress, setTeamModificationInProgress] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamReviewTarget, setTeamReviewTarget] = useState<TeamContentType | null>(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [deadline, setDeadline] = useState('');
  const [taskTitle, setTaskTitle] = useState(DEFAULT_SESSION_TITLE);
  const [titleLocked, setTitleLocked] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [homeHistoryOpen, setHomeHistoryOpen] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const isHydratingRef = useRef(false);
  const autoTitleSessionRef = useRef<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCat, setPickerCat] = useState(cats[0]);
  const [pickerTarget, setPickerTarget] = useState<'workspace' | 'chat'>('workspace');
  const [pickerTab, setPickerTab] = useState<'upload' | 'cms'>('upload');
  const [previewMaterial, setPreviewMaterial] = useState<LibraryItem | null>(null);
  const [entryContext, setEntryContext] = useState<HomeEntryContext | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const pptWizardRef = useRef(pptWizard);
  const visualWizardRef = useRef(visualWizard);
  stateRef.current = state;
  pptWizardRef.current = pptWizard;
  visualWizardRef.current = visualWizard;

  const buildWorkspaceSnapshot = useCallback(
    () => ({
      state,
      topics,
      copies,
      teamResult,
      videoResult,
      videoVersions,
      selectedVideoVersionId,
      pptResult,
      pptOutline,
      pptVersions,
      selectedPptVersionId,
      selectedPptTemplateId,
      generatedImages,
      imageReviewOrigins,
      imageReviewStatuses,
      selectedImages,
      insightSummary,
      selectedTopics,
      selectedCopies,
      copyRevisions,
      copyRevisionBase,
      entryContext,
      pptWizard,
      visualWizard,
    }),
    [
      state,
      topics,
      copies,
      teamResult,
      videoResult,
      videoVersions,
      selectedVideoVersionId,
      pptResult,
      pptOutline,
      pptVersions,
      selectedPptVersionId,
      selectedPptTemplateId,
      generatedImages,
      imageReviewOrigins,
      imageReviewStatuses,
      selectedImages,
      insightSummary,
      selectedTopics,
      selectedCopies,
      copyRevisions,
      copyRevisionBase,
      entryContext,
      pptWizard,
      visualWizard,
    ]
  );

  const refreshSessionList = useCallback(() => {
    setSessions(loadAllSessions());
  }, []);

  const persistCurrentSession = useCallback(() => {
    if (!currentSessionId || isHydratingRef.current) return;
    const existing = getSession(currentSessionId);
    const session: ChatSession = {
      id: currentSessionId,
      title: taskTitle,
      titleLocked,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      messages,
      workspace: buildWorkspaceSnapshot(),
      projectId: existing?.projectId ?? activeProjectId ?? undefined,
    };
    saveSession(session);
    refreshSessionList();
  }, [
    currentSessionId,
    taskTitle,
    titleLocked,
    messages,
    buildWorkspaceSnapshot,
    refreshSessionList,
    activeProjectId,
  ]);

  const loadSessionIntoApp = useCallback((session: ChatSession) => {
    isHydratingRef.current = true;
    setCurrentSessionId(session.id);
    setTaskTitle(session.title);
    const locked =
      session.titleLocked ||
      session.title.trim() !== DEFAULT_SESSION_TITLE;
    setTitleLocked(locked);
    autoTitleSessionRef.current = locked ? session.id : null;
    setMessages(session.messages);
    const w = session.workspace;
    const legacy = w.state as AppState & { video?: boolean };
    const normalizedTabs = (legacy.tabs || []).map((t) =>
      (t as string) === 'video' ? 'video-script' : t
    ) as TabKey[];
    const normalizedState: AppState = {
      ...legacy,
      tabs: normalizedTabs,
      videoScript: legacy.videoScript ?? Boolean(legacy.video),
      videoRender: legacy.videoRender ?? false,
      active:
        legacy.active === ('video' as TabKey) ? 'video-script' : legacy.active,
    };
    setState(normalizedState);
    setTopics(w.topics);
    setCopies(w.copies);
    setTeamResult(w.teamResult);
    setVideoResult(w.videoResult);
    setVideoVersions(w.videoVersions || []);
    setSelectedVideoVersionId(w.selectedVideoVersionId ?? null);
    setPptResult(w.pptResult);
    setPptOutline(w.pptOutline);
    setPptVersions(w.pptVersions);
    setSelectedPptVersionId(w.selectedPptVersionId);
    setSelectedPptTemplateId(w.selectedPptTemplateId ?? null);
    setGeneratedImages(w.generatedImages);
    const imgCount = w.generatedImages?.length ?? 0;
    const { origins: loadedOrigins, statuses: loadedStatuses } = alignImageReviewArrays(
      w.generatedImages ?? [],
      w.imageReviewOrigins ?? [],
      w.imageReviewStatuses ?? []
    );
    setImageReviewOrigins(loadedOrigins);
    setImageReviewStatuses(loadedStatuses);
    setSelectedImages(
      w.selectedImages?.length === imgCount
        ? w.selectedImages
        : imgCount > 0
          ? w.generatedImages.map((_, i) => i === 0)
          : []
    );
    setInsightSummary(w.insightSummary);
    setSelectedTopics(w.selectedTopics);
    setSelectedCopies(w.selectedCopies);
    let revisions = w.copyRevisions || [];
    let revisionBase = w.copyRevisionBase || '';
    const sessionMerged = mergeSessionCopyRevisions(session.id);
    if (sessionMerged.length) {
      revisions = sessionMerged;
      revisionBase = sessionCopyRevisionBase(session.id) || revisionBase;
    }
    setCopyRevisions(revisions);
    setCopyRevisionBase(revisionBase);
    setEntryContext(w.entryContext);
    setPptWizard(w.pptWizard);
    setVisualWizard(w.visualWizard ?? null);
    setAttachments([]);
    setInputValue('');
    setSelectedPrompt('');
    requestAnimationFrame(() => {
      isHydratingRef.current = false;
    });
  }, []);

  const getActiveCopyBody = useCallback(() => {
    if (teamResult?.after) return teamResult.after;
    const idx = selectedCopies.findIndex(Boolean);
    const copy = copies[idx >= 0 ? idx : 0];
    return copy?.body || '';
  }, [teamResult, selectedCopies, copies]);

  const buildTeamPayload = useCallback(
    (type: TeamContentType) =>
      buildTeamReviewPayload(type, {
        copies,
        selectedCopies,
        getCopyBody: getActiveCopyBody,
        generatedImages,
        selectedImages,
        videoResult,
        pptOutline,
        pptResult,
      }),
    [
      copies,
      selectedCopies,
      getActiveCopyBody,
      generatedImages,
      selectedImages,
      videoResult,
      pptOutline,
      pptResult,
    ]
  );

  const resolveTeamReviewType = (text: string, activeTab: TabKey | null): TeamContentType => {
    if (text.includes('图片') || text.includes('配图') || text.includes('海报')) return 'visual';
    if (text.includes('视频')) return 'video';
    if (text.includes('PPT') || text.includes('ppt')) return 'ppt';
    if (activeTab === 'visual') return 'visual';
    if (activeTab === 'video-script' || activeTab === 'video-render') return 'video';
    if (activeTab === 'ppt-outline' || activeTab === 'ppt-design') return 'ppt';
    return 'copy';
  };

  const openTeamReview = useCallback(
    (type: TeamContentType) => {
      if (type === 'visual' && generatedImages.length > 0 && !selectedImages.some(Boolean)) {
        toast('请至少勾选一张图片后再提交团队修改');
        return;
      }
      const payload = buildTeamPayload(type);
      if (!payload) {
        if (type === 'visual' && generatedImages.length > 0) {
          toast('请至少勾选一张图片后再提交团队修改');
        } else {
          toast(`请先生成${TEAM_CONTENT_LABELS[type]}后再提交团队修改`);
        }
        return;
      }
      setTeamReviewTarget(type);
      setTeamAssigneeRoles([]);
      setShowTeamModal(true);
    },
    [buildTeamPayload, generatedImages, selectedImages]
  );

  const toggleTeamAssigneeRole = (role: 'medical' | 'marketing') => {
    setTeamAssigneeRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const setAllTeamAssigneeRoles = (checked: boolean) => {
    setTeamAssigneeRoles(checked ? ['medical', 'marketing'] : []);
  };

  const buildContentBrief = useCallback(
    (userNote = '') => {
      const copy = getActiveCopyBody();
      if (copy.trim().length > 20) {
        return { brief: userNote ? `${copy}\n\n补充要求：${userNote}` : copy, sufficient: true };
      }
      const topicStr = topics
        .filter((_, i) => selectedTopics[i] !== false)
        .map((t) => t.title)
        .filter(Boolean)
        .join('；');
      if (topicStr) {
        const brief = `主题方向：${topicStr}${userNote ? `\n要求：${userNote}` : ''}`;
        return { brief, sufficient: true };
      }
      const recentUser = messages
        .filter((m) => m.role === 'user')
        .slice(-4)
        .map((m) => m.html.replace(/<[^>]+>/g, ''))
        .join('\n');
      const mats = library
        .filter((m) => m.def)
        .map((m) => `[${m.cat}] ${m.title}`)
        .join('\n');
      const brief = [userNote, recentUser, mats ? `默认素材：\n${mats}` : '']
        .filter(Boolean)
        .join('\n\n');
      const sufficient = brief.trim().length >= 24;
      return {
        brief: sufficient ? brief : brief || '可申达｜肾脏健康疾病教育｜小红书公众渠道',
        sufficient: sufficient || brief.trim().length >= 12,
      };
    },
    [getActiveCopyBody, topics, selectedTopics, messages, library]
  );

  const getRecentUserContext = useCallback(
    (extra = '') => {
      const fromMsgs = messages
        .filter((m) => m.role === 'user')
        .slice(-6)
        .map((m) => m.html.replace(/<[^>]+>/g, ''))
        .join('\n');
      return [fromMsgs, extra].filter(Boolean).join('\n');
    },
    [messages]
  );

  const guideForMoreInfo = (taskLabel: string, userNote = '') => {
    const context = getRecentUserContext(userNote);
    const analysis = analyzeBrief(context);
    const missing: string[] = [];
    if (taskLabel.includes('PPT')) {
      missing.push(...getMissingForPpt(context));
    } else if (!analysis.isSubstantial) {
      if (!analysis.audience) missing.push('受众');
      if (!analysis.channel && !context.includes('渠道')) missing.push('渠道或用途');
    }
    const guide = guideMissingFields(taskLabel, missing);
    addMsg('ai', guide.html, 'DeepSeek-V3.1', guide.chips);
  };

  const dispatchUserIntent = (text: string, skipUserMsg = false) => {
    const lower = text.toLowerCase();
    if (isStartAction(text) || text.includes('开始生成')) {
      if (isPptEntryIntent(entryContext) || text.includes('PPT') || text.includes('ppt')) {
        startPptFlow(text, { skipUserMsg });
        return;
      }
      if (isInsightQuickAction(text) || entryContext?.intent === 'insight' || text.includes('洞察')) {
        runInsight(text, { skipUserMsg });
        return;
      }
      if (entryContext?.intent === 'copy' || text.includes('文案')) {
        runCopy(text, { skipUserMsg });
        return;
      }
      if (isVisualEntryIntent(entryContext) || text.includes('配图') || text.includes('图片')) {
        startVisualFlow(text, { skipUserMsg });
        return;
      }
      if (entryContext?.intent === 'video' || text.includes('视频')) {
        runVideo(text, { skipUserMsg });
        return;
      }
    }
    if (isInsightQuickAction(text)) {
      runInsight(text, { skipUserMsg });
      return;
    }
    if ((text.includes('话题') || lower.includes('topic')) && text.includes('洞察')) {
      runInsight(text, { skipUserMsg });
    } else if (text.includes('文案') || lower.includes('copy')) {
      runCopy(text, { skipUserMsg });
    } else if (text.includes('团队') && text.includes('修改')) {
      if (text.includes('整合') || text.includes('反馈')) {
        runTeam({ skipUserMsg, feedback: text });
      } else {
        openTeamReview(resolveTeamReviewType(text, stateRef.current.active));
      }
    } else if (
      text.includes('图片') ||
      text.includes('配图') ||
      text.includes('海报') ||
      lower.includes('image') ||
      lower.includes('visual')
    ) {
      startVisualFlow(text, { skipUserMsg });
    } else if (text.includes('视频') || lower.includes('video')) {
      runVideo(text, { skipUserMsg });
    } else if (text.includes('PPT') || text.includes('ppt')) {
      startPptFlow(text, { skipUserMsg });
    } else if (text.includes('Veeva') || text.includes('veeva') || text.includes('审批') || text.includes('提交')) {
      runSubmit({ skipUserMsg });
    } else {
      void runWithAi('正在思考', async () => {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.html.replace(/<[^>]+>/g, ''),
        }));
        const { reply } = await api.chat(library, history, text);
        addMsg('ai', reply.replace(/\n/g, '<br>'), 'DeepSeek-V3.1', nextPrompts());
      });
    }
  };

  useEffect(() => {
    api.checkHealth().then((h) => setApiReady(h.deepseekConfigured)).catch(() => setApiReady(false));
  }, []);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const toast = (text: string) => {
    setToastText(text);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1800);
  };

  const openSession = useCallback(
    (id: string) => {
      const session = getSession(id);
      if (!session) {
        toast('会话不存在或已被删除');
        refreshSessionList();
        return;
      }
      setActiveProjectId(session.projectId ?? null);
      setCurrentScreen('workspace');
      loadSessionIntoApp(session);
    },
    [loadSessionIntoApp, refreshSessionList]
  );

  const handleDeleteSession = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    deleteSession(id);
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setCurrentScreen('home');
    }
    refreshSessionList();
    setDeleteConfirm(null);
    toast('对话已删除');
  };

  const commitTitleEdit = () => {
    setIsEditingTitle(false);
    setTitleLocked(true);
    if (currentSessionId) autoTitleSessionRef.current = currentSessionId;
    const trimmed = taskTitle.trim() || DEFAULT_SESSION_TITLE;
    setTaskTitle(trimmed.startsWith('可申达') ? trimmed : `可申达｜${trimmed}`);
  };

  const applyAutoSessionTitle = (title: string, sessionId: string) => {
    if (autoTitleSessionRef.current === sessionId) return;
    setTaskTitle(title);
    setTitleLocked(true);
    autoTitleSessionRef.current = sessionId;
  };

  useEffect(() => {
    seedReviewTasksIfEmpty();
    setReviewTasks(loadReviewTasks());
    setSessions(seedSessionsIfEmpty());
  }, []);

  const refreshReviewTasks = useCallback(() => {
    setReviewTasks(loadReviewTasks());
  }, []);

  const handleRoleChange = (role: UserRole) => {
    setUserRole(role);
    saveUserRole(role);
    setActiveReviewTaskId(null);
    if (role === 'ops') {
      setCurrentScreen('home');
    }
  };

  useEffect(() => {
    persistCurrentSession();
  }, [persistCurrentSession]);

  useEffect(() => {
    if (!currentSessionId || titleLocked || isHydratingRef.current) return;
    if (autoTitleSessionRef.current === currentSessionId) return;
    const hasUser = messages.some((m) => m.role === 'user');
    const ready = hasUser && (messages.length >= 2 || state.tabs.length > 0);
    if (!ready) return;

    const sessionId = currentSessionId;
    const timer = setTimeout(() => {
      void (async () => {
        if (autoTitleSessionRef.current === sessionId) return;
        try {
          const payload = messages.slice(-12).map((m) => ({
            role: m.role,
            content: m.html.replace(/<[^>]+>/g, ''),
          }));
          const { title } = await api.generateSessionTitle(payload);
          if (title && currentSessionId === sessionId) {
            applyAutoSessionTitle(title, sessionId);
          }
        } catch {
          if (currentSessionId === sessionId && autoTitleSessionRef.current !== sessionId) {
            applyAutoSessionTitle(fallbackSessionTitle(messages), sessionId);
          }
        }
      })();
    }, 2200);

    return () => clearTimeout(timer);
    // 仅在新对话首次满足条件时命名一次；后续 messages 变化不再触发
    // eslint-disable-next-line react-hooks/exhaustive-deps -- titleLocked / ref 负责阻断重复命名
  }, [messages.length, state.tabs.length, currentSessionId, titleLocked]);

  const toggleDefault = (id: number) => {
    setLibrary(prev => prev.map(item =>
      item.id === id ? { ...item, def: !item.def } : item
    ));
    const item = library.find(x => x.id === id);
    if (item) {
      toast(item.def ? '已取消默认素材' : '已设为默认素材');
    }
  };

  const simulateUpload = () => {
    const title = `${activeCat}｜新上传资料.pdf`;
    setLibrary(prev => [{
      id: Date.now(),
      cat: activeCat,
      title,
      meta: '本地上传 · 刚刚 · 已解析',
      cms: false,
      def: false,
      addedAt: Date.now(),
      fileName: '新上传资料.pdf',
      ...buildPreviewFieldsFromTitle(title, false),
    }, ...prev]);
    toast('素材已上传到 ' + activeCat);
  };

  const simulateCmsSearch = () => {
    const title = `CMS搜索结果｜${activeCat}相关已审批素材`;
    setLibrary(prev => [{
      id: Date.now(),
      cat: activeCat,
      title,
      meta: 'CMS · Approved · 刚刚加入候选',
      cms: true,
      def: false,
      addedAt: Date.now(),
      ...buildPreviewFieldsFromTitle(title, true),
    }, ...prev]);
    toast('已从 CMS 加入候选素材');
  };

  const startFromHome = (ctx: HomeEntryContext, prompt = '') => {
    setCurrentScreen('workspace');
    const trimmed = prompt.trim();
    reset('', ctx, trimmed ? { homeDraft: trimmed } : undefined);
  };

  const newTask = (prompt = '', intent: HomeEntryIntent = 'general') =>
    startFromHome({ intent }, prompt);

  const getHomeInputPlaceholder = () => {
    switch (homeAgentIntent) {
      case 'insight':
        return '描述你想洞察的主题，如渠道、疾病领域、受众…';
      case 'copy':
        return '描述文案类型、受众与核心信息…';
      case 'visual':
        return '描述要生成的图片主题、风格与用途…';
      case 'video':
        return '描述视频主题、受众与时长偏好…';
      case 'ppt':
        return '描述 PPT 受众、场景与核心内容…';
      default:
        return '输入你的创作需求...';
    }
  };

  const submitHomeInput = () => {
    const text = inputValue.trim();
    if (!text && !homeAgentIntent) return;
    const intent = homeAgentIntent || 'general';
    setHomeAgentIntent(null);
    newTask(text, intent);
  };

  const openExistingTask = (sessionId = DEMO_SESSION_ID) => {
    openSession(sessionId);
  };

  const getComposerPlaceholder = () => {
    const ctx = entryContext;
    if (!ctx) return '直接说你想做什么：生成图片、PPT、视频、文案或话题洞察…';
    switch (ctx.intent) {
      case 'insight':
        return '描述你想洞察的主题，如渠道、疾病领域、受众…';
      case 'copy':
        return '描述文案类型、受众与核心信息…';
      case 'visual':
      case 'visual-template':
        return '描述要生成的图片主题、风格与用途…';
      case 'video':
        return '描述视频主题、受众与时长偏好…';
      case 'ppt':
      case 'ppt-template':
        return '描述 PPT 受众、场景与核心内容…';
      default:
        return '直接说你想做什么…';
    }
  };

  const reset = (
    initialPrompt = '',
    entry?: HomeEntryContext,
    opts?: { homeDraft?: string; attachedMaterials?: LibraryItem[] }
  ) => {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCurrentSessionId(sessionId);
    setTitleLocked(false);
    setTaskTitle(DEFAULT_SESSION_TITLE);
    autoTitleSessionRef.current = null;
    setMessages([]);
    setState(emptyWorkspaceState());
    setGuides([]);
    setAttachments([]);
    setSelectedPrompt('');
    setInputValue(opts?.homeDraft ?? initialPrompt);
    setGeneratedImages([]);
    setImageReviewOrigins([]);
    setImageReviewStatuses([]);
    setSelectedImages([]);
    setTopics([]);
    setCopies([]);
    setTeamResult(null);
    setVideoResult(null);
    setVideoVersions([]);
    setSelectedVideoVersionId(null);
    setPptResult(null);
    setPptOutline(null);
    setPptVersions([]);
    setSelectedPptVersionId(null);
    setSelectedPptTemplateId(
      entry?.intent === 'ppt-template' && entry.templateTitle
        ? pptTemplateIdFromTitle(entry.templateTitle)
        : null
    );
    setPptWizard(null);
    setVisualWizard(null);
    setInsightSummary('');
    setSelectedTopics([]);
    setSelectedCopies([]);
    setCopyRevisions([]);
    setCopyRevisionBase('');
    setActiveReviewTaskId(null);

    const apiHint =
      apiReady === false
        ? '<br><span style="color:#b72c3e">⚠ 未检测到 DeepSeek API Key，请在项目根目录配置 .env 后重启服务。</span>'
        : '';

    if (opts?.homeDraft) {
      const detected = detectHomeIntent(opts.homeDraft);
      const guidance = getHomeInputGuidance(opts.homeDraft, detected);
      const suggestedIntent = guidance.suggestedIntent as HomeEntryIntent;
      const ctx: HomeEntryContext = {
        intent: suggestedIntent,
        templateTitle: entry?.templateTitle,
      };
      setEntryContext(ctx);
      addMsg('user', opts.homeDraft, selectedModel);
      addMsg('ai', `${guidance.html}${apiHint}`, 'DeepSeek-V3.1', guidance.chips);
    } else if (opts?.attachedMaterials?.length) {
      const ctx = entry || { intent: 'general' as const };
      setEntryContext(ctx);
      setAttachments(opts.attachedMaterials.map(materialAttachmentPill));
      const titles = opts.attachedMaterials.map((m) => m.title).join('、');
      const welcome = getEntryWelcome(ctx);
      addMsg(
        'ai',
        `已创建新对话，并带入 ${opts.attachedMaterials.length} 项素材：${titles}。默认素材仍会参与生成。<br>${welcome.html}${apiHint}`,
        'DeepSeek-V3.1',
        welcome.chips
      );
    } else {
      const ctx = entry || { intent: 'general' as const };
      setEntryContext(ctx);
      const welcome = getEntryWelcome(ctx);
      addMsg('ai', `${welcome.html}${apiHint}`, 'DeepSeek-V3.1', welcome.chips);
    }

  };

  const addMsg = (role: 'user' | 'ai', html: string, model = '用户', quick: string[] = []) => {
    setMessages(prev => [...prev, { role, html, model, quick }]);
  };

  const send = () => {
    const text = inputValue.trim();
    if (!text) return;
    addMsg('user', text, selectedModel);
    setInputValue('');
    setSelectedPrompt('');
    if (visualWizard?.active && handleVisualWizardReply(text)) return;
    if (pptWizard?.active && handlePptWizardReply(text, inputValue.trim())) return;
    if (shouldPreferVisualFlow(entryContext, text)) {
      const templateHint =
        entryContext?.intent === 'visual-template' ? entryContext.templateTitle : undefined;
      startVisualFlow(text, { skipUserMsg: true, templateHint });
      return;
    }
    dispatchUserIntent(text, true);
  };

  const clearLoadingMessages = () => {
    setMessages((prev) => prev.filter((m) => !m.loading));
  };

  const showLoading = (title: string) => {
    setMessages((prev) => [
      ...prev.filter((m) => !m.loading),
      {
        role: 'ai',
        html: `<div class="agent-card"><strong>${title}</strong><div class="progress"><div class="bar" style="width:78%"></div></div><div class="small">正在调用 DeepSeek，请稍候…</div></div>`,
        model: 'DeepSeek Agent',
        loading: true,
      },
    ]);
  };

  const notifyMockIfNeeded = (meta?: { mockUsed?: boolean }) => {
    if (meta?.mockUsed) {
      toast('DeepSeek 暂不可用，已使用演示数据（可继续体验流程）');
    }
  };

  const runWithAi = async (title: string, fn: () => Promise<void>) => {
    if (isGenerating) {
      toast('请等待当前 AI 生成完成');
      return;
    }
    setIsGenerating(true);
    showLoading(title);
    try {
      await fn();
      clearLoadingMessages();
    } catch (e) {
      clearLoadingMessages();
      const msg = e instanceof Error ? e.message : '生成失败';
      addMsg('ai', `<span style="color:#b72c3e">生成失败：${msg}</span>`, 'DeepSeek-V3.1', ['重试']);
      toast(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const runInsight = (userNote = '', opts?: { skipUserMsg?: boolean }) => {
    if (!opts?.skipUserMsg) addMsg('user', userNote || '生成话题洞察', selectedModel);
    void runWithAi('正在生成话题洞察', async () => {
      const result = await api.generateInsight(library, userNote);
      notifyMockIfNeeded(result);
      setTopics(result.topics);
      setInsightSummary(result.summary || '');
      setSelectedTopics(result.topics.map((_, i) => i < 2));
      setState((prev) => ({ ...prev, insight: true }));
      addTab('insight');
      addMsg(
        'ai',
        `已生成 ${result.topics.length} 个候选话题。${result.summary || ''} 右侧可查看详情并勾选后继续生成文案。`,
        'DeepSeek-V3.1｜话题洞察',
        ['生成文案', '补充小红书热点洞察']
      );
    });
  };

  const runCopy = (userNote = '', opts?: { skipUserMsg?: boolean }) => {
    if (!opts?.skipUserMsg) addMsg('user', userNote || '生成文案', selectedModel);
    const selected = topics.filter((_, i) => selectedTopics[i]);
    const topicInput =
      selected.length > 0
        ? selected
        : topics.length > 0
          ? topics
          : [{ title: userNote || '基于素材与对话内容', reason: '', source: '用户描述' }];
    void runWithAi('正在生成文案', async () => {
      const result = await api.generateCopy(library, topicInput, userNote);
      notifyMockIfNeeded(result);
      setCopies(result.copies);
      setSelectedCopies(result.copies.map((_, i) => i === 0));
      setState((prev) => ({ ...prev, copy: true }));
      addTab('copy');
      addMsg(
        'ai',
        `已生成 ${result.copies.length} 版文案，已自动应用公众渠道合规策略。右侧可编辑文案，或继续生成图片、视频、PPT。`,
        'DeepSeek-V3.1｜文案生成',
        ['进入团队修改', '生成图片', '生成视频', '生成PPT']
      );
    });
  };

  const runTeam = (opts?: {
    skipUserMsg?: boolean;
    contentType?: TeamContentType;
    feedback?: string;
  }) => {
    const type = opts?.contentType || teamReviewTarget || 'copy';
    const payload = buildTeamPayload(type);
    if (!payload) {
      toast(`请先生成${TEAM_CONTENT_LABELS[type]}后再提交团队修改`);
      return;
    }
    if (!opts?.skipUserMsg) {
      addMsg('user', `提交${TEAM_CONTENT_LABELS[type]}团队修改`, selectedModel);
    }
    setTeamModificationInProgress(true);
    void runWithAi(`正在整合${TEAM_CONTENT_LABELS[type]}团队修改`, async () => {
      try {
        const result = await api.generateTeam(payload.body, {
          feedback: opts?.feedback,
          contentType: type,
          contentTitle: payload.title,
        });
        notifyMockIfNeeded(result);
        const normalized: TeamResult = {
          contentType: result.contentType || type,
          contentTitle: result.contentTitle || payload.title,
          before: result.before,
          after: result.after,
          changes: result.changes || [],
          summary: result.summary,
        };
        setTeamResult(normalized);
        setState((prev) => ({ ...prev, team: true, active: 'team' }));
        addTab('team');
        addMsg(
          'ai',
          `已整合「${normalized.contentTitle}」团队反馈：${normalized.summary}。右侧可查看修改前后差异。`,
          'DeepSeek-V3.1｜团队修改',
          ['生成图片', '生成PPT', '生成视频', '提交当前版本到Veeva Vault']
        );
      } finally {
        setTeamModificationInProgress(false);
      }
    });
  };

  const executeVisualGeneration = (userNote: string, templateIds: string[]) => {
    setVisualWizard(null);
    setImageTemplateModal(null);
    const { brief } = buildContentBrief(userNote);
    const templates = getImageTemplatesByIds(templateIds);

    const genLabel =
      templates.length > 1
        ? `正在按 ${templates.length} 个模板生成配图`
        : templates.length === 1
          ? `正在按「${templates[0].name}」模板生成配图`
          : '正在生成图片方案';

    void runWithAi(genLabel, async () => {
      const images: string[] = [];
      const titles: string[] = [];

      if (templates.length === 0) {
        const result = await api.generatePoster(brief, userNote, null);
        notifyMockIfNeeded(result);
        images.push(result.dataUrl);
        titles.push(result.title);
      } else {
        for (const tpl of templates) {
          const result = await api.generatePoster(
            brief,
            `${userNote}\n【模板】${tpl.name}：${tpl.styleHint}`,
            tpl.id
          );
          notifyMockIfNeeded(result);
          images.push(result.dataUrl);
          titles.push(`${tpl.name}：${result.title}`);
        }
      }

      setGeneratedImages(images.length ? images : [posterData]);
      setImageReviewOrigins([]);
      setImageReviewStatuses([]);
      setSelectedImages(images.map((_, i) => i === 0));
      setState((prev) => ({ ...prev, visual: true, active: 'visual' }));
      addTab('visual');

      const summary =
        templates.length > 1
          ? `已按 ${templates.length} 个模板生成 ${images.length} 张配图（${templates.map((t) => t.name).join('、')}）。请在右侧查看。`
          : templates.length === 1
            ? `已按「${templates[0].name}」模板生成配图「${titles[0]}」。请在右侧查看，可勾选后提交团队修改。`
            : `已生成 AI 海报「${titles[0]}」。右侧可勾选图片提交团队修改，或继续生成视频、PPT。`;

      addMsg('ai', summary, 'DeepSeek-V3.1｜图片生成', [
        '进入团队修改',
        '生成视频',
        '生成PPT',
        '提交当前版本到Veeva Vault',
      ]);
    });
  };

  const openImageTemplatePicker = (pendingNote: string, templateHint = '') => {
    setVisualWizard(null);
    setImageTemplateModal({ pendingNote, templateHint });
    addMsg(
      'ai',
      '请在弹窗中浏览模板缩略图，可<strong>多选</strong>模板；右侧可查看版式与风格详情。',
      'DeepSeek-V3.1'
    );
  };

  const isVisualTemplateYes = (text: string) =>
    /^(是|要|需要|好|可以|选用|选择模板|是[，,])/.test(text.trim()) ||
    text.includes('选择模板') ||
    text.includes('选用模板') ||
    (text.includes('是') && text.includes('模板'));

  const isVisualTemplateNo = (text: string) =>
    /^(否|不|不要|不需要|不用|直接)/.test(text.trim()) ||
    text.includes('直接生成') ||
    text.includes('不用模板') ||
    text.includes('否，');

  const handleVisualWizardReply = (text: string): boolean => {
    if (!visualWizard?.active) return false;
    const wizard = visualWizard;

    if (wizard.step === 'ask') {
      if (isVisualTemplateYes(text)) {
        openImageTemplatePicker(wizard.pendingNote, wizard.templateHint);
        return true;
      }
      if (isVisualTemplateNo(text)) {
        executeVisualGeneration(wizard.pendingNote, []);
        return true;
      }
      addMsg(
        'ai',
        '请先选择是否使用内置模板：<strong>是，选择模板</strong> 或 <strong>否，直接生成</strong>。',
        'DeepSeek-V3.1',
        ['是，选择模板', '否，直接生成']
      );
      return true;
    }

    return true;
  };

  const startVisualFlow = (
    userNote = '',
    opts?: { skipUserMsg?: boolean; templateHint?: string }
  ) => {
    if (!opts?.skipUserMsg) addMsg('user', userNote || '生成图片', selectedModel);

    if (visualWizardRef.current?.active) {
      handleVisualWizardReply(userNote);
      return;
    }

    const context = getRecentUserContext(userNote);
    const analysis = analyzeBrief(context);
    const { sufficient } = buildContentBrief(userNote);

    if (isVisualTemplateYes(userNote) || analysis.wantsTemplate) {
      openImageTemplatePicker(
        userNote,
        opts?.templateHint ||
          (entryContext?.intent === 'visual-template' ? entryContext.templateTitle : '')
      );
      return;
    }

    if (isVisualTemplateNo(userNote) || analysis.skipsTemplate) {
      executeVisualGeneration(userNote, []);
      return;
    }

    if (!sufficient && !analysis.isSubstantial) {
      guideForMoreInfo('生成配图/海报', userNote);
      return;
    }

    executeVisualGeneration(userNote, []);
  };

  const runVideo = (userNote = '', opts?: { skipUserMsg?: boolean }) => {
    if (!opts?.skipUserMsg) addMsg('user', userNote || '生成视频', selectedModel);
    const { brief, sufficient } = buildContentBrief(userNote);
    if (!sufficient) {
      guideForMoreInfo('生成视频脚本');
      return;
    }
    void runWithAi('正在生成视频脚本', async () => {
      const result = await api.generateVideo(brief, userNote);
      notifyMockIfNeeded(result);
      setVideoResult(result);
      setVideoVersions([]);
      setSelectedVideoVersionId(null);
      setState((prev) => ({ ...prev, videoScript: true, active: 'video-script' }));
      addTab('video-script');
      addMsg(
        'ai',
        `已生成短视频脚本「${result.title}」，共 ${result.segments.length} 个分镜。请在右侧「视频脚本」中确认后点击「生成视频」。`,
        'DeepSeek-V3.1｜视频脚本',
        ['生成视频', '生成图片', '生成PPT']
      );
    });
  };

  const enrichVideoVersions = (versions: VideoRenderVersion[], scriptTitle: string) =>
    versions.map((v) => ({
      ...v,
      posterDataUrl: v.posterDataUrl || buildVideoPosterDataUrl(scriptTitle, v.styleTag),
    }));

  const confirmVideoRender = () => {
    if (!videoResult) {
      toast('请先生成视频脚本');
      return;
    }
    void runWithAi('正在合成视频', async () => {
      const res = await api.generateVideoRender(videoResult);
      notifyMockIfNeeded(res);
      const versions = enrichVideoVersions(res.versions || [], videoResult.title);
      setVideoVersions(versions);
      const first = versions[0];
      if (first) setSelectedVideoVersionId(first.id);
      setState((prev) => ({ ...prev, videoRender: true, active: 'video-render' }));
      addTab('video-render');
      addMsg(
        'ai',
        `已根据脚本生成 ${versions.length} 套视频方案（演示占位成片）。请在右侧「视频生成」中预览并提交 Veeva 审批。`,
        'DeepSeek-V3.1｜视频合成',
        ['查看脚本', '提交当前版本到Veeva Vault']
      );
    });
  };

  const selectVideoVersion = (version: VideoRenderVersion) => {
    setSelectedVideoVersionId(version.id);
    toast(`已选用「${version.name}」`);
  };

  const finishPptWizardAndGenerate = (
    wizard: NonNullable<typeof pptWizard>,
    scenario: string
  ) => {
    const audience = wizard.audience;
    if (!audience) {
      toast('请先确认目标受众');
      return;
    }
    const finalScenario = scenario || wizard.scenario || '疾病教育';
    setPptWizard(null);
    void generatePptOutlineAndOpen(wizard.pendingNote, audience, finalScenario);
  };

  const handlePptWizardReply = (text: string, extraAudienceHint = ''): boolean => {
    if (!pptWizard?.active) return false;

    const fullContext = [pptWizard.pendingNote, text, extraAudienceHint].filter(Boolean).join('\n');
    const step = pptWizard.step || 'audience';
    const audience =
      parseAudience(fullContext) ||
      (step === 'audience' && text.trim().length <= 24 ? text.trim() : '');
    const scenario =
      parseScenarioExplicit(fullContext) ||
      (step === 'scenario' && text.trim().length >= 2 && !parseAudience(text) ? text.trim() : '');

    if (audience && scenario) {
      finishPptWizardAndGenerate(
        { ...pptWizard, audience, scenario },
        scenario
      );
      return true;
    }

    if (step === 'audience') {
      if (combinedIncludesGenerateOutline(text)) {
        toast('还差一项信息：请补充目标受众或使用场景');
        return true;
      }
      if (!audience) {
        const guide = guideMissingFields('生成 PPT', ['audience']);
        addMsg('ai', guide.html, 'DeepSeek-V3.1', guide.chips);
        return true;
      }
      if (pptWizard.scenario || parseScenarioExplicit(pptWizard.pendingNote)) {
        finishPptWizardAndGenerate(
          { ...pptWizard, audience, scenario: pptWizard.scenario || parseScenarioExplicit(pptWizard.pendingNote) || '' },
          pptWizard.scenario || parseScenarioExplicit(pptWizard.pendingNote) || '疾病教育'
        );
        return true;
      }
      setPptWizard({
        ...pptWizard,
        audience,
        scenario: pptWizard.scenario || parseScenarioExplicit(fullContext) || '',
        step: 'scenario',
      });
      const guide = guideMissingFields('生成 PPT', ['scenario']);
      addMsg('ai', `已记录受众 <strong>${audience}</strong>。${guide.html}`, 'DeepSeek-V3.1', guide.chips);
      return true;
    }

    if (step === 'scenario') {
      if (!scenario) {
        const guide = guideMissingFields('生成 PPT', ['scenario']);
        addMsg('ai', guide.html, 'DeepSeek-V3.1', guide.chips);
        return true;
      }
      finishPptWizardAndGenerate({ ...pptWizard, audience: audience || pptWizard.audience }, scenario);
      return true;
    }

    return true;
  };

  function combinedIncludesGenerateOutline(t: string) {
    return t.includes('生成大纲');
  }

  const generatePptOutlineAndOpen = async (
    userNote: string,
    audience: string,
    scenario: string
  ) => {
    const { brief } = buildContentBrief(userNote);
    void runWithAi('正在智能生成 PPT 大纲', async () => {
      const raw = await api.generatePptOutline({
        materials: library,
        brief,
        audience,
        scenario,
        userNote,
      });
      notifyMockIfNeeded(raw);
      const outline = normalizeOutline(raw, audience, scenario);
      setPptOutline(outline);
      setState((prev) => ({ ...prev, pptOutline: true, active: 'ppt-outline' }));
      addTab('ppt-outline');
      addMsg(
        'ai',
        `已为「${outline.title}」生成大纲，共 ${outline.chapters.length} 章。请在右侧「PPT大纲」中编辑大纲；可选模板（不选则生成 3 套方案），确认后点击生成。`,
        'DeepSeek-V3.1｜PPT 大纲',
        ['查看大纲']
      );
    });
  };

  const startPptFlow = (userNote = '', opts?: { skipUserMsg?: boolean }) => {
    if (!opts?.skipUserMsg) addMsg('user', userNote || '生成PPT', selectedModel);

    if (pptWizardRef.current?.active) {
      handlePptWizardReply(userNote, '');
      return;
    }

    const fullContext = getRecentUserContext(userNote);
    const audience = parseAudience(fullContext);
    const scenario = parseScenarioExplicit(fullContext) || parseScenario(fullContext);

    if (audience && scenario) {
      void generatePptOutlineAndOpen(userNote || fullContext, audience, scenario);
      return;
    }

    const missing = getMissingForPpt(fullContext);
    if (missing.length === 0) {
      void generatePptOutlineAndOpen(userNote, audience || '公众', scenario || '疾病教育');
      return;
    }

    setPptWizard({
      active: true,
      step: missing[0] === 'audience' ? 'audience' : 'scenario',
      audience: audience || '',
      scenario: scenario || '',
      pendingNote: userNote || fullContext,
    });

    const guide = guideMissingFields('生成 PPT', missing);
    addMsg('ai', guide.html, 'DeepSeek-V3.1', guide.chips);
  };

  const regeneratePptOutline = () => {
    if (!pptOutline) return;
    void generatePptOutlineAndOpen(
      pptWizard?.pendingNote || '',
      pptOutline.audience,
      pptOutline.scenario
    );
  };

  const outlineFromCopy = () => {
    const copy = getActiveCopyBody();
    if (!copy) {
      toast('暂无文案，请先生成文案或在对话中描述需求');
      return;
    }
    const audience = pptOutline?.audience || '公众';
    const scenario = pptOutline?.scenario || '疾病教育';
    void runWithAi('正在根据文案生成大纲', async () => {
      const raw = await api.generatePptOutline({
        materials: library,
        brief: copy,
        audience,
        scenario,
        userNote: '根据已有文案结构化为PPT大纲',
      });
      notifyMockIfNeeded(raw);
      const outline = normalizeOutline(raw, audience, scenario);
      setPptOutline(outline);
      setState((prev) => ({ ...prev, pptOutline: true, active: 'ppt-outline' }));
      addTab('ppt-outline');
      toast('已根据文案更新大纲');
    });
  };

  const confirmPptDesigns = (mode?: 'template' | 'no-template') => {
    if (!pptOutline) return;
    const effectiveMode =
      mode ?? (getPptTemplate(selectedPptTemplateId) ? 'template' : 'no-template');
    if (effectiveMode === 'template' && !getPptTemplate(selectedPptTemplateId)) {
      toast('请先在「PPT大纲」中选择一套内置模板');
      setState((prev) => ({ ...prev, active: 'ppt-outline' }));
      return;
    }
    if (effectiveMode === 'no-template') {
      setSelectedPptTemplateId(null);
    }
    const tpl =
      effectiveMode === 'template' ? getPptTemplate(selectedPptTemplateId) : null;
    const loadingLabel = tpl
      ? `正在按「${tpl.name}」模板生成 PPT`
      : '正在生成 3 套 PPT 设计方案';
    void runWithAi(loadingLabel, async () => {
      const designs = await api.generatePptDesigns(
        pptOutline,
        pptOutline.audience,
        pptOutline.scenario,
        tpl?.id ?? null
      );
      notifyMockIfNeeded(designs);
      const { versions } = designs;
      setPptVersions(versions);
      const first = versions[0];
      if (first) {
        setSelectedPptVersionId(first.id);
        setPptResult({ title: pptOutline.title, slides: first.slides });
      }
      setState((prev) => ({ ...prev, pptDesign: true, active: 'ppt-design' }));
      addTab('ppt-design');
      if (tpl) {
        addMsg(
          'ai',
          `已按「${tpl.name}」模板生成 PPT，共 ${first?.slides?.length ?? 0} 页。请在右侧「PPT生成」中预览与编辑。`,
          'DeepSeek-V3.1｜PPT 设计',
          ['查看大纲', '提交当前版本到Veeva Vault']
        );
      } else {
        const names = versions.map((v) => v.name).join('、');
        addMsg(
          'ai',
          `已生成 3 套 PPT 设计方案${names ? `（${names}）` : ''}，每套 ${first?.slides?.length ?? 0} 页。请在右侧「PPT生成」中切换对比并选用一套。`,
          'DeepSeek-V3.1｜PPT 设计',
          ['查看大纲', '提交当前版本到Veeva Vault']
        );
      }
    });
  };

  const selectPptVersion = (version: PptDesignVersion) => {
    setSelectedPptVersionId(version.id);
    setPptResult({ title: pptOutline?.title, slides: version.slides });
    toast(`已选用「${version.name}」`);
  };

  const runSubmit = (opts?: { skipUserMsg?: boolean }) => {
    if (!opts?.skipUserMsg) addMsg('user', '提交Veeva Vault审批', selectedModel);
    const selectedVideo = videoVersions.find((v) => v.id === selectedVideoVersionId);
    const parts = ['内容文件', '素材引用', '合规记录', '团队修改记录'];
    if (selectedVideo) parts.push(`视频「${selectedVideo.name}」`);
    setState((prev) => ({ ...prev, submit: true, active: 'submit' }));
    addTab('submit');
    addMsg(
      'ai',
      `已整理 Veeva Vault 提交包：${parts.join('、')}。（演示模式：实际提交需对接 Veeva API）`,
      'DeepSeek-V3.1',
      ['下载审计报告', '保存回CMS']
    );
  };

  const fillQuick = (text: string) => {
    if (isGenerating) {
      toast('请等待当前 AI 生成完成');
      return;
    }
    addMsg('user', text, selectedModel);

    const activeTab = stateRef.current.active;
    const wizard = pptWizardRef.current;
    const visualWiz = visualWizardRef.current;

    if (visualWiz?.active) {
      handleVisualWizardReply(text);
      return;
    }

    if (text.includes('开始生成PPT') || text === '开始生成PPT大纲') {
      startPptFlow(text, { skipUserMsg: true });
      return;
    }
    if (text.includes('开始生成配图') || text.includes('开始生成图片')) {
      const templateHint =
        entryContext?.intent === 'visual-template' ? entryContext.templateTitle : undefined;
      startVisualFlow(text, { skipUserMsg: true, templateHint });
      return;
    }
    if (text.includes('开始生成话题洞察') || isInsightQuickAction(text)) {
      runInsight(text, { skipUserMsg: true });
      return;
    }
    if (text.includes('开始生成文案')) {
      runCopy(text, { skipUserMsg: true });
      return;
    }
    if (text.includes('开始生成视频脚本')) {
      runVideo(text, { skipUserMsg: true });
      return;
    }
    if (text === '选用内置模板') {
      const note = getRecentUserContext(text);
      openImageTemplatePicker(note, entryContext?.templateTitle || '');
      return;
    }
    if (text === '直接开始') {
      dispatchUserIntent(text, true);
      return;
    }

    if (text.includes('查看大纲')) {
      setState((prev) => ({ ...prev, active: 'ppt-outline' }));
      return;
    }
    if (text.includes('查看脚本') && videoResult) {
      setState((prev) => ({ ...prev, active: 'video-script' }));
      return;
    }
    if (text.includes('生成设计')) {
      confirmPptDesigns();
      return;
    }
    if (text.includes('从文案生成大纲')) {
      outlineFromCopy();
      return;
    }
    if (wizard?.active) {
      handlePptWizardReply(text, inputValue.trim());
      return;
    }
    if (text.includes('生成大纲')) {
      if (stateRef.current.active === 'ppt-outline' || pptOutline) {
        setState((prev) => ({ ...prev, active: 'ppt-outline' }));
        return;
      }
    }
    if (shouldPreferVisualFlow(entryContext, text)) {
      const templateHint =
        entryContext?.intent === 'visual-template' ? entryContext.templateTitle : undefined;
      startVisualFlow(text, { skipUserMsg: true, templateHint });
      return;
    }
    const inPptEntry = isPptEntryIntent(entryContext);
    const parsedAud = parseAudience(text);
    const parsedScen = parseScenario(text);
    if (
      inPptEntry &&
      (parsedAud || parsedScen) &&
      text.trim().length <= 24 &&
      !text.includes('生成文案')
    ) {
      startPptFlow(text, { skipUserMsg: true });
      return;
    }
    if (text.includes('编辑器') || text === '打开视觉编辑器') {
      const idx = selectedImages.findIndex(Boolean);
      const pick = idx >= 0 ? idx : 0;
      openImageEditor(generatedImages[pick] || posterData, pick);
      return;
    }
    if (text.includes('生成视频脚本') || (text.includes('视频脚本') && text.includes('生成'))) {
      runVideo(text, { skipUserMsg: true });
      return;
    }
    if (text === '生成视频' || (text.includes('生成视频') && !text.includes('脚本'))) {
      confirmVideoRender();
      return;
    }
    if (
      text.includes('Veeva') ||
      text.includes('veeva') ||
      text.includes('提交当前') ||
      (text.includes('提交') && text.includes('审批'))
    ) {
      runSubmit({ skipUserMsg: true });
      return;
    }
    if (text.includes('文案') && (text.includes('生成') || text.includes('批量'))) {
      runCopy(text, { skipUserMsg: true });
      return;
    }
    if (text.includes('生成文案')) {
      runCopy(text, { skipUserMsg: true });
      return;
    }
    if (
      (text.includes('图片') || text.includes('配图') || text.includes('海报')) &&
      !text.includes('团队修改邀请')
    ) {
      const templateHint =
        entryContext?.intent === 'visual-template' && entryContext.templateTitle
          ? entryContext.templateTitle
          : undefined;
      startVisualFlow(text, { skipUserMsg: true, templateHint });
      return;
    }
    if (text.includes('PPT') || text.includes('ppt')) {
      startPptFlow(text, { skipUserMsg: true });
      return;
    }
    if (text.includes('视频')) {
      runVideo(text, { skipUserMsg: true });
      return;
    }
    if (text.includes('团队') && text.includes('修改')) {
      if (text.includes('整合') || text.includes('反馈')) {
        runTeam({ skipUserMsg: true, feedback: text });
      } else {
        openTeamReview(resolveTeamReviewType(text, activeTab));
      }
      return;
    }
    dispatchUserIntent(text, true);
  };

  const nextPrompts = (): string[] => {
    const base = ['生成图片', '生成PPT', '生成视频', '生成话题洞察', '生成文案'];
    if (state.visual && generatedImages.length) {
      return ['进入团队修改', '提交当前版本到Veeva Vault', ...base.slice(0, 3)];
    }
    if (state.copy || state.insight) {
      return ['生成图片', '生成PPT', '生成视频', '提交当前版本到Veeva Vault'];
    }
    return base;
  };

  const addTab = (key: TabKey) => {
    setState(prev => {
      if (!prev.tabs.includes(key)) {
        return { ...prev, tabs: [...prev.tabs, key], active: key };
      }
      return { ...prev, active: key };
    });
  };

  const openDetail = (title: string, body: string) => {
    setModalContent({ title, body });
    setShowModal(true);
  };

  const openVisualEditor = (src: string, target: EditorTarget, initialSvg?: string) => {
    let svg = initialSvg?.trim() || undefined;
    if (!svg && src.startsWith('data:image/svg+xml')) {
      svg = parseSvgFromDataUrl(src);
    }
    setEditorTarget(target);
    setEditorSrc(src);
    setEditorSvg(svg);
    setDrawerOpen(true);
    setShowModal(false);
  };

  const openImageEditor = (src: string, index: number) => {
    openVisualEditor(src, { kind: 'image', index });
  };

  const openPptSlideEditor = (index: number) => {
    if (!pptResult?.slides[index]) return;
    const slide = pptResult.slides[index];
    openVisualEditor(slideToPreviewUrl(slide), { kind: 'ppt-slide', index }, slide.svg);
  };

  const touchActiveReviewTask = () => {
    if (!activeReviewTaskId) return;
    const task = getReviewTask(activeReviewTaskId);
    if (task && task.status !== 'completed') {
      upsertReviewTask({ ...task, status: 'in_progress' });
      refreshReviewTasks();
    }
  };

  const acceptImageReview = (index: number) => {
    setImageReviewStatuses((statuses) => {
      const { statuses: aligned } = alignImageReviewArrays(
        generatedImages,
        imageReviewOrigins,
        statuses
      );
      const next = [...aligned];
      next[index] = 'accepted';
      return next;
    });
    setImageReviewOrigins((origins) => {
      const { origins: aligned } = alignImageReviewArrays(
        generatedImages,
        origins,
        imageReviewStatuses
      );
      const next = [...aligned];
      next[index] = generatedImages[index];
      return next;
    });
    toast(`已采纳配图 ${index + 1} 的修改`);
  };

  const rejectImageReview = (index: number) => {
    const { origins } = alignImageReviewArrays(
      generatedImages,
      imageReviewOrigins,
      imageReviewStatuses
    );
    const original = origins[index];
    if (original) {
      setGeneratedImages((prev) => prev.map((img, i) => (i === index ? original : img)));
    }
    setImageReviewStatuses((statuses) => {
      const { statuses: aligned } = alignImageReviewArrays(
        generatedImages,
        imageReviewOrigins,
        statuses
      );
      const next = [...aligned];
      next[index] = 'rejected';
      return next;
    });
    toast(`配图 ${index + 1} 已恢复为原图`);
  };

  const acceptAllImageReviews = () => {
    const { origins, statuses } = alignImageReviewArrays(
      generatedImages,
      imageReviewOrigins,
      imageReviewStatuses
    );
    setImageReviewStatuses(statuses.map((s) => (s === 'pending' ? 'accepted' : s)));
    setImageReviewOrigins(
      generatedImages.map((img, i) => (statuses[i] === 'pending' ? img : origins[i]))
    );
    toast('已采纳全部待审配图修改');
  };

  const rejectAllImageReviews = () => {
    const { origins, statuses } = alignImageReviewArrays(
      generatedImages,
      imageReviewOrigins,
      imageReviewStatuses
    );
    setGeneratedImages((prev) =>
      prev.map((img, i) => (statuses[i] === 'pending' ? origins[i] ?? img : img))
    );
    setImageReviewStatuses((statuses) =>
      statuses.map((s) => (s === 'pending' ? 'rejected' : s))
    );
    toast('已全部恢复为原图');
  };

  const handleEditorUpdate = (dataUrl: string, svg?: string) => {
    if (editorTarget?.kind === 'image') {
      const index = editorTarget.index;
      setGeneratedImages((prev) => {
        const oldUrl = prev[index];
        if (isReviewerRole(userRole) && oldUrl && oldUrl !== dataUrl) {
          setImageReviewOrigins((origins) => {
            const { origins: aligned } = alignImageReviewArrays(prev, origins, []);
            const next = [...aligned];
            if (!origins[index] || origins.length !== prev.length) {
              next[index] = oldUrl;
            }
            return next;
          });
          setImageReviewStatuses((statuses) => {
            const { statuses: aligned } = alignImageReviewArrays(prev, [], statuses);
            const next = [...aligned];
            next[index] = 'pending';
            return next;
          });
        }
        return prev.map((img, i) => (i === index ? dataUrl : img));
      });
      touchActiveReviewTask();
      toast(
        activeReviewTaskId && isReviewerRole(userRole)
          ? '配图已保存，待内容运营采纳或恢复原图'
          : '图片已更新'
      );
    } else if (editorTarget?.kind === 'ppt-slide' && pptResult) {
      const idx = editorTarget.index;
      const slides = pptResult.slides.map((s, i) =>
        i === idx ? { ...s, svg: svg || s.svg } : s
      );
      setPptResult({ ...pptResult, slides });
      if (selectedPptVersionId) {
        setPptVersions((prev) =>
          prev.map((v) =>
            v.id === selectedPptVersionId ? { ...v, slides } : v
          )
        );
      }
      touchActiveReviewTask();
      toast(
        activeReviewTaskId && isReviewerRole(userRole)
          ? `第 ${slides[idx]?.page ?? idx + 1} 页已保存`
          : `第 ${slides[idx]?.page ?? idx + 1} 页已更新`
      );
    }
    setEditorSrc(dataUrl);
    if (svg) setEditorSvg(svg);
  };

  const handleEditorExport = () => {
    if (!editorSrc) return;
    const name =
      editorTarget?.kind === 'ppt-slide'
        ? `PPT-第${(editorTarget.index ?? 0) + 1}页.png`
        : '配图编辑.png';
    downloadDataUrl(editorSrc, name);
    toast('已导出 PNG');
  };

  const openReviewTask = (taskId: string) => {
    const task = getReviewTask(taskId);
    if (!task) {
      toast('任务不存在');
      return;
    }
    updateTaskStatus(taskId, 'in_progress');
    refreshReviewTasks();
    setActiveReviewTaskId(taskId);
    openSession(task.sessionId);
    setCurrentScreen('workspace');
    const session = getSession(task.sessionId);
    const tabs = reviewerTabsForContentType(task.contentType, session?.workspace);
    setState((prev) => ({
      ...prev,
      active: tabs[0],
      tabs,
    }));
    const revisionBase =
      sessionCopyRevisionBase(task.sessionId) ||
      task.copyRevisionBase ||
      task.baseCopyText ||
      '';
    const mergedRevisions = mergeSessionCopyRevisions(task.sessionId);
    if (revisionBase) setCopyRevisionBase(revisionBase);
    setCopyRevisions(
      mergedRevisions.length ? mergedRevisions : task.copyRevisions ?? []
    );
  };

  const applyFigmaCapture = useCallback(
    (preset: string) => {
      seedReviewTasksIfEmpty();
      seedSessionsIfEmpty();
      refreshReviewTasks();
      setSessions(loadAllSessions());
      isHydratingRef.current = true;

      const demoCopy =
        '肾脏健康常常被忽略。了解相关风险因素，出现疑问时请咨询专业医生。';
      const demoCopyEdited =
        '肾脏健康需要长期关注。了解相关风险因素，出现疑问时请咨询专业医生。';
      const sampleImages = [posterData, posterData];

      const loadDemo = () => {
        const session = getSession(DEMO_SESSION_ID);
        if (session) loadSessionIntoApp(session);
        setCurrentScreen('workspace');
        return session;
      };

      switch (preset) {
        case 'home-ops':
          saveUserRole('ops');
          setUserRole('ops');
          setActiveReviewTaskId(null);
          setDrawerOpen(false);
          setCurrentScreen('home');
          break;
        case 'home-reviewer':
          saveUserRole('medical');
          setUserRole('medical');
          setActiveReviewTaskId(null);
          setDrawerOpen(false);
          setCurrentScreen('home');
          break;
        case 'library':
          saveUserRole('ops');
          setUserRole('ops');
          setActiveReviewTaskId(null);
          setDrawerOpen(false);
          setCurrentScreen('library');
          break;
        case 'workspace-copy': {
          saveUserRole('ops');
          setUserRole('ops');
          setActiveReviewTaskId(null);
          setDrawerOpen(false);
          const hcp = getSession('sess_demo_hcp');
          if (hcp) loadSessionIntoApp(hcp);
          setCurrentScreen('workspace');
          setState((prev) => ({
            ...prev,
            tabs: ['copy'],
            active: 'copy',
            copy: true,
            visual: false,
            team: false,
          }));
          break;
        }
        case 'workspace-visual': {
          saveUserRole('ops');
          setUserRole('ops');
          setActiveReviewTaskId(null);
          setDrawerOpen(false);
          loadDemo();
          setGeneratedImages(sampleImages);
          setImageReviewOrigins([...sampleImages]);
          setImageReviewStatuses(['pending', null]);
          setSelectedImages([true, false]);
          setState((prev) => ({
            ...prev,
            tabs: ['visual'],
            active: 'visual',
            visual: true,
            copy: false,
            team: false,
          }));
          break;
        }
        case 'workspace-team': {
          saveUserRole('ops');
          setUserRole('ops');
          setActiveReviewTaskId(null);
          setDrawerOpen(false);
          loadDemo();
          setState((prev) => ({
            ...prev,
            tabs: ['team'],
            active: 'team',
            team: true,
          }));
          break;
        }
        case 'reviewer-copy': {
          saveUserRole('medical');
          setUserRole('medical');
          setDrawerOpen(false);
          loadDemo();
          setCopies([
            {
              title: '小红书疾病教育',
              body: demoCopyEdited,
              compliance: '已标注合规提示',
            },
          ]);
          setCopyRevisionBase(demoCopy);
          setCopyRevisions([
            createCopyRevision(demoCopy, demoCopyEdited, 'medical'),
          ]);
          setActiveReviewTaskId('rt_demo_medical');
          setState((prev) => ({
            ...prev,
            tabs: ['copy'],
            active: 'copy',
            copy: true,
          }));
          break;
        }
        case 'reviewer-visual': {
          saveUserRole('medical');
          setUserRole('medical');
          setDrawerOpen(false);
          loadDemo();
          setGeneratedImages(sampleImages);
          setSelectedImages([true, true]);
          setActiveReviewTaskId('rt_demo_visual');
          setState((prev) => ({
            ...prev,
            tabs: ['visual'],
            active: 'visual',
            visual: true,
          }));
          break;
        }
        case 'visual-editor': {
          saveUserRole('ops');
          setUserRole('ops');
          setActiveReviewTaskId(null);
          loadDemo();
          setGeneratedImages(sampleImages);
          setState((prev) => ({
            ...prev,
            tabs: ['visual'],
            active: 'visual',
            visual: true,
          }));
          setEditorTarget({ kind: 'image', index: 0 });
          setEditorSrc(sampleImages[0]);
          setDrawerOpen(true);
          break;
        }
        default:
          break;
      }

      requestAnimationFrame(() => {
        isHydratingRef.current = false;
      });
    },
    [loadSessionIntoApp]
  );

  useEffect(() => {
    const captureId = parseFigmaCaptureId();
    if (!captureId) return;
    document.body.setAttribute('data-figma-capture', captureId);
    applyFigmaCapture(captureId);
  }, [applyFigmaCapture]);

  const syncReviewTaskArtifacts = (
    revisions: CopyRevision[],
    revisionBase: string,
    status?: ReviewTask['status']
  ) => {
    if (!activeReviewTaskId) return;
    const task = getReviewTask(activeReviewTaskId);
    if (!task) return;
    if (task.contentType === 'copy') {
      propagateCopyRevisionsToSession(task.sessionId, revisions, revisionBase, {
        activeTaskId: activeReviewTaskId,
        statusForActive: status,
      });
    } else {
      upsertReviewTask({
        ...task,
        status: status ?? task.status,
        copyRevisions: revisions,
        copyRevisionBase: revisionBase,
        baseCopyText: task.baseCopyText || revisionBase,
      });
    }
    refreshReviewTasks();
  };

  const completeReviewTask = () => {
    if (!activeReviewTaskId) return;
    const task = getReviewTask(activeReviewTaskId);
    if (task) {
      const revisionBase =
        copyRevisionBase || task.copyRevisionBase || task.baseCopyText || '';
      if (task.contentType === 'copy') {
        propagateCopyRevisionsToSession(task.sessionId, copyRevisions, revisionBase, {
          activeTaskId: activeReviewTaskId,
          statusForActive: 'completed',
        });
      } else {
        upsertReviewTask({
          ...task,
          status: 'completed',
          copyRevisions,
          copyRevisionBase: revisionBase,
        });
      }
    } else {
      updateTaskStatus(activeReviewTaskId, 'completed');
    }
    refreshReviewTasks();
    toast('已标记为修改完成');
    setActiveReviewTaskId(null);
    if (isReviewerRole(userRole)) {
      setCurrentScreen('home');
    }
  };

  const saveCopyReview = (newText: string) => {
    const base = copyRevisionBase || getActiveCopyBody() || copies[0]?.body || '';
    const revisionBase = copyRevisionBase || base;
    if (!copyRevisionBase) setCopyRevisionBase(revisionBase);
    const prevText =
      copyRevisions.length > 0
        ? copyRevisions[copyRevisions.length - 1].resultText
        : revisionBase;
    const revision = createCopyRevision(prevText, newText, userRole);
    const next = [...copyRevisions, revision];
    setCopyRevisions(next);
    if (copies.length) {
      const updated = [...copies];
      updated[0] = { ...updated[0], body: newText };
      setCopies(updated);
    } else if (teamResult?.contentType === 'copy') {
      setTeamResult({ ...teamResult, after: newText });
    }
    syncReviewTaskArtifacts(next, revisionBase, 'in_progress');
    toast('文案修改已保存，运营端可查看增删记录');
  };

  const savePptOutlineReview = () => {
    if (!pptOutline) {
      toast('暂无 PPT 大纲可保存');
      return;
    }
    touchActiveReviewTask();
    persistCurrentSession();
    toast('PPT 大纲修改已保存，内容运营可在「PPT大纲」中查看');
  };

  const handleEditorGenerate = async (params: {
    editPrompt: string;
    maskBounds: { x: number; y: number; w: number; h: number } | null;
    svg?: string;
    layers: import('@/app/components/VisualEditor').DragLayer[];
  }) => {
    const result = await api.generatePosterEdit({
      svg: params.svg,
      editPrompt: params.editPrompt,
      maskBounds: params.maskBounds,
      layers: params.layers,
      copyBody: getActiveCopyBody(),
    });
    return { dataUrl: result.dataUrl, svg: result.svg, title: result.title };
  };

  const openMaterialPicker = (
    target: 'workspace' | 'chat',
    cat = '参考知识',
    tab: 'upload' | 'cms' = 'upload'
  ) => {
    setPickerTarget(target);
    setPickerCat(cat);
    setPickerTab(tab);
    setPickerOpen(true);
  };

  const handleMaterialPicked = (item: PickedMaterial) => {
    const now = Date.now();
    setLibrary((prev) => [
      {
        id: now,
        cat: item.cat,
        title: item.title,
        meta: item.meta,
        cms: item.cms,
        def: pickerTarget === 'workspace',
        addedAt: now,
        fileName: item.fileName,
        contentType: item.contentType,
        contentText: item.contentText,
        contentUrl: item.contentUrl,
        mimeType: item.mimeType,
      },
      ...prev,
    ]);
    const pill = materialAttachmentPill(item);
    setAttachments((prev) => [...prev.filter((p) => !p.endsWith('×')), pill]);
    toast(pickerTarget === 'chat' ? '附件已加入本次对话' : `已添加素材到「${item.cat}」`);
    if (pickerTarget === 'chat') {
      addMsg(
        'ai',
        `已添加素材「${item.title}」。你可以继续说明创作目标，例如生成图片、文案或 PPT。`,
        'DeepSeek-V3.1',
        nextPrompts()
      );
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredLibrary = library
    .filter(x => x.cat === activeCat)
    .filter(x => !libSearch || x.title.toLowerCase().includes(libSearch.toLowerCase()) || x.meta.toLowerCase().includes(libSearch.toLowerCase()))
    .filter(x => !onlyDefault || x.def);

  const libSelectedCount = libSelectedIds.length;
  const allVisibleSelected =
    filteredLibrary.length > 0 && filteredLibrary.every((x) => libSelectedIds.includes(x.id));

  const toggleLibSelect = (id: number) => {
    setLibSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredLibrary.map((x) => x.id);
    setLibSelectedIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return [...new Set([...prev, ...visibleIds])];
    });
  };

  const startChatWithSelectedMaterials = () => {
    const items = library.filter((x) => libSelectedIds.includes(x.id));
    if (!items.length) return;
    setLibSelectedIds([]);
    setCurrentScreen('workspace');
    reset('', { intent: 'general' }, { attachedMaterials: items });
    toast(`已创建新对话，带入 ${items.length} 项素材`);
  };

  const defaultCount = library.filter(x => x.def).length;
  const activeReviewTask = activeReviewTaskId ? getReviewTask(activeReviewTaskId) : undefined;
  const reviewFocusMode = Boolean(activeReviewTaskId && isReviewerRole(userRole));
  const reviewerAllowedTabs =
    reviewFocusMode && activeReviewTask
      ? reviewerTabsForContentType(activeReviewTask.contentType, {
          pptOutline,
          pptVersions,
          pptResult,
          videoVersions,
        })
      : null;

  const activeProjectName = useMemo(() => {
    if (!activeProjectId) return null;
    return loadAllProjects().find((p) => p.id === activeProjectId)?.name ?? null;
  }, [activeProjectId, sessions]);

  const libraryCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cats) {
      counts[c] = library.filter((x) => x.cat === c).length;
    }
    return counts;
  }, [library]);

  const librarySelectedByCategory = useMemo(() => {
    const selected = new Set(libSelectedIds);
    const counts: Record<string, number> = {};
    for (const c of cats) {
      counts[c] = library.filter((x) => x.cat === c && selected.has(x.id)).length;
    }
    return counts;
  }, [library, libSelectedIds]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AmbientOrbs />
      <header className="relative z-10 flex h-[72px] items-center justify-between border-b border-white/20 bg-white/50 px-6 backdrop-blur-xl lg:px-10">
        <div
          className="flex cursor-pointer items-center gap-3 animate-fade-up"
          onClick={() => setCurrentScreen('home')}
        >
          <div className="sparkle-surface relative grid h-11 w-11 place-items-center rounded-2xl bg-hero-gradient shadow-glow animate-gradient-pan">
            <Sparkles className="relative z-10 h-5 w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" strokeWidth={2.4} />
            <span className="absolute inset-0 rounded-2xl shadow-inset" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-foreground">
              可申达 <span className="text-gradient">AI 内容工作台</span>
            </h1>
            <p className="text-[10.5px] tracking-wide text-muted-foreground">
              Bayer AI Content Studio · Powered by DeepSeek
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-3 text-xs md:flex animate-fade-up [animation-delay:120ms]">
          <RoleSwitcher role={userRole} onChange={handleRoleChange} />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">当前品牌</span>
            <select className="rounded-lg border border-border/70 bg-glass px-3 py-1.5 font-medium text-foreground shadow-soft transition hover:border-primary/40">
              <option>可申达</option>
              <option>拜新同</option>
              <option>拜唐苹</option>
              <option>优迈</option>
              <option>爱格希</option>
            </select>
          </div>
        </div>
      </header>

      {/* Home Screen */}
      <section className={`screen home-screen ${currentScreen === 'home' ? 'active' : ''}`}>
        <div className={`relative z-10 flex min-h-0 gap-6 px-6 pb-6 lg:px-10 ${!isReviewerRole(userRole) ? 'h-[calc(100vh-72px)]' : 'min-h-[calc(100vh-72px)]'}`}>
            {!isReviewerRole(userRole) && (
              <HomeHistorySidebar
                open={homeHistoryOpen}
                sessions={sessions}
                activeProjectId={activeProjectId}
                currentSessionId={currentSessionId}
                sessionSearch={sessionSearch}
                onSessionSearchChange={setSessionSearch}
                onCollapse={() => setHomeHistoryOpen(false)}
                onExpand={() => setHomeHistoryOpen(true)}
                onOpenSession={openSession}
                onDeleteSession={(id, title) => setDeleteConfirm({ id, title })}
                onActiveProjectChange={setActiveProjectId}
                onProjectsChange={() => {}}
                onSessionsChange={refreshSessionList}
                deriveSessionSubtitle={deriveSessionSubtitle}
                deriveSessionStatus={deriveSessionStatus}
                sessionStatusLabel={sessionStatusLabel}
                sessionStatusBadgeClass={sessionStatusBadgeClass}
                formatSessionTime={formatSessionTime}
              />
            )}

            <main className="relative min-h-0 min-w-0 flex-1">
              <div className="absolute right-0 top-0 z-20 animate-fade-up">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1.5 text-xs font-medium text-foreground shadow-soft backdrop-blur-md transition hover:border-primary/40 hover:text-primary"
                  onClick={() => setCurrentScreen('library')}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-[#54B9F9] to-[#8AD329] shadow-[0_3px_8px_-2px_rgba(46,143,214,0.5)] ring-1 ring-white/40">
                    <LibraryIcon className="h-3 w-3 text-white" strokeWidth={2.5} />
                  </span>
                  素材库
                </button>
              </div>

              {isReviewerRole(userRole) ? (
                <div className="px-2 pt-2">
                  <ReviewerHome
                    tasks={tasksForRole(userRole)}
                    deptLabel={ROLE_PROFILES[userRole].dept}
                    onOpenTask={openReviewTask}
                  />
                </div>
              ) : (
                <div className="relative mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-2 pb-8 pt-12 lg:pt-16">
                  {activeProjectName && (
                    <div className="relative z-10 mb-5 text-center animate-fade-up">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1.5 text-xs text-muted-foreground shadow-soft backdrop-blur-md">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>新建对话将归入项目「{activeProjectName}」</span>
                        <button type="button" className="font-medium text-primary hover:underline" onClick={() => setActiveProjectId(null)}>
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  <SparkleField />

                  <div
                    className={cn(
                      'relative z-10 mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium shadow-soft backdrop-blur-md animate-fade-up',
                      apiReady === false
                        ? 'border-amber-200/80 bg-amber-50/80 text-amber-800'
                        : 'border-white/40 bg-white/70 text-muted-foreground'
                    )}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      {apiReady !== false && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-[#8AD329] opacity-75" />
                      )}
                      <span
                        className={cn(
                          'relative inline-flex h-1.5 w-1.5 rounded-full',
                          apiReady === false ? 'bg-amber-500' : apiReady === null ? 'bg-slate-400' : 'bg-[#8AD329]'
                        )}
                      />
                    </span>
                    {apiReady === false
                      ? 'DeepSeek · 暂不可用'
                      : apiReady === null
                        ? 'DeepSeek · 检测中…'
                        : 'DeepSeek · 在线就绪'}
                  </div>

                  <h2 className="relative z-10 text-center text-[40px] font-bold leading-[1.1] tracking-tight md:text-[52px] animate-fade-up [animation-delay:80ms]">
                    <span className="text-gradient animate-gradient-pan">今天你有什么灵感？</span>
                  </h2>
                  <p className="relative z-10 mt-4 max-w-md text-center text-[13.5px] leading-relaxed text-muted-foreground animate-fade-up [animation-delay:160ms]">
                    无论是话题洞察、生成图片，还是生成 PPT，一切需求，在输入框里下达即可。
                  </p>

                  <div className="relative z-10 mt-9 w-full animate-fade-up [animation-delay:240ms]">
                    <div className="absolute -inset-px rounded-[28px] bg-hero-gradient opacity-50 blur-xl" />
                    <div className="relative rounded-[26px] border border-white/30 bg-glass-strong p-5 shadow-glow ring-1 ring-white/40">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <HomeAttachMenu
                          onUpload={() => openMaterialPicker('chat')}
                          onSelectAgent={setHomeAgentIntent}
                        />
                        {homeAgentIntent && (
                          <span className="group inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 py-1 pl-1 pr-2.5 text-xs font-medium text-primary">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-sky-600 shadow-[0_3px_8px_-2px_oklch(0.55_0.18_220/0.5)] ring-1 ring-white/40">
                              <HomeAgentIcon intent={homeAgentIntent} size={12} />
                            </span>
                            <span>{getHomeAgentLabel(homeAgentIntent)}</span>
                            <button
                              type="button"
                              className="opacity-60 transition hover:opacity-100"
                              onClick={() => setHomeAgentIntent(null)}
                              aria-label="移除 Agent"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>

                      <textarea
                        placeholder={getHomeInputPlaceholder()}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            submitHomeInput();
                          }
                        }}
                        rows={3}
                        className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                      />

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-primary"
                          onClick={() => openMaterialPicker('chat')}
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                          拖拽至此上传
                        </button>
                        <button
                          type="button"
                          className="group inline-flex items-center gap-2 rounded-full bg-hero-gradient px-5 py-2.5 text-sm font-medium text-white shadow-glow transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                          disabled={!inputValue.trim() && !homeAgentIntent}
                          onClick={submitHomeInput}
                        >
                          开始创作
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                      {HOME_CREATION_MODES.map(({ intent, label, gradient, Icon }) => (
                        <button
                          key={intent}
                          type="button"
                          className="group overflow-hidden rounded-full border border-white/40 bg-white/60 px-3.5 py-2 text-xs font-medium text-foreground shadow-soft backdrop-blur-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/80 hover:shadow-glow"
                          onClick={() => startFromHome({ intent })}
                        >
                          <span className="relative flex items-center gap-2">
                            <span className={cn('grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br shadow-[0_4px_10px_-2px_oklch(0.55_0.18_220/0.45)] ring-1 ring-white/40', gradient)}>
                              <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
                            </span>
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </main>
        </div>
      </section>

      {/* Library Screen */}
      <section className={`screen ${currentScreen === 'library' ? 'active' : ''}`}>
        <div className="page library-page relative z-10 px-6 pb-6 lg:px-8">
          <div className="relative mb-5 animate-fade-up">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition hover:text-primary"
              onClick={() => setCurrentScreen('home')}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              返回首页
            </button>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-foreground">
                  <span className="sparkle-surface relative grid h-9 w-9 place-items-center rounded-2xl bg-hero-gradient shadow-glow animate-gradient-pan">
                    <LibraryIcon className="relative z-10 h-4 w-4 text-white" strokeWidth={2.4} />
                  </span>
                  <span>素材<span className="text-gradient">库</span></span>
                </h2>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                  管理品牌素材、默认引用与 CMS 内容，支持多选后一键带入新对话
                </p>
              </div>
              <div className="relative">
                <div className="absolute -inset-1 rounded-2xl bg-hero-gradient opacity-50 blur-xl" />
                <div className="sparkle-surface relative flex items-center gap-3 rounded-2xl bg-hero-gradient px-5 py-3 shadow-glow ring-1 ring-white/40 animate-gradient-pan">
                  <div className="text-right">
                    <div className="text-[28px] font-bold leading-none text-white">{library.length}</div>
                    <div className="mt-1 text-[10.5px] font-medium tracking-wide text-white/90">素材总数</div>
                  </div>
                  <Database className="h-5 w-5 text-white/80" strokeWidth={2.2} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-5">
            <aside className="w-[18rem] shrink-0 animate-fade-up">
              <div className="bg-glass relative flex h-[calc(100vh-12rem)] flex-col rounded-3xl border border-border/60 p-3 shadow-soft">
                <div className="flex gap-2 px-1 pb-3">
                  <button
                    type="button"
                    className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#54B9F9] to-[#2E8FD6] py-2 text-[12px] font-semibold text-white shadow-[0_6px_16px_-4px_rgba(46,143,214,0.55)] ring-1 ring-white/40 transition hover:-translate-y-0.5 hover:brightness-110"
                    onClick={() => openMaterialPicker('workspace', activeCat)}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    上传素材
                  </button>
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/60 py-2 text-[12px] font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                    onClick={() => openMaterialPicker('workspace', activeCat, 'cms')}
                  >
                    <Search className="h-3.5 w-3.5" />
                    搜索 CMS
                  </button>
                </div>

                <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Filter className="h-3 w-3" />
                  分类
                </div>

                <nav className="space-y-1 px-1" aria-label="素材分类">
                  {cats.map((c) => {
                    const isActive = c === activeCat;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          'group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition',
                          isActive
                            ? 'bg-gradient-to-r from-[#54B9F9]/15 to-[#8AD329]/10 shadow-[inset_0_0_0_1px_rgba(84,185,249,0.3)]'
                            : 'hover:bg-background/70'
                        )}
                        onClick={() => setActiveCat(c)}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#54B9F9] to-[#2E8FD6] shadow-[0_3px_8px_-2px_rgba(46,143,214,0.4)] ring-1 ring-white/40">
                          <FileText className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
                        </span>
                        <span className={cn('flex-1 text-[12.5px]', isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground/85')}>
                          {c}
                        </span>
                        <span className="flex items-center gap-1">
                          {librarySelectedByCategory[c] > 0 && (
                            <span className="rounded-full bg-[#8AD329]/15 px-1.5 text-[10px] font-semibold text-[#4a7a18]">
                              {librarySelectedByCategory[c]}
                            </span>
                          )}
                          <span
                            className={cn(
                              'grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[10.5px] font-bold',
                              isActive ? 'bg-gradient-to-br from-[#54B9F9] to-[#8AD329] text-white shadow-[0_2px_6px_-1px_rgba(46,143,214,0.5)]' : 'bg-secondary text-muted-foreground'
                            )}
                          >
                            {libraryCategoryCounts[c]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </nav>

                <div className="mt-4 flex-1 overflow-y-auto rounded-2xl border border-border/50 bg-background/40 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground">
                      <Star className="h-3 w-3 text-[#FFB547]" fill="#FFB547" />
                      默认素材
                    </div>
                    <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-gradient-to-br from-[#54B9F9] to-[#8AD329] px-1 text-[10px] font-bold text-white">
                      {defaultCount}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {cats.map((c) => {
                      const items = library.filter((x) => x.cat === c && x.def);
                      if (!items.length) return null;
                      return (
                        <div key={c}>
                          <div className="px-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                            {c}
                          </div>
                          {items.map((i) => (
                            <button
                              key={i.id}
                              type="button"
                              className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-foreground/85 transition hover:bg-background/80"
                              onClick={() => {
                                setActiveCat(c);
                                setOnlyDefault(false);
                                setPreviewMaterial(i);
                              }}
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-[#54B9F9] to-[#8AD329]" />
                              <span className="truncate">{i.title}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    {defaultCount === 0 && (
                      <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">暂无默认素材</div>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <main className="relative flex-1">
              <div className="bg-glass relative flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-3xl border border-border/60 shadow-soft">
                <SparkleField />

                <div className="relative z-10 flex items-center gap-2.5 border-b border-border/50 p-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="w-full rounded-xl border border-border/60 bg-white/80 py-2.5 pl-9 pr-3 text-[12.5px] placeholder:text-muted-foreground/70 focus:border-[#54B9F9]/50 focus:outline-none focus:ring-2 focus:ring-[#54B9F9]/15"
                      placeholder="搜索素材名称、来源、标签…"
                      value={libSearch}
                      onChange={(e) => setLibSearch(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition',
                      onlyDefault
                        ? 'border-[#54B9F9]/40 bg-gradient-to-r from-[#54B9F9]/15 to-[#8AD329]/10 text-[#1f6ea8] shadow-[0_3px_10px_-3px_rgba(46,143,214,0.4)]'
                        : 'border-border/60 bg-background/60 text-foreground hover:border-primary/40'
                    )}
                    onClick={() => setOnlyDefault(!onlyDefault)}
                  >
                    <Star className={cn('h-3 w-3', onlyDefault && 'text-[#FFB547]')} fill={onlyDefault ? '#FFB547' : 'none'} />
                    仅默认
                  </button>
                </div>

                <div className="relative z-10 flex items-center justify-between px-5 pb-2.5 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-[#54B9F9] to-[#2E8FD6] shadow-[0_4px_10px_-2px_rgba(46,143,214,0.5)] ring-1 ring-white/40">
                      <FileText className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
                    </span>
                    <h3 className="text-[14.5px] font-semibold text-foreground">{activeCat}</h3>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                      {filteredLibrary.length} 项
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {libSelectedCount > 0 && (
                      <span className="rounded-full border border-[#8AD329]/30 bg-[#8AD329]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#4a7a18]">
                        已选 {libSelectedCount}
                      </span>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 text-[11.5px] font-medium text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                      disabled={filteredLibrary.length === 0}
                      onClick={toggleSelectAllVisible}
                    >
                      <Check className="h-3 w-3" />
                      {allVisibleSelected ? '取消全选' : '全选'}
                    </button>
                  </div>
                </div>

                <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-5">
                  {filteredLibrary.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {filteredLibrary.map((x) => (
                        <LibraryMaterialCard
                          key={x.id}
                          item={x}
                          selected={libSelectedIds.includes(x.id)}
                          onToggleSelect={() => toggleLibSelect(x.id)}
                          onToggleDefault={() => toggleDefault(x.id)}
                          onPreview={() => setPreviewMaterial(x)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                      <div className="sparkle-surface relative mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-hero-gradient shadow-glow animate-gradient-pan">
                        <FolderOpen className="relative z-10 h-6 w-6 text-white" strokeWidth={2.2} />
                      </div>
                      <p className="text-[13px] font-semibold text-foreground">该分类暂无素材</p>
                      <p className="mt-1.5 max-w-xs text-[11.5px] leading-relaxed text-muted-foreground">
                        上传本地文件，或从 CMS 搜索已审批内容加入素材库。
                      </p>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-hero-gradient px-4 py-2 text-[12px] font-semibold text-white shadow-glow transition hover:brightness-110"
                          onClick={() => openMaterialPicker('workspace', activeCat)}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          上传素材
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-border/60 bg-background/60 px-4 py-2 text-[12px] font-medium text-foreground transition hover:border-primary/40"
                          onClick={() => openMaterialPicker('workspace', activeCat, 'cms')}
                        >
                          搜索 CMS
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {libSelectedCount > 0 && (
                  <div className="relative z-10 border-t border-border/50 bg-gradient-to-b from-transparent to-white/60 p-4 animate-fade-up">
                    <div className="flex items-center justify-between">
                      <div className="text-[12.5px] text-muted-foreground">
                        已选 <span className="font-semibold text-foreground">{libSelectedCount}</span> 项素材
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-border/60 bg-background/60 px-3.5 py-2 text-[12px] font-medium text-foreground transition hover:border-primary/40"
                          onClick={() => setLibSelectedIds([])}
                        >
                          清空
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-hero-gradient px-4 py-2 text-[12.5px] font-semibold text-white shadow-glow transition hover:brightness-110 active:scale-[0.98]"
                          onClick={startChatWithSelectedMaterials}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          添加至新对话
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </section>

      {/* Workspace Screen */}
      <section className={`screen ${currentScreen === 'workspace' ? 'active' : ''}`}>
        <div className={`workspace relative z-10 ${reviewFocusMode ? 'reviewer-focus' : ''} ${!reviewFocusMode && !contextPanelOpen ? 'context-collapsed' : ''}`}>
          {!reviewFocusMode && (
          <aside className={`wpanel context context-sidebar ${contextPanelOpen ? 'open' : 'collapsed'}`}>
            {contextPanelOpen ? (
              <>
                <div className="context-sidebar-head">
                  <div className="context-sidebar-head-row">
                    <div className="context-sidebar-head-title">
                      <span className="context-sidebar-head-icon" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                          <path d="M16 13H8" />
                          <path d="M16 17H8" />
                          <path d="M10 9H8" />
                        </svg>
                      </span>
                      <h3 className="section-title context-sidebar-title">引用素材</h3>
                    </div>
                    <button
                      type="button"
                      className="context-sidebar-collapse-btn"
                      onClick={() => setContextPanelOpen(false)}
                      title="收起引用素材"
                      aria-label="收起引用素材"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="context-scroll">
                  <ContextMaterialsPanel
                    library={library}
                    categories={cats}
                    onOpenPicker={(c) => openMaterialPicker('workspace', c)}
                    onPreview={setPreviewMaterial}
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                className="context-sidebar-expand-tab"
                onClick={() => setContextPanelOpen(true)}
                title="展开引用素材"
                aria-label="展开引用素材"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                <span className="context-sidebar-expand-label">素材</span>
              </button>
            )}
          </aside>
          )}

          {!reviewFocusMode ? (
          <main className="wpanel chat relative overflow-hidden">
            <SparkleField />
            <div className="relative z-10 flex h-full flex-col">
            <div className="chat-head">
              <div className="chat-title">
                {isEditingTitle ? (
                  <input
                    type="text"
                    className="input"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    onBlur={commitTitleEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitTitleEdit();
                      }
                      if (e.key === 'Escape') {
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                    style={{ fontSize: '16px', fontWeight: '700', padding: '4px 8px' }}
                  />
                ) : (
                  <h3 onClick={() => setIsEditingTitle(true)} style={{ cursor: 'pointer' }}>
                    {taskTitle}
                  </h3>
                )}
                <div className="small">点击标题可手动修改；AI 仅在首次对话后自动命名一次</div>
              </div>
            </div>

            {activeReviewTaskId && activeReviewTask && (
                <div className="review-task-banner">
                  <div>
                    <strong>团队修改任务</strong>
                    <div className="small">
                      {activeReviewTask.title} · 截止 {activeReviewTask.deadline.replace('T', ' ')} · 分配人 {activeReviewTask.assignerName}
                    </div>
                  </div>
                  <div className="quick-row">
                    <button
                      type="button"
                      className="btn soft"
                      onClick={() => {
                        setActiveReviewTaskId(null);
                        setCurrentScreen('home');
                      }}
                    >
                      返回任务列表
                    </button>
                  </div>
                </div>
            )}

            <div className="chat-feed" ref={feedRef}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`msg ${msg.role}`}>
                  <div className="avatar">{msg.role === 'user' ? '我' : 'AI'}</div>
                  <div className="bubble">
                    {msg.role === 'ai' && msg.model ? (
                      <div className="model-note">{msg.model}</div>
                    ) : null}
                    <div dangerouslySetInnerHTML={{ __html: msg.html }} />
                    {msg.quick && msg.quick.length > 0 && (
                      <div className="chips">
                        {msg.quick.map((q, i) => (
                          <button
                            key={i}
                            type="button"
                            className="chip"
                            onClick={() => fillQuick(q)}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="composer">
              {attachments.length > 0 && (
                <div className="attach-row">
                  {attachments.map((pill, i) => (
                    <span
                      key={`${pill}-${i}`}
                      className={`attach-pill ${pill.endsWith('×') ? 'removable' : ''}`}
                      onClick={() => pill.endsWith('×') && removeAttachment(i)}
                      title={pill.endsWith('×') ? '点击移除' : undefined}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              )}
              {selectedPrompt && (
                <div className="attach-row">
                  <span className="prompt-token">{selectedPrompt}</span>
                </div>
              )}

              <div className="compose-line">
                <button className="icon-btn" title="上传本地文件或搜索 CMS" onClick={() => openMaterialPicker('chat')}>＋</button>
                <select
                  className="model-select"
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                >
                  <option>DeepSeek-V3.1</option>
                  <option>DeepSeek-Chat</option>
                </select>
                <textarea
                  placeholder={getComposerPlaceholder()}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button className="btn primary" onClick={send}>发送</button>
              </div>
            </div>
            </div>
          </main>
          ) : (
          <main className="wpanel reviewer-task-main">
            {activeReviewTask && (
              <>
                <div className="review-task-banner reviewer-task-banner-main">
                  <div>
                    <strong>{activeReviewTask.title}</strong>
                    <div className="small">
                      {ROLE_PROFILES[userRole].dept}审阅 · 截止 {activeReviewTask.deadline.replace('T', ' ')} · 分配人 {activeReviewTask.assignerName}
                    </div>
                    <div className="small" style={{ marginTop: 6 }}>
                      {activeReviewTask.contentType === 'ppt'
                        ? '请在「PPT大纲」中修改章节与页面要点并保存；无需生成 PPT 成品。'
                        : '请仅修改右侧已生成的内容；保存后运营可在任务中查看修改详情。'}
                    </div>
                  </div>
                  <div className="quick-row">
                    <button type="button" className="btn primary" onClick={completeReviewTask}>
                      标记修改完成
                    </button>
                    <button
                      type="button"
                      className="btn soft"
                      onClick={() => {
                        setActiveReviewTaskId(null);
                        setCurrentScreen('home');
                      }}
                    >
                      返回任务列表
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
          )}

          <WorkspaceRightPanel
            state={state}
            setState={setState}
            openDetail={openDetail}
            fillQuick={fillQuick}
            toast={toast}
            setDrawerOpen={setDrawerOpen}
            generatedImages={generatedImages}
            imageReviewOrigins={imageReviewOrigins}
            imageReviewStatuses={imageReviewStatuses}
            onAcceptImageReview={acceptImageReview}
            onRejectImageReview={rejectImageReview}
            onAcceptAllImageReviews={acceptAllImageReviews}
            onRejectAllImageReviews={rejectAllImageReviews}
            topics={topics}
            copies={copies}
            teamResult={teamResult}
            videoResult={videoResult}
            pptResult={pptResult}
            pptOutline={pptOutline}
            pptVersions={pptVersions}
            selectedPptVersionId={selectedPptVersionId}
            selectedPptTemplateId={selectedPptTemplateId}
            onSelectPptTemplate={setSelectedPptTemplateId}
            onPptOutlineChange={setPptOutline}
            onConfirmPptDesigns={confirmPptDesigns}
            onRegeneratePptOutline={regeneratePptOutline}
            isGenerating={isGenerating}
            onSelectPptVersion={selectPptVersion}
            onStartPptFlow={() => startPptFlow()}
            insightSummary={insightSummary}
            selectedTopics={selectedTopics}
            setSelectedTopics={setSelectedTopics}
            selectedCopies={selectedCopies}
            setSelectedCopies={setSelectedCopies}
            selectedImages={selectedImages}
            setSelectedImages={setSelectedImages}
            setEditingCopy={setEditingCopy}
            setShowCopyEditModal={setShowCopyEditModal}
            teamModificationInProgress={teamModificationInProgress}
            runCopy={runCopy}
            runInsight={runInsight}
            onOpenImageEditor={openImageEditor}
            onOpenTeamReview={openTeamReview}
            videoVersions={videoVersions}
            selectedVideoVersionId={selectedVideoVersionId}
            onConfirmVideoRender={confirmVideoRender}
            onSelectVideoVersion={selectVideoVersion}
            userRole={userRole}
            reviewerMode={reviewFocusMode}
            reviewContentType={activeReviewTask?.contentType}
            reviewerAllowedTabs={reviewerAllowedTabs}
            posterPlaceholder={posterData}
            onSavePptOutlineReview={savePptOutlineReview}
            copyRevisions={copyRevisions}
            copyRevisionBase={copyRevisionBase}
            onSaveCopyReview={saveCopyReview}
            onOpenPptSlideEditor={openPptSlideEditor}
          />
        </div>
      </section>

      {/* Visual Editor Drawer — portal 避免审阅模式下被 .screen overflow 裁切 */}
      {createPortal(
        <div
          className={`drawer ${drawerOpen && editorSrc ? 'open' : ''} ${
            reviewFocusMode ? 'reviewer-editor-drawer' : ''
          }`}
        >
          {drawerOpen && editorSrc && (
            <>
              <div className="drawer-editor-toolbar">
                <button type="button" className="btn soft" onClick={handleEditorExport}>
                  导出 PNG
                </button>
                <button type="button" className="btn" onClick={() => setDrawerOpen(false)}>
                  关闭
                </button>
              </div>
              <VisualEditor
                imageSrc={editorSrc}
                initialSvg={editorSvg}
                onClose={() => setDrawerOpen(false)}
                onUpdate={handleEditorUpdate}
                onGenerate={async (params) => {
                  setIsGenerating(true);
                  try {
                    return await handleEditorGenerate(params);
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                isGenerating={isGenerating}
              />
            </>
          )}
        </div>,
        document.body
      )}

      <MaterialPickerModal
        open={pickerOpen}
        defaultCat={pickerCat}
        initialTab={pickerTab}
        categories={cats}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleMaterialPicked}
      />

      <MaterialDetailModal item={previewMaterial} onClose={() => setPreviewMaterial(null)} />

      {/* Modal */}
      <div className={`modal-bg ${showModal ? 'show' : ''}`} onClick={e => {
        if ((e.target as HTMLElement).className.includes('modal-bg')) {
          setShowModal(false);
        }
      }}>
        <div className="modal">
          <h3>{modalContent.title}</h3>
          <div className="small" style={{ fontSize: '13px', lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: modalContent.body }} />
          <div className="quick-row">
            <button className="btn primary" onClick={() => setShowModal(false)}>关闭</button>
          </div>
        </div>
      </div>

      {/* Copy Edit Modal */}
      <div className={`modal-bg ${showCopyEditModal ? 'show' : ''}`} onClick={e => {
        if ((e.target as HTMLElement).className.includes('modal-bg')) {
          setShowCopyEditModal(false);
        }
      }}>
        <div className="modal">
          <h3>编辑文案</h3>
          <textarea
            className="inline-edit"
            value={editingCopy}
            onChange={e => setEditingCopy(e.target.value)}
            style={{ width: '100%', minHeight: '200px' }}
          />
          <div className="quick-row">
            <button className="btn primary" onClick={() => {
              const idx = selectedCopies.findIndex(Boolean);
              const i = idx >= 0 ? idx : 0;
              setCopies((prev) =>
                prev.map((c, j) => (j === i ? { ...c, body: editingCopy } : c))
              );
              toast('文案修改已保存');
              setShowCopyEditModal(false);
            }}>保存修改</button>
            <button className="btn" onClick={() => setShowCopyEditModal(false)}>取消</button>
          </div>
        </div>
      </div>

      <ImageTemplatePickerModal
        open={Boolean(imageTemplateModal)}
        preferredTitle={imageTemplateModal?.templateHint}
        onClose={() => setImageTemplateModal(null)}
        onSkip={() => {
          if (!imageTemplateModal) return;
          executeVisualGeneration(imageTemplateModal.pendingNote, []);
        }}
        onConfirm={(templateIds) => {
          if (!imageTemplateModal) return;
          executeVisualGeneration(imageTemplateModal.pendingNote, templateIds);
        }}
      />

      {/* Team Modification Modal */}
      <div className={`modal-bg ${showTeamModal ? 'show' : ''}`} onClick={e => {
        if ((e.target as HTMLElement).className.includes('modal-bg')) {
          setShowTeamModal(false);
          setTeamAssigneeRoles([]);
        }
      }}>
        <div className="modal">
          <h3>提交团队修改</h3>
          {teamReviewTarget && (
            <div className="detail-card team-review-target-card">
              <h4>本次提交内容</h4>
              <div className="small">
                类型：<strong>{TEAM_CONTENT_LABELS[teamReviewTarget]}</strong>
                {buildTeamPayload(teamReviewTarget)?.title
                  ? ` · ${buildTeamPayload(teamReviewTarget)?.title}`
                  : ''}
              </div>
            </div>
          )}
          <div className="detail-card">
            <h4>分配给（可多选）</h4>
            <div className="small" style={{ marginBottom: 10 }}>
              可同时选择医学部与市场部，将分别为每位审阅人创建修改任务。
            </div>
            <label className="option team-assignee-option">
              <input
                type="checkbox"
                checked={
                  teamAssigneeRoles.includes('medical') &&
                  teamAssigneeRoles.includes('marketing')
                }
                onChange={(e) => setAllTeamAssigneeRoles(e.target.checked)}
              />
              <div>
                <strong>全选</strong>
              </div>
            </label>
            {(['medical', 'marketing'] as const).map((role) => {
              const profile = ROLE_PROFILES[role];
              return (
                <label key={role} className="option team-assignee-option">
                  <input
                    type="checkbox"
                    checked={teamAssigneeRoles.includes(role)}
                    onChange={() => toggleTeamAssigneeRole(role)}
                  />
                  <div>
                    <strong>
                      {profile.name}（{profile.dept}）
                    </strong>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="detail-card">
            <h4>修改截止时间</h4>
            <input
              type="datetime-local"
              className="input"
              style={{ width: '100%', marginTop: '8px' }}
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>
          <div className="quick-row">
            <button
              className="btn primary"
              onClick={() => {
                if (teamAssigneeRoles.length === 0 || !deadline) {
                  toast('请至少选择一位审阅人并设置截止时间');
                  return;
                }
                if (!currentSessionId) {
                  toast('请先保存当前任务');
                  return;
                }
                const target = teamReviewTarget || 'copy';
                const label = TEAM_CONTENT_LABELS[target];
                const baseCopy = target === 'copy' ? getActiveCopyBody() || '' : '';
                if (baseCopy) setCopyRevisionBase(baseCopy);
                if (target === 'visual' && generatedImages.length > 0) {
                  setImageReviewOrigins([...generatedImages]);
                  setImageReviewStatuses(generatedImages.map(() => null));
                }

                const assigneeLabels: string[] = [];
                teamAssigneeRoles.forEach((role, index) => {
                  const assignee = ROLE_PROFILES[role];
                  const task: ReviewTask = {
                    id: `rt_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
                    sessionId: currentSessionId,
                    title: taskTitle,
                    contentType: target,
                    assigneeRole: role,
                    assigneeName: assignee.name,
                    assignerName: ROLE_PROFILES.ops.name,
                    deadline,
                    status: 'pending',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    baseCopyText: baseCopy || undefined,
                    copyRevisionBase: baseCopy || undefined,
                  };
                  upsertReviewTask(task);
                  assigneeLabels.push(`${assignee.name}（${assignee.dept}）`);
                });
                refreshReviewTasks();
                const namesText = assigneeLabels.join('、');
                setShowTeamModal(false);
                setTeamAssigneeRoles([]);
                toast(`已向 ${namesText} 分配${label}修改任务`);
                addMsg(
                  'user',
                  `向 ${namesText} 分配${label}团队修改任务（截止 ${deadline}）`,
                  selectedModel
                );
                addMsg(
                  'ai',
                  `已为 ${assigneeLabels.length} 位审阅人创建团队修改任务，他们将在各自首页任务列表中查看并修改。完成后你可在「团队修改」或「文案生成」标签查看修改详情。`,
                  'DeepSeek-V3.1'
                );
              }}
            >
              发送邀请
            </button>
            <button
              className="btn"
              onClick={() => {
                setShowTeamModal(false);
                setTeamAssigneeRoles([]);
              }}
            >
              取消
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteConfirm)}
        title="删除对话"
        message={
          deleteConfirm
            ? `确定删除「${deleteConfirm.title}」？删除后无法恢复。`
            : ''
        }
        confirmLabel="删除"
        danger
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Toast */}
      <div className={`toast ${showToast ? 'show' : ''}`}>{toastText}</div>
    </div>
  );
}

function WorkspaceRightPanel({
  state,
  setState,
  openDetail,
  fillQuick,
  toast,
  setDrawerOpen,
  generatedImages,
  imageReviewOrigins,
  imageReviewStatuses,
  onAcceptImageReview,
  onRejectImageReview,
  onAcceptAllImageReviews,
  onRejectAllImageReviews,
  topics,
  copies,
  teamResult,
  videoResult,
  pptResult,
  pptOutline,
  pptVersions,
  selectedPptVersionId,
  selectedPptTemplateId,
  onSelectPptTemplate,
  onPptOutlineChange,
  onConfirmPptDesigns,
  onRegeneratePptOutline,
  isGenerating,
  onSelectPptVersion,
  onStartPptFlow,
  insightSummary,
  selectedTopics,
  setSelectedTopics,
  selectedCopies,
  setSelectedCopies,
  selectedImages,
  setSelectedImages,
  setEditingCopy,
  setShowCopyEditModal,
  teamModificationInProgress,
  onOpenTeamReview,
  videoVersions,
  selectedVideoVersionId,
  onConfirmVideoRender,
  onSelectVideoVersion,
  runCopy,
  runInsight,
  onOpenImageEditor,
  userRole,
  reviewerMode,
  reviewContentType,
  reviewerAllowedTabs,
  posterPlaceholder,
  onSavePptOutlineReview,
  copyRevisions,
  copyRevisionBase,
  onSaveCopyReview,
  onOpenPptSlideEditor,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  openDetail: (title: string, body: string) => void;
  fillQuick: (text: string) => void;
  toast: (text: string) => void;
  setDrawerOpen: (open: boolean) => void;
  generatedImages: string[];
  imageReviewOrigins: string[];
  imageReviewStatuses: ImageReviewStatus[];
  onAcceptImageReview: (index: number) => void;
  onRejectImageReview: (index: number) => void;
  onAcceptAllImageReviews: () => void;
  onRejectAllImageReviews: () => void;
  topics: TopicItem[];
  copies: CopyItem[];
  teamResult: TeamResult | null;
  videoResult: VideoResult | null;
  pptResult: PptResult | null;
  pptOutline: PptOutline | null;
  pptVersions: PptDesignVersion[];
  selectedPptVersionId: string | null;
  selectedPptTemplateId: string | null;
  onSelectPptTemplate: (id: string | null) => void;
  onPptOutlineChange: (outline: PptOutline) => void;
  onConfirmPptDesigns: (mode?: 'template' | 'no-template') => void;
  onRegeneratePptOutline: () => void;
  isGenerating: boolean;
  onSelectPptVersion: (v: PptDesignVersion) => void;
  onStartPptFlow: () => void;
  insightSummary: string;
  selectedTopics: boolean[];
  setSelectedTopics: React.Dispatch<React.SetStateAction<boolean[]>>;
  selectedCopies: boolean[];
  setSelectedCopies: React.Dispatch<React.SetStateAction<boolean[]>>;
  selectedImages: boolean[];
  setSelectedImages: React.Dispatch<React.SetStateAction<boolean[]>>;
  setEditingCopy: React.Dispatch<React.SetStateAction<string>>;
  setShowCopyEditModal: React.Dispatch<React.SetStateAction<boolean>>;
  teamModificationInProgress: boolean;
  onOpenTeamReview: (type: TeamContentType) => void;
  videoVersions: VideoRenderVersion[];
  selectedVideoVersionId: string | null;
  onConfirmVideoRender: () => void;
  onSelectVideoVersion: (v: VideoRenderVersion) => void;
  runCopy: (note?: string) => void;
  runInsight: (note?: string) => void;
  onOpenImageEditor: (src: string, index: number) => void;
  userRole: UserRole;
  reviewerMode: boolean;
  reviewContentType?: TeamContentType;
  reviewerAllowedTabs: TabKey[] | null;
  posterPlaceholder: string;
  onSavePptOutlineReview: () => void;
  copyRevisions: CopyRevision[];
  copyRevisionBase: string;
  onSaveCopyReview: (text: string) => void;
  onOpenPptSlideEditor: (index: number) => void;
}) {
  const visibleTabs =
    reviewerMode && reviewerAllowedTabs?.length
      ? state.tabs.filter((t) => reviewerAllowedTabs.includes(t))
      : state.tabs;

  const teamReviewButton = (contentType: TeamContentType) => (
    reviewerMode ? null : (
    <div className="team-review-strip">
      <button
        type="button"
        className={`btn ${teamModificationInProgress ? '' : 'warn'}`}
        disabled={teamModificationInProgress}
        style={{
          width: '100%',
          opacity: teamModificationInProgress ? 0.6 : 1,
          cursor: teamModificationInProgress ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !teamModificationInProgress && onOpenTeamReview(contentType)}
      >
        {teamModificationInProgress ? '团队修改中...' : '提交团队修改'}
      </button>
    </div>
    )
  );

  const renderDetail = () => {
    const k = state.active;
    if (!k) {
      if (reviewerMode) {
        return (
          <div className="detail-card">
            <h4>暂无待审内容</h4>
            <div className="small">运营尚未在本任务中生成可审阅的成品，请联系内容运营同学。</div>
          </div>
        );
      }
      return (
        <div className="detail-card">
          <h4>等待生成产物</h4>
          <div className="small">当你在对话中生成话题洞察、文案、图片、视频、PPT或提交包后，这里会自动新增详情标签。</div>
        </div>
      );
    }

    if (reviewerMode && reviewerAllowedTabs?.length && !reviewerAllowedTabs.includes(k)) {
      return (
        <div className="detail-card">
          <h4>审阅内容加载中</h4>
          <div className="small">正在切换到对应产物视图…</div>
        </div>
      );
    }

    const veevaSubmitBtn = (quickText = '提交当前选中内容到Veeva Vault审批:') =>
      reviewerMode ? null : (
        <button
          type="button"
          className="btn green"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => fillQuick(quickText)}
        >
          提交 Veeva Vault 审批
        </button>
      );

    const teamAndVeevaActions = (contentType: TeamContentType, veevaQuick?: string) => (
      <>
        {teamReviewButton(contentType)}
        {veevaSubmitBtn(veevaQuick)}
      </>
    );

    switch (k) {
      case 'insight':
        if (!topics.length) {
          return (
            <div className="detail-card">
              <h4>话题洞察</h4>
              <div className="small">在对话中点击「基于素材生成话题洞察」，AI 将在此展示结果。</div>
              <button className="btn primary" style={{ marginTop: 12 }} onClick={() => runInsight()}>
                生成话题洞察
              </button>
            </div>
          );
        }
        return (
          <>
            <div className="detail-card">
              <h4>话题洞察详情</h4>
              <div className="small">{insightSummary || '基于默认素材与 DeepSeek 生成。点击话题查看详情，勾选后继续生成文案。'}</div>
            </div>
            <label className="option" style={{ marginBottom: '10px' }}>
              <input
                type="checkbox"
                checked={selectedTopics.length > 0 && selectedTopics.every((x) => x)}
                onChange={(e) => setSelectedTopics(topics.map(() => e.target.checked))}
              />
              <div><strong>全选</strong></div>
            </label>
            {topics.map((t, i) => (
              <label
                key={i}
                className="option content-tile"
                onClick={() =>
                  openDetail(
                    t.title,
                    `来源：${t.source}<br>推荐理由：${t.reason}`
                  )
                }
              >
                <input
                  type="checkbox"
                  onClick={(e) => e.stopPropagation()}
                  checked={selectedTopics[i] ?? false}
                  onChange={(e) => {
                    const newSelected = [...selectedTopics];
                    newSelected[i] = e.target.checked;
                    setSelectedTopics(newSelected);
                  }}
                />
                <div>
                  <strong>{t.title}</strong>
                  <div className="small">{t.reason}</div>
                </div>
              </label>
            ))}
            <div className="quick-row">
              <button className="btn primary" onClick={() => runCopy()}>
                基于选中话题生成文案
              </button>
              <button className="btn" onClick={() => runInsight('补充更多小红书话题')}>
                扩展话题
              </button>
            </div>
          </>
        );

      case 'copy':
        if (!copies.length && !reviewerMode) {
          return (
            <div className="detail-card">
              <h4>文案生成</h4>
              <div className="small">请先生成话题洞察，再基于此生成文案。</div>
              <button className="btn primary" style={{ marginTop: 12 }} onClick={() => runCopy()}>
                生成文案
              </button>
            </div>
          );
        }
        if (reviewerMode) {
          const revisionBase =
            copyRevisionBase ||
            copies[0]?.body ||
            teamResult?.after ||
            teamResult?.before ||
            '';
          if (!revisionBase.trim()) {
            return (
              <div className="detail-card">
                <h4>文案审阅</h4>
                <div className="small">当前任务中还没有可编辑的文案正文，请联系内容运营。</div>
              </div>
            );
          }
          const editText = latestCopyText(revisionBase, copyRevisions);
          return (
            <>
              {copyRevisions.length > 0 && (
                <div className="detail-card" style={{ background: '#f0f7ff', borderColor: '#c5daf5' }}>
                  <h4 style={{ marginTop: 0 }}>团队审阅修改（含其他审阅人）</h4>
                  <div className="small">
                    医学部与市场部的修改均会同步显示；下方编辑器已载入最新合并正文，保存后将追加你的修改记录。
                  </div>
                </div>
              )}
              {copyRevisions.length > 0 && (
                <CopyRevisionDisplay baseText={revisionBase} revisions={copyRevisions} />
              )}
              <CopyReviewEditor
                key={
                  copyRevisions.length
                    ? copyRevisions[copyRevisions.length - 1].id
                    : 'copy-base'
                }
                baseText={editText}
                role={userRole}
                onSave={onSaveCopyReview}
              />
            </>
          );
        }
        return (
          <>
            <div className="detail-card">
              <h4>文案生成详情</h4>
              <div className="small">已生成 {copies.length} 版文案（DeepSeek）。点击编辑或勾选进入团队修改。</div>
            </div>
            {copyRevisions.length > 0 && (
              <div className="detail-card" style={{ background: '#f0f7ff', borderColor: '#c5daf5' }}>
                <h4 style={{ marginTop: 0 }}>团队审阅修改</h4>
                <div className="small">
                  医学部 / 市场部已保存修改，下方为按角色着色的增删记录。
                </div>
              </div>
            )}
            {copyRevisions.length > 0 && (
              <CopyRevisionDisplay
                baseText={copyRevisionBase || copies[0]?.body || ''}
                revisions={copyRevisions}
              />
            )}
            <label className="option" style={{ marginBottom: '10px' }}>
              <input
                type="checkbox"
                checked={selectedCopies.length > 0 && selectedCopies.every((x) => x)}
                onChange={(e) => setSelectedCopies(copies.map(() => e.target.checked))}
              />
              <div><strong>全选</strong></div>
            </label>
            {copies.map((c, i) => (
              <label
                key={i}
                className="option content-tile"
                onClick={() => {
                  setEditingCopy(c.body);
                  setShowCopyEditModal(true);
                }}
              >
                <input
                  type="checkbox"
                  onClick={(e) => e.stopPropagation()}
                  checked={selectedCopies[i] ?? false}
                  onChange={(e) => {
                    const newSelected = [...selectedCopies];
                    newSelected[i] = e.target.checked;
                    setSelectedCopies(newSelected);
                  }}
                />
                <div>
                  <strong>{c.title}</strong>
                  <div className="small">{c.compliance}</div>
                </div>
              </label>
            ))}
            <div className="quick-row" style={{ marginTop: '10px' }}>
              <button className="btn soft" onClick={() => fillQuick('生成图片')}>生成图片</button>
              <button className="btn soft" onClick={() => fillQuick('生成视频')}>生成视频</button>
              <button className="btn soft" onClick={() => fillQuick('生成PPT')}>生成PPT</button>
            </div>
            {teamAndVeevaActions('copy')}
          </>
        );

      case 'team':
        if (!teamResult) {
          return (
            <div className="detail-card">
              <h4>团队修改</h4>
              <div className="small">在对话中提交团队修改邀请，或点击「进入团队修改」由 AI 整合反馈。</div>
            </div>
          );
        }
        return (
          <>
            <div className="detail-card">
              <h4>团队修改详情</h4>
              <div className="small">
                内容类型：<strong>{TEAM_CONTENT_LABELS[teamResult.contentType || 'copy']}</strong>
                {teamResult.contentTitle ? ` · ${teamResult.contentTitle}` : ''}
              </div>
              <div className="small" style={{ marginTop: 6 }}>{teamResult.summary}</div>
            </div>
            {copyRevisions.length > 0 && (
              <CopyRevisionDisplay
                baseText={copyRevisionBase || teamResult.before}
                revisions={copyRevisions}
              />
            )}
            <div
              className="copy-preview content-tile"
              onClick={() => openDetail('修改前', teamResult.before.replace(/\n/g, '<br>'))}
            >
              <strong>修改前</strong>
              <p>{teamResult.before}</p>
            </div>
            <div
              className="copy-preview content-tile"
              onClick={() =>
                openDetail(
                  '修改后',
                  `${teamResult.after.replace(/\n/g, '<br>')}<br><br>变更：${teamResult.changes?.join('；') || ''}`
                )
              }
            >
              <strong>修改后</strong>
              <p>{teamResult.after.slice(0, 120)}…</p>
              {(teamResult.changes || []).map((ch, i) => (
                <span key={i} className="badge green">
                  {ch}
                </span>
              ))}
            </div>
            <div className="quick-row">
              <button className="btn soft" onClick={() => fillQuick('生成图片')}>生成图片</button>
              <button className="btn soft" onClick={() => fillQuick('生成视频')}>生成视频</button>
              <button className="btn soft" onClick={() => fillQuick('生成PPT')}>生成PPT</button>
            </div>
            {veevaSubmitBtn()}
          </>
        );

      case 'visual': {
        const hasGenerated = generatedImages.length > 0;
        if (reviewerMode) {
          return (
            <ReviewerVisualPanel
              images={generatedImages}
              placeholderDataUrl={posterPlaceholder}
              onEditImage={onOpenImageEditor}
            />
          );
        }
        const displayImages = hasGenerated ? generatedImages : [posterData];
        const { origins: alignedOrigins, statuses: alignedStatuses } = alignImageReviewArrays(
          generatedImages,
          imageReviewOrigins,
          imageReviewStatuses
        );
        const selection = hasGenerated
          ? selectedImages.length === generatedImages.length
            ? selectedImages
            : generatedImages.map((_, i) => i === 0)
          : [];
        return (
          <>
            <div className="detail-card">
              <h4>图片生成详情</h4>
              <div className="small">
                {hasGenerated
                  ? `已生成 ${generatedImages.length} 张图片。勾选后提交团队修改；点击图片可进入编辑。`
                  : '尚未生成配图，以下为示意预览。请先在对话中生成图片。'}
              </div>
            </div>
            {hasGenerated && (
              <OpsImageReviewPanel
                images={generatedImages}
                origins={alignedOrigins}
                statuses={alignedStatuses}
                onAccept={onAcceptImageReview}
                onReject={onRejectImageReview}
                onAcceptAll={onAcceptAllImageReviews}
                onRejectAll={onRejectAllImageReviews}
              />
            )}
            {hasGenerated && (
              <label className="option" style={{ marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={selection.length > 0 && selection.every((x) => x)}
                  onChange={(e) => setSelectedImages(generatedImages.map(() => e.target.checked))}
                />
                <div><strong>全选</strong></div>
              </label>
            )}
            {displayImages.map((img, idx) => (
              <label
                key={idx}
                className="option generated-img-option"
                style={{ marginBottom: '10px' }}
              >
                {hasGenerated && (
                  <input
                    type="checkbox"
                    checked={selection[idx] ?? false}
                    onChange={(e) => {
                      const next = [...selection];
                      next[idx] = e.target.checked;
                      setSelectedImages(next);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div
                  className="generated-img-wrap content-tile"
                  onClick={() => onOpenImageEditor(img, idx)}
                >
                  {hasGenerated && alignedStatuses[idx] === 'pending' && (
                    <span className="img-review-badge">待采纳</span>
                  )}
                  {hasGenerated && alignedStatuses[idx] === 'rejected' && (
                    <span className="img-review-badge rejected">已恢复原图</span>
                  )}
                  <img className="generated-img" src={img} alt={`生成的图片 ${idx + 1}`} />
                  <span className="img-edit-hint">点击进入图片编辑</span>
                  {hasGenerated && alignedStatuses[idx] === 'pending' && (
                    <div
                      className="img-review-inline-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => onAcceptImageReview(idx)}
                      >
                        采纳
                      </button>
                      <button
                        type="button"
                        className="btn soft"
                        onClick={() => onRejectImageReview(idx)}
                      >
                        恢复原图
                      </button>
                    </div>
                  )}
                </div>
              </label>
            ))}
            {hasGenerated && (
              <>
                <div className="visual-action-strip">
                  <button
                    type="button"
                    className="btn"
                    style={{ width: '100%' }}
                    onClick={() => fillQuick('请重新生成一版更清爽、更少营销感的图片:')}
                  >
                    重新生成
                  </button>
                </div>
                {teamAndVeevaActions('visual', '提交当前图片和文案到Veeva Vault审批:')}
              </>
            )}
          </>
        );
      }

      case 'video-script':
        if (reviewerMode) {
          if (!videoResult) {
            return (
              <div className="detail-card">
                <h4>视频审阅</h4>
                <div className="small">当前任务中还没有视频脚本或成片，请联系内容运营。</div>
              </div>
            );
          }
        }
        if (!videoResult) {
          return (
            <div className="detail-card">
              <h4>视频脚本</h4>
              <div className="small">在对话中请求「生成视频脚本」后，分镜将显示在此。</div>
              <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={() => fillQuick('生成视频脚本')}>
                生成视频脚本
              </button>
            </div>
          );
        }
        if (reviewerMode) {
          return (
            <>
              <div className="detail-card detail-card-ppt-outline">
                <h4>{videoResult.title}</h4>
                <div className="small">{videoResult.coverSuggestion}</div>
              </div>
              <div className="detail-card">
                <h4>分镜列表（{videoResult.segments.length} 镜）</h4>
                <ol>
                  {videoResult.segments.map((s, i) => (
                    <li key={i}>
                      <strong>{s.time}</strong> {s.scene}
                      <div className="small">{s.narration}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          );
        }
        return (
          <>
            <div className="detail-card detail-card-ppt-outline">
              <h4>{videoResult.title}</h4>
              <div className="small">{videoResult.coverSuggestion}</div>
            </div>
            <div
              className="detail-card content-tile"
              onClick={() =>
                openDetail(
                  videoResult.title,
                  videoResult.segments
                    .map(
                      (s) =>
                        `<strong>${s.time}</strong> ${s.scene}<br>旁白：${s.narration}${s.compliance ? `<br>合规：${s.compliance}` : ''}`
                    )
                    .join('<br><br>')
                )
              }
            >
              <h4>分镜列表（{videoResult.segments.length} 镜）</h4>
              <ol>
                {videoResult.segments.map((s, i) => (
                  <li key={i}>
                    <strong>{s.time}</strong> {s.scene}
                    <div className="small">{s.narration}</div>
                  </li>
                ))}
              </ol>
            </div>
            <button type="button" className="btn primary" style={{ width: '100%' }} onClick={onConfirmVideoRender}>
              ✓ 生成视频
            </button>
            {teamAndVeevaActions('video')}
          </>
        );

      case 'video-render':
        if (reviewerMode && !videoVersions.length && videoResult) {
          return (
            <>
              <div className="detail-card detail-card-ppt-outline">
                <h4>{videoResult.title}</h4>
                <div className="small">脚本已生成，成片尚未合成。</div>
              </div>
              <div className="detail-card">
                <h4>分镜列表</h4>
                <ol>
                  {videoResult.segments.map((s, i) => (
                    <li key={i}>
                      <strong>{s.time}</strong> {s.scene}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          );
        }
        if (!videoVersions.length) {
          return (
            <div className="detail-card">
              <h4>视频生成</h4>
              <div className="small">请先在「视频脚本」中确认分镜并点击「生成视频」。</div>
              <button
                type="button"
                className="btn soft"
                style={{ marginTop: 12 }}
                onClick={() => setState((prev) => ({ ...prev, active: 'video-script' }))}
              >
                前往视频脚本
              </button>
            </div>
          );
        }
        if (reviewerMode) {
          const selectedVideo = videoVersions.find((v) => v.id === selectedVideoVersionId) || videoVersions[0];
          return (
            <>
              <div className="detail-card detail-card-ppt-design">
                <h4>视频预览</h4>
                <div className="small">{selectedVideo.name}</div>
              </div>
              <div className="video-preview-wrap">
                <video
                  className="video-preview-player"
                  src={selectedVideo.videoUrl}
                  poster={selectedVideo.posterDataUrl}
                  controls
                  preload="metadata"
                />
              </div>
            </>
          );
        }
        return (
          <>
            <div className="detail-card detail-card-ppt-design">
              <h4>视频预览</h4>
              <div className="small">共 {videoVersions.length} 套方案，演示占位成片</div>
            </div>
            <div className="video-version-grid">
              {videoVersions.map((v) => (
                <div
                  key={v.id}
                  className={`video-version-card ${selectedVideoVersionId === v.id ? 'selected' : ''}`}
                  onClick={() => onSelectVideoVersion(v)}
                >
                  <div className="video-preview-wrap">
                    <video
                      className="video-preview-player"
                      src={v.videoUrl}
                      poster={v.posterDataUrl}
                      controls
                      preload="metadata"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="video-version-meta">
                    <strong>{v.name}</strong>
                    <div className="small">
                      {v.styleTag} · {v.duration}
                      {v.isDemo ? ' · 演示' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn soft"
              onClick={() => setState((prev) => ({ ...prev, active: 'video-script' }))}
            >
              返回编辑脚本
            </button>
            <button type="button" className="btn soft" onClick={onConfirmVideoRender}>
              重新生成视频
            </button>
            {teamAndVeevaActions('video', '提交当前版本到Veeva Vault审批')}
          </>
        );

      case 'ppt-outline':
        if (!pptOutline) {
          return (
            <div className="detail-card">
              <h4>PPT 大纲</h4>
              <div className="small">
                {reviewerMode
                  ? '当前任务中还没有 PPT 大纲，请联系内容运营。'
                  : '在对话中说「生成 PPT」，确认受众与场景后将在此编辑大纲。'}
              </div>
              {!reviewerMode && (
                <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={onStartPptFlow}>
                  开始生成 PPT
                </button>
              )}
            </div>
          );
        }
        return (
          <>
            <PptOutlineEditor
              variant="inline"
              outline={pptOutline}
              onChange={onPptOutlineChange}
              onGenerateDesigns={onConfirmPptDesigns}
              onRegenerateOutline={onRegeneratePptOutline}
              selectedTemplateId={selectedPptTemplateId}
              onSelectTemplate={onSelectPptTemplate}
              isGenerating={isGenerating}
              reviewerMode={reviewerMode}
              onSaveOutlineReview={onSavePptOutlineReview}
            />
            {!reviewerMode && teamAndVeevaActions('ppt')}
          </>
        );

      case 'ppt-design': {
        if (reviewerMode) {
          return (
            <div className="detail-card">
              <h4>PPT 大纲审阅</h4>
              <div className="small">请切换到「PPT大纲」标签编辑结构；生成 PPT 成品由内容运营负责。</div>
              <button
                type="button"
                className="btn soft"
                style={{ marginTop: 12 }}
                onClick={() => setState((prev) => ({ ...prev, active: 'ppt-outline' }))}
              >
                前往 PPT 大纲
              </button>
            </div>
          );
        }
        if (!pptVersions.length) {
          return (
            <div className="detail-card">
              <h4>PPT 生成</h4>
              <div className="small">
                请先在「PPT大纲」中确认大纲并点击「生成 3 套 PPT」或「按模板生成 PPT」。
              </div>
              <button
                type="button"
                className="btn soft"
                style={{ marginTop: 12 }}
                onClick={() => setState((prev) => ({ ...prev, active: 'ppt-outline' }))}
              >
                前往 PPT 大纲
              </button>
            </div>
          );
        }
        const singleVersion = pptVersions.length <= 1;
        const activeVersion =
          pptVersions.find((v) => v.id === selectedPptVersionId) || pptVersions[0];
        return (
          <>
            {singleVersion ? (
              <div className="detail-card detail-card-ppt-design">
                <h4>{activeVersion?.name || 'PPT 成品'}</h4>
                <div className="small">
                  {activeVersion?.styleTag || '拜耳蓝绿'}
                  {activeVersion?.description ? ` · ${activeVersion.description}` : ''}
                </div>
              </div>
            ) : (
              <div className="detail-card detail-card-ppt-design">
                <h4>选择 PPT 设计方案</h4>
                <div className="small">共 {pptVersions.length} 套拜耳蓝绿风格方案</div>
                <div className="ppt-version-grid">
                  {pptVersions.map((v) => (
                    <div
                      key={v.id}
                      className={`ppt-version-card ${selectedPptVersionId === v.id ? 'selected' : ''}`}
                      onClick={() => onSelectPptVersion(v)}
                    >
                      {v.coverDataUrl ? (
                        <img src={v.coverDataUrl} alt={v.name} />
                      ) : (
                        <div className="ppt-version-placeholder" />
                      )}
                      <div className="ppt-version-meta">
                        <strong>{v.name}</strong>
                        <div className="small">{v.styleTag}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pptResult && (
              <PptSlidesPanel
                slides={pptResult.slides}
                title={pptResult.title || pptOutline?.title}
                onEditSlide={onOpenPptSlideEditor}
              />
            )}
            <button
              type="button"
              className="btn soft"
              onClick={() => setState((prev) => ({ ...prev, active: 'ppt-outline' }))}
            >
              返回编辑大纲
            </button>
            {!singleVersion && (
              <button type="button" className="btn soft" onClick={() => fillQuick('生成设计')}>
                重新生成设计
              </button>
            )}
            {teamAndVeevaActions('ppt')}
          </>
        );
      }

      case 'submit': {
        const selectedVideo = videoVersions.find((v) => v.id === selectedVideoVersionId);
        return (
          <>
            <div className="detail-card">
              <h4>Veeva Vault 提交包</h4>
              <div className="small">系统已整理当前内容、引用素材、合规记录与团队修改记录。</div>
              {selectedVideo && (
                <div className="mat-meta" style={{ marginTop: 10 }}>
                  <span className="badge green">视频已纳入</span>
                  <span className="badge">{selectedVideo.name}</span>
                </div>
              )}
            </div>
            <div className="detail-card">
              <h4>Metadata</h4>
              <div className="small">
                品牌:可申达<br />
                渠道:小红书<br />
                受众:公众<br />
                用途:疾病教育<br />
                状态:Pending MLR Review
              </div>
              <div className="mat-meta">
                <span className="badge green">References included</span>
                <span className="badge green">Audit trail ready</span>
                <span className="badge warn">VV-2026-05821</span>
              </div>
            </div>
            <button className="btn green" onClick={() => toast('已提交至 Veeva Vault')}>确认提交</button>{' '}
            <button className="btn" onClick={() => toast('审计报告已生成')}>下载审计报告</button>
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <aside className="wpanel right">
      <div className="right-head">
        <div className="tabs">
          {visibleTabs.length > 0 ? visibleTabs.map((k) => (
              <button
                key={k}
                type="button"
                className={`tab ${state.active === k ? 'active' : ''}`}
                onClick={() => setState((prev) => ({ ...prev, active: k }))}
              >
                {tabNames[k]}
              </button>
            )) : (
            <span className="small" style={{ padding: '12px' }}>
              产物会在这里形成详情标签
            </span>
          )}
        </div>
      </div>
      <div className="detail">
        {renderDetail()}
      </div>
    </aside>
  );
}
