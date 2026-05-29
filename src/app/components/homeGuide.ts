import {
  analyzeBrief,
  buildUnderstoodSummary,
  getActionChips,
  getMissingForPpt,
} from './conversationGuide';

export type HomeEntryIntent =
  | 'general'
  | 'insight'
  | 'copy'
  | 'visual'
  | 'video'
  | 'ppt'
  | 'visual-template'
  | 'ppt-template';

export interface HomeEntryContext {
  intent: HomeEntryIntent;
  templateTitle?: string;
}

export function isPptEntryIntent(ctx?: HomeEntryContext | null): boolean {
  return ctx?.intent === 'ppt' || ctx?.intent === 'ppt-template';
}

export function isVisualEntryIntent(ctx?: HomeEntryContext | null): boolean {
  return ctx?.intent === 'visual' || ctx?.intent === 'visual-template';
}

/** 从首页图片入口进入时，短句应走配图流程而非 PPT 大纲 */
export function shouldPreferVisualFlow(
  ctx: HomeEntryContext | null | undefined,
  text: string
): boolean {
  if (!isVisualEntryIntent(ctx)) return false;
  if (/ppt|幻灯片|演示文稿|课件/i.test(text)) return false;
  if ((text.includes('话题') && text.includes('洞察')) || /生成文案|视频脚本|生成视频/.test(text)) {
    return false;
  }
  return true;
}

