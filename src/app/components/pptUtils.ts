import type { PptOutline, PptOutlineChapter, PptOutlinePage, PptSlide } from '@/types/content';

export function genId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseAudience(text: string): string {
  const t = text.toLowerCase();
  if (/医生|hcp|医师|专家|科室/.test(text) || t.includes('hcp')) return 'HCP';
  if (/患者|病人/.test(text)) return '患者';
  if (/公众|大众|小红书/.test(text)) return '公众';
  return '';
}

export function parseScenario(text: string): string {
  const patterns = [
    '作用机制',
    '产品培训',
    '疾病教育',
    '学术会',
    '科室会',
    '患教',
    '拜访',
    '内部培训',
    '机制',
    '疗效',
    '安全',
  ];
  for (const p of patterns) {
    if (text.includes(p)) return p;
  }
  if (text.length >= 8 && !/生成|ppt/i.test(text)) return text.slice(0, 40);
  return '';
}

export function normalizeOutline(
  raw: {
    title?: string;
    audience?: string;
    scenario?: string;
    chapters?: {
      title: string;
      pages?: { title: string; bullets?: string[]; speakerNotes?: string }[];
    }[];
  },
  audience: string,
  scenario: string
): PptOutline {
  const chapters: PptOutlineChapter[] = (raw.chapters || []).map((ch) => ({
    id: genId('ch'),
    title: ch.title || '未命名章节',
    pages: (ch.pages || []).map((p) => ({
      id: genId('pg'),
      title: p.title || '未命名页面',
      bullets: p.bullets?.length ? p.bullets : ['待补充要点'],
      speakerNotes: p.speakerNotes,
    })),
  }));

  if (!chapters.length) {
    chapters.push({
      id: genId('ch'),
      title: '主要内容',
      pages: [{ id: genId('pg'), title: '封面', bullets: ['标题', '副标题'] }],
    });
  }

  chapters.forEach((ch) => {
    if (!ch.pages.length) {
      ch.pages.push({ id: genId('pg'), title: '新页面', bullets: ['要点 1'] });
    }
  });

  return {
    title: raw.title || '可申达 演示文稿',
    audience: raw.audience || audience,
    scenario: raw.scenario || scenario,
    chapters,
  };
}

export function flattenOutline(outline: PptOutline): PptSlide[] {
  let page = 0;
  const slides: PptSlide[] = [];
  for (const ch of outline.chapters) {
    for (const p of ch.pages) {
      page += 1;
      slides.push({
        page,
        title: p.title,
        bullets: p.bullets,
        speakerNotes: p.speakerNotes || `章节：${ch.title}`,
      });
    }
  }
  return slides;
}

export function outlinePageCount(outline: PptOutline) {
  return outline.chapters.reduce((n, ch) => n + ch.pages.length, 0);
}

export function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function moveChapterInOutline(
  outline: PptOutline,
  dragChapterId: string,
  targetChapterId: string
): PptOutline {
  const fromIdx = outline.chapters.findIndex((ch) => ch.id === dragChapterId);
  const toIdx = outline.chapters.findIndex((ch) => ch.id === targetChapterId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return outline;
  return {
    ...outline,
    chapters: reorderList(outline.chapters, fromIdx, toIdx),
  };
}

export function movePageInOutline(
  outline: PptOutline,
  fromChapterId: string,
  pageId: string,
  toChapterId: string,
  targetPageId: string | null
): PptOutline {
  const chapters = outline.chapters.map((ch) => ({ ...ch, pages: [...ch.pages] }));

  let fromChIdx = -1;
  let fromPgIdx = -1;
  let toChIdx = -1;
  let toPgIdx = -1;

  chapters.forEach((ch, ci) => {
    if (ch.id === fromChapterId) {
      fromChIdx = ci;
      fromPgIdx = ch.pages.findIndex((p) => p.id === pageId);
    }
    if (ch.id === toChapterId) {
      toChIdx = ci;
      if (targetPageId) toPgIdx = ch.pages.findIndex((p) => p.id === targetPageId);
    }
  });

  if (fromChIdx < 0 || fromPgIdx < 0 || toChIdx < 0) return outline;

  const [page] = chapters[fromChIdx].pages.splice(fromPgIdx, 1);
  if (!page) return outline;

  if (chapters[fromChIdx].pages.length === 0) {
    chapters[fromChIdx].pages.push({
      id: genId('pg'),
      title: '新页面',
      bullets: ['要点 1'],
    });
  }

  let insertAt = targetPageId ? toPgIdx : chapters[toChIdx].pages.length;
  if (insertAt < 0) insertAt = chapters[toChIdx].pages.length;
  if (fromChIdx === toChIdx && fromPgIdx < insertAt) insertAt -= 1;
  if (insertAt < 0) insertAt = 0;

  chapters[toChIdx].pages.splice(insertAt, 0, page);

  return { ...outline, chapters };
}

export function removeChapterFromOutline(outline: PptOutline, chapterId: string): PptOutline {
  if (outline.chapters.length <= 1) return outline;
  return {
    ...outline,
    chapters: outline.chapters.filter((ch) => ch.id !== chapterId),
  };
}

export function removePageFromOutline(
  outline: PptOutline,
  chapterId: string,
  pageId: string
): PptOutline {
  return {
    ...outline,
    chapters: outline.chapters.map((ch) => {
      if (ch.id !== chapterId) return ch;
      const pages = ch.pages.filter((p) => p.id !== pageId);
      return {
        ...ch,
        pages: pages.length
          ? pages
          : [{ id: genId('pg'), title: '新页面', bullets: ['要点 1'] }],
      };
    }),
  };
}

/** 将幻灯片转为可预览/编辑的 data URL */
export function slideToPreviewUrl(slide: PptSlide): string {
  if (slide.svg) {
    const encoded = encodeURIComponent(slide.svg);
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  }
  const title = (slide.title || '未命名').slice(0, 20);
  const bullets = (slide.bullets || []).slice(0, 4).join(' · ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#eaf7ff"/><stop offset="1" stop-color="#f4fff0"/>
    </linearGradient></defs>
    <rect width="960" height="540" fill="url(#g)"/>
    <rect x="48" y="40" width="100" height="36" rx="18" fill="#103C8F"/>
    <text x="72" y="64" font-size="18" font-weight="700" fill="white">Bayer</text>
    <text x="48" y="140" font-size="32" font-weight="800" fill="#103C8F">${title}</text>
    <text x="48" y="200" font-size="20" fill="#40536a">${bullets}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
