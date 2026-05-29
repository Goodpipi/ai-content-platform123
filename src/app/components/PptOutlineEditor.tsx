import { useMemo, useState } from 'react';
import type { PptOutline, PptOutlineChapter, PptOutlinePage } from '@/types/content';
import {
  genId,
  moveChapterInOutline,
  movePageInOutline,
  outlinePageCount,
  removeChapterFromOutline,
  removePageFromOutline,
} from './pptUtils';
import { PPT_BUILTIN_TEMPLATES } from './pptTemplates';

interface PptOutlineEditorProps {
  outline: PptOutline;
  onChange: (outline: PptOutline) => void;
  onGenerateDesigns: (mode: 'template' | 'no-template') => void;
  onRegenerateOutline: () => void;
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string | null) => void;
  isGenerating?: boolean;
  /** 医学部 / 市场部审阅：仅编辑大纲，不触发生成 */
  reviewerMode?: boolean;
  onSaveOutlineReview?: () => void;
  /** inline：右侧 PPT大纲 标签内编辑；overlay：全屏侧栏（已弃用） */
  variant?: 'inline' | 'overlay';
  onClose?: () => void;
}

const CHAPTER_DRAG_TYPE = 'application/x-ppt-chapter';
const PAGE_DRAG_TYPE = 'application/x-ppt-page';

function DragHandle({ label }: { label: string }) {
  return (
    <span className="ppt-drag-handle" title={label} aria-hidden>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </span>
  );
}

function DeleteButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button type="button" className="ppt-outline-delete-btn" title={title} aria-label={title} onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  );
}