const INTENT_LABELS: Record<Exclude<HomeEntryIntent, 'visual-template' | 'ppt-template'>, string> = {
  general: '内容创作',
  insight: '话题洞察',
  copy: '文案',
  visual: '图片',
  video: '视频脚本',
  ppt: 'PPT',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 根据首页自由输入粗略识别用户意图 */
export function detectHomeIntent(text: string): HomeEntryIntent | 'unknown' {
  const t = text.trim();
  if (!t) return 'general';
  if (/veeva|审批|提交包/i.test(t)) return 'general';
  if (/ppt|幻灯片|演示文稿|课件/i.test(t)) return 'ppt';
  if (/视频|分镜|口播|短视频/i.test(t)) return 'video';
  if (/洞察|热点|话题分析|趋势/i.test(t)) return 'insight';
  if (/文案|撰写|稿子|科普文/i.test(t)) return 'copy';
  if (/图片|配图|海报|封面|视觉|插画/i.test(text)) return 'visual';
  return 'unknown';
}

/** 首页输入进入任务后的引导话术（不直接触发生成） */
export function getHomeInputGuidance(
  userText: string,
  detected: HomeEntryIntent | 'unknown'
): { html: string; chips: string[]; suggestedIntent: HomeEntryIntent } {
  const quoted = escapeHtml(userText.length > 100 ? `${userText.slice(0, 100)}…` : userText);
  const analysis = analyzeBrief(userText);
  const understood = buildUnderstoodSummary(analysis);

  if (detected === 'unknown') {
    if (analysis.isSubstantial) {
      return {
        suggestedIntent: 'general',
        html: `收到：「${quoted}」。${understood ? `已识别 ${understood}。` : ''}请直接点下方按钮选择产出类型，或一句话说明要生成什么。`,
        chips: ['生成话题洞察', '生成文案', '生成图片', '生成PPT', '生成视频'],
      };
    }
    return {
      suggestedIntent: 'general',
      html: `收到：「${quoted}」。请用一句话说明想做的产出（洞察 / 文案 / 配图 / PPT / 视频），或点下方按钮。`,
      chips: ['生成话题洞察', '生成文案', '生成图片', '生成PPT', '生成视频'],
    };
  }

  const label = INTENT_LABELS[detected as keyof typeof INTENT_LABELS] || '内容创作';

  if (detected === 'ppt' || detected === 'ppt-template') {
    const missing = getMissingForPpt(userText);
    if (missing.length === 0) {
      return {
        suggestedIntent: detected === 'ppt-template' ? 'ppt-template' : 'ppt',
        html: `明白，你要做<strong>${label}</strong>。${understood ? `已识别 ${understood}。` : ''}点击下方即可开始生成大纲。`,
        chips: ['开始生成PPT大纲', '补充内容要求'],
      };
    }
    if (missing.length === 1 && missing[0] === 'audience') {
      return {
        suggestedIntent: 'ppt',
        html: `明白，你要做<strong>${label}</strong>。${understood ? `已识别 ${understood}。` : ''}只差一步：目标受众是？`,
        chips: ['医生/HCP', '公众', '患者'],
      };
    }
    if (missing.length === 1 && missing[0] === 'scenario') {
      return {
        suggestedIntent: 'ppt',
        html: `明白，你要做<strong>${label}</strong>。${understood ? `已识别 ${understood}。` : ''}只差一步：使用场景是？`,
        chips: ['疾病教育', '作用机制', '产品培训', '科室会'],
      };
    }
  }

  if (analysis.isSubstantial) {
    return {
      suggestedIntent: detected,
      html: `明白，你要做<strong>${label}</strong>。${understood ? `已识别 ${understood}。` : ''}信息已足够，可直接开始。`,
      chips: getActionChips(detected),
    };
  }

  const welcome = getEntryWelcome({ intent: detected });
  return {
    suggestedIntent: detected,
    html: `你想做<strong>${label}</strong>。${welcome.html}`,
    chips: welcome.chips,
  };
}

export function getEntryWelcome(ctx: HomeEntryContext): { html: string; chips: string[] } {
  const { intent, templateTitle } = ctx;

  switch (intent) {
    case 'insight':
      return {
        html: '默认素材已就绪。说出主题、渠道或疾病领域，即可开始洞察。',
        chips: ['开始生成话题洞察', '小红书肾脏健康热点', '公众疾病教育洞察'],
      };
    case 'copy':
      return {
        html: '说出文案类型、受众与核心信息，即可开始生成。',
        chips: ['开始生成文案', '小红书科普文案', '患者教育长图文案'],
      };
    case 'visual':
      return {
        html: '描述配图主题、受众与风格，即可开始生成。',
        chips: ['开始生成配图', '肾脏健康科普配图', '清爽蓝绿品牌风'],
      };
    case 'visual-template':
      return {
        html: `已选模板「${templateTitle || '图片'}」。补充主题与画面要求后即可生成。`,
        chips: ['开始生成配图', '选用内置模板', '公众科普风格'],
      };
    case 'video':
      return {
        html: '说明视频主题、受众与时长偏好，即可开始写脚本。',
        chips: ['开始生成视频脚本', '30秒科普短视频', '患者教育口播脚本'],
      };
    case 'ppt':
      return {
        html: '说明受众与使用场景，即可生成可编辑大纲。',
        chips: ['开始生成PPT大纲', '医生-作用机制', '公众-疾病教育'],
      };
    case 'ppt-template':
      return {
        html: `已选模板「${templateTitle || 'PPT'}」。说明受众与场景后即可生成大纲。`,
        chips: ['开始生成PPT大纲', '医生/HCP', '疾病教育'],
      };
    default:
      return {
        html: '默认素材已就绪。直接说目标，或点下方按钮开始。',
        chips: ['生成话题洞察', '生成文案', '生成图片', '生成PPT', '生成视频'],
      };
  }
}

export const HOME_IMAGE_TEMPLATES = [
  { title: '小红书配图', img: 'https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?w=400' },
  { title: '疾病教育海报', img: 'https://images.unsplash.com/photo-1559757175-053139280de2?w=400' },
  { title: '健康科普图文', img: 'https://images.unsplash.com/photo-1559757175-9e351c9a1301?w=400' },
  { title: '医疗场景图', img: '' },
  { title: '药品说明', img: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400' },
  { title: '患者关怀', img: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400' },
] as const;

export const HOME_PPT_TEMPLATES = [
  { title: 'HCP沟通方案', img: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400' },
  { title: '患者教育PPT', img: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400' },
  { title: '疾病科普模板', img: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400' },
  { title: '内部培训PPT', img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400' },
] as const;