export function PptOutlineEditor({
  outline,
  onChange,
  onGenerateDesigns,
  onRegenerateOutline,
  selectedTemplateId,
  onSelectTemplate,
  isGenerating = false,
  reviewerMode = false,
  onSaveOutlineReview,
  variant = 'inline',
  onClose,
}: PptOutlineEditorProps) {
  const isInline = variant === 'inline';
  const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);
  const [draggingPageKey, setDraggingPageKey] = useState<string | null>(null);
  const [dropChapterId, setDropChapterId] = useState<string | null>(null);
  const [dropPageKey, setDropPageKey] = useState<string | null>(null);
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  const isChapterExpanded = (chapterId: string) => collapsedChapters[chapterId] !== true;

  const toggleChapter = (chapterId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: isChapterExpanded(chapterId),
    }));
  };

  const pageNumberById = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const ch of outline.chapters) {
      for (const pg of ch.pages) {
        n += 1;
        map.set(pg.id, n);
      }
    }
    return map;
  }, [outline.chapters]);

  const updateChapter = (chId: string, patch: Partial<PptOutlineChapter>) => {
    onChange({
      ...outline,
      chapters: outline.chapters.map((ch) => (ch.id === chId ? { ...ch, ...patch } : ch)),
    });
  };

  const updatePage = (chId: string, pgId: string, patch: Partial<PptOutlinePage>) => {
    onChange({
      ...outline,
      chapters: outline.chapters.map((ch) =>
        ch.id === chId
          ? {
              ...ch,
              pages: ch.pages.map((pg) => (pg.id === pgId ? { ...pg, ...patch } : pg)),
            }
          : ch
      ),
    });
  };

  const addChapter = () => {
    const id = genId('ch');
    onChange({
      ...outline,
      chapters: [
        ...outline.chapters,
        {
          id,
          title: '新章节',
          pages: [{ id: genId('pg'), title: '新页面', bullets: ['要点 1'] }],
        },
      ],
    });
    setCollapsedChapters((prev) => ({ ...prev, [id]: false }));
  };

  const addPage = (chId: string) => {
    onChange({
      ...outline,
      chapters: outline.chapters.map((ch) =>
        ch.id === chId
          ? {
              ...ch,
              pages: [...ch.pages, { id: genId('pg'), title: '新页面', bullets: ['要点 1'] }],
            }
          : ch
      ),
    });
  };

  const removePage = (chId: string, pgId: string) => {
    onChange(removePageFromOutline(outline, chId, pgId));
  };

  const removeChapter = (chId: string) => {
    onChange(removeChapterFromOutline(outline, chId));
  };

  const handleChapterDrop = (targetChapterId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropChapterId(null);
    const dragChapterId = e.dataTransfer.getData(CHAPTER_DRAG_TYPE);
    if (dragChapterId) {
      onChange(moveChapterInOutline(outline, dragChapterId, targetChapterId));
      return;
    }
    const pagePayload = e.dataTransfer.getData(PAGE_DRAG_TYPE);
    if (pagePayload) {
      try {
        const { chId, pgId } = JSON.parse(pagePayload) as { chId: string; pgId: string };
        onChange(movePageInOutline(outline, chId, pgId, targetChapterId, null));
      } catch {
        /* ignore invalid payload */
      }
    }
  };

  const handlePageDrop = (toChapterId: string, targetPageId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropPageKey(null);
    const pagePayload = e.dataTransfer.getData(PAGE_DRAG_TYPE);
    if (!pagePayload) return;
    try {
      const { chId, pgId } = JSON.parse(pagePayload) as { chId: string; pgId: string };
      onChange(movePageInOutline(outline, chId, pgId, toChapterId, targetPageId));
    } catch {
      /* ignore invalid payload */
    }
  };

  const shellClass = isInline ? 'ppt-outline-inline' : 'ppt-outline-overlay';
  const panelClass = isInline ? 'ppt-outline-inline-panel' : 'ppt-outline-panel';

  return (
    <div className={shellClass}>
      <div className={panelClass}>
        <header className="ppt-outline-head">
          <div>
            {isInline ? (
              <h3 className="ppt-outline-inline-title">{outline.title}</h3>
            ) : (
              <h2>{outline.title}</h2>
            )}
            <div className="small">
              受众：{outline.audience} · 场景：{outline.scenario} · 共 {outlinePageCount(outline)} 页
            </div>
          </div>
          {!isInline && onClose && (
            <button type="button" className="ppt-close-btn" onClick={onClose} aria-label="关闭">
              ×
            </button>
          )}
        </header>

        {!reviewerMode && (
          <div className="ppt-outline-toolbar">
            <button type="button" className="btn soft" onClick={onRegenerateOutline} disabled={isGenerating}>
              重新生成大纲
            </button>
          </div>
        )}

        <div className="ppt-outline-body">
          {outline.chapters.map((ch, chIdx) => {
            const expanded = isChapterExpanded(ch.id);
            return (
            <section
              key={ch.id}
              className={`ppt-chapter ${expanded ? 'is-expanded' : 'is-collapsed'} ${draggingChapterId === ch.id ? 'is-dragging' : ''} ${dropChapterId === ch.id ? 'is-drop-target' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropChapterId(ch.id);
              }}
              onDragLeave={() => setDropChapterId((id) => (id === ch.id ? null : id))}
              onDrop={(e) => handleChapterDrop(ch.id, e)}
            >
              <div className="ppt-chapter-head">
                <button
                  type="button"
                  className="ppt-chapter-toggle"
                  onClick={() => toggleChapter(ch.id)}
                  aria-expanded={expanded}
                  aria-label={expanded ? '收起章节' : '展开章节'}
                  title={expanded ? '收起章节' : '展开章节'}
                >
                  <svg
                    className={`ppt-chapter-chevron ${expanded ? 'is-open' : ''}`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <span
                  className="ppt-drag-handle-wrap"
                  title="拖拽排序章节"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(CHAPTER_DRAG_TYPE, ch.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingChapterId(ch.id);
                  }}
                  onDragEnd={() => {
                    setDraggingChapterId(null);
                    setDropChapterId(null);
                  }}
                >
                  <DragHandle label="拖拽排序章节" />
                </span>
                <span className="ppt-chapter-num">{chIdx + 1}</span>
                <input
                  className="ppt-chapter-title input"
                  value={ch.title}
                  onChange={(e) => updateChapter(ch.id, { title: e.target.value })}
                />
                <span className="ppt-chapter-page-count">{ch.pages.length} 页</span>
                {outline.chapters.length > 1 && (
                  <DeleteButton title="删除章节" onClick={() => removeChapter(ch.id)} />
                )}
              </div>

              {expanded && (
              <div className="ppt-pages">
                {ch.pages.map((pg) => {
                  const n = pageNumberById.get(pg.id) ?? 0;
                  const pageKey = `${ch.id}:${pg.id}`;
                  return (
                    <div
                      key={pg.id}
                      className={`ppt-page-card ${draggingPageKey === pageKey ? 'is-dragging' : ''} ${dropPageKey === pageKey ? 'is-drop-target' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropPageKey(pageKey);
                      }}
                      onDragLeave={() => setDropPageKey((key) => (key === pageKey ? null : key))}
                      onDrop={(e) => handlePageDrop(ch.id, pg.id, e)}
                    >
                      <div className="ppt-page-num">{n}</div>
                      <div className="ppt-page-body">
                        <div className="ppt-page-title-row">
                          <span
                            className="ppt-drag-handle-wrap ppt-drag-handle-wrap--page"
                            title="拖拽排序页面"
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData(PAGE_DRAG_TYPE, JSON.stringify({ chId: ch.id, pgId: pg.id }));
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggingPageKey(pageKey);
                            }}
                            onDragEnd={() => {
                              setDraggingPageKey(null);
                              setDropPageKey(null);
                            }}
                          >
                            <DragHandle label="拖拽排序页面" />
                          </span>
                          <input
                            className="ppt-page-title input"
                            value={pg.title}
                            onChange={(e) => updatePage(ch.id, pg.id, { title: e.target.value })}
                          />
                          {ch.pages.length > 1 && (
                            <DeleteButton title="删除页面" onClick={() => removePage(ch.id, pg.id)} />
                          )}
                        </div>
                        <textarea
                          className="ppt-page-bullets"
                          value={pg.bullets.join('\n')}
                          placeholder="每行一条要点"
                          onChange={(e) =>
                            updatePage(ch.id, pg.id, {
                              bullets: e.target.value.split('\n').filter(Boolean),
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
                <button type="button" className="ppt-add-page" onClick={() => addPage(ch.id)}>
                  + 添加页面
                </button>
              </div>
              )}
            </section>
            );
          })}

          <button type="button" className="ppt-add-chapter" onClick={addChapter}>
            + 添加章节
          </button>
        </div>

        {!reviewerMode && (
          <section className="ppt-template-section">
            <h4 className="ppt-template-heading">选择 PPT 模板（可选）</h4>
            <div className="small" style={{ marginBottom: 10 }}>
              可选一套内置模板；不选用模板时在下方生成 3 套方案供对比。
            </div>
            <div className="ppt-template-grid">
              {PPT_BUILTIN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`ppt-template-card ${selectedTemplateId === tpl.id ? 'selected' : ''}`}
                  onClick={() => onSelectTemplate(tpl.id)}
                >
                  <div
                    className="ppt-template-preview"
                    style={{ background: tpl.gradient }}
                  >
                    <span className="ppt-template-accent" style={{ background: tpl.accent }} />
                  </div>
                  <strong>{tpl.name}</strong>
                  <div className="small">{tpl.styleTag}</div>
                  <div className="small ppt-template-desc">{tpl.description}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="ppt-outline-foot">
          {reviewerMode ? (
            <>
              <button
                type="button"
                className="btn ppt-generate-btn primary"
                onClick={() => onSaveOutlineReview?.()}
              >
                保存大纲修改
              </button>
              <div className="small">
                仅需修改章节与页面要点，无需生成 PPT。保存后内容运营可在同一会话「PPT大纲」中查看。
              </div>
            </>
          ) : (
            <>
              <div className="ppt-generate-actions">
                <button
                  type="button"
                  className="btn ppt-generate-btn ppt-generate-btn-alt"
                  disabled={isGenerating}
                  onClick={() => onGenerateDesigns('no-template')}
                >
                  {isGenerating ? '生成中…' : '不选用模板直接生成'}
                </button>
                <button
                  type="button"
                  className="btn ppt-generate-btn primary"
                  disabled={isGenerating || !selectedTemplateId}
                  onClick={() => onGenerateDesigns('template')}
                >
                  {isGenerating ? '生成中…' : '按模板生成 PPT'}
                </button>
              </div>
              <div className="small ppt-generate-hint">
                {selectedTemplateId
                  ? `已选「${PPT_BUILTIN_TEMPLATES.find((t) => t.id === selectedTemplateId)?.name}」· 左：3 套方案 · 右：按模板一套`
                  : '请先在上方选择模板，或点击「不选用模板直接生成」'}
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
