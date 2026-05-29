import { parseAudience, parseScenario } from './pptUtils';
import type { HomeEntryIntent } from './homeGuide';

export interface BriefAnalysis {
  audience: string;
  scenario: string;
  channel: string;
  isSubstantial: boolean;
  wantsTemplate: boolean;
  skipsTemplate: boolean;
}

const SCENARIO_PATTERNS = [
  '作用机制',
  '产品培训',
  '疾病教育',
  '学术会',
  '科室会',
  '患教',
  '拜访',
  '内部培训',
];

export function parseScenarioExplicit(text: string): string {
  for (const p of SCENARIO_PATTERNS) {
    if (text.includes(p)) return p;
  }
  return '';
}

export function parseChannel(text: string): string {
  if (/小红书/.test(text)) return '小红书';
  if (/微信|公众号/.test(text)) return '微信';
  if (/抖音|短视频/.test(text)) return '短视频';
  return '';
}

export function analyzeBrief(text: string): BriefAnalysis {
  const trimmed = text.trim();
  return {
    audience: parseAudience(trimmed),
    scenario: parseScenarioExplicit(trimmed) || parseScenario(trimmed),
    channel: parseChannel(trimmed),
    isSubstantial: trimmed.length >= 18 || /[，,。；;]/.test(trimmed),
    wantsTemplate: /选用模板|选择模板|用模板|内置模板/.test(trimmed),
    skipsTemplate: /不用模板|不要模板|直接生成|否[，,]/.test(trimmed),
  };
}

export function getMissingForPpt(text: string): Array<'audience' | 'scenario'> {
  const audience = parseAudience(text);
  const scenario = parseScenarioExplicit(text);
  const missing: Array<'audience' | 'scenario'> = [];
  if (!audience) missing.push('audience');
  if (!scenario) missing.push('scenario');
  return missing;
}

export function buildUnderstoodSummary(analysis: BriefAnalysis): string {
  const parts: string[] = [];
  if (analysis.audience) parts.push(`受众 ${analysis.audience}`);
  if (analysis.scenario) parts.push(`场景 ${analysis.scenario}`);
  if (analysis.channel) parts.push(`渠道 ${analysis.channel}`);
  return parts.join(' · ');
}

const ACTION_CHIPS: Record<HomeEntryIntent, string[]> = {
  general: ['生成话题洞察', '生成文案', '生成图片', '生成PPT', '生成视频'],
  insight: ['开始生成话题洞察', '补充热点关键词'],
  copy: ['开始生成文案', '基于默认素材生成文案'],
  visual: ['开始生成配图', '选用内置模板'],
  video: ['开始生成视频脚本', '30秒科普短视频'],
  ppt: ['开始生成PPT大纲', '补充内容要求'],
  'visual-template': ['开始生成配图', '选用内置模板'],
  'ppt-template': ['开始生成PPT大纲', '补充内容要求'],
};

export function getActionChips(intent: HomeEntryIntent): string[] {
  return ACTION_CHIPS[intent] || ACTION_CHIPS.general;
}

export function isStartAction(text: string): boolean {
  return /^(开始|直接开始|马上|立即)/.test(text.trim()) || /开始生成/.test(text);
}

/** 对话内洞察类快捷引导：点击后应直接生成话题洞察 */
export function isInsightQuickAction(text: string): boolean {
  const t = text.trim().replace(/[：:]\s*$/, '');
  if (!t) return false;
  if (/^(开始)?生成话题洞察/.test(t)) return true;
  if (t.includes('话题') && t.includes('洞察')) return true;
  if (/热点洞察|话题洞察|洞察报告|补充.*洞察/.test(t)) return true;
  if (t.includes('洞察') && !/文案|PPT|ppt|视频|配图|图片/.test(t)) return true;
  if (t.includes('基于默认素材') && /洞察|话题|热点/.test(t)) return true;
  if (t === '补充热点关键词' || t === '扩展话题') return true;
  if (/热点|话题分析|趋势观察|高互动标题/.test(t) && !/文案|配图|图片|PPT|ppt|视频/.test(t)) {
    return true;
  }
  return false;
}

export function guideMissingFields(
  taskLabel: string,
  missing: string[]
): { html: string; chips: string[] } {
  if (missing.length === 0) {
    return {
      html: `信息已齐，可以开始${taskLabel}。`,
      chips: ['直接开始'],
    };
  }
  if (missing.length === 1 && missing[0] === 'audience') {
    return {
      html: `可以${taskLabel}。还差一步：这份内容的<strong>目标受众</strong>是谁？`,
      chips: ['医生/HCP', '公众', '患者'],
    };
  }
  if (missing.length === 1 && missing[0] === 'scenario') {
    return {
      html: `可以${taskLabel}。还差一步：这份内容的<strong>使用场景</strong>是什么？`,
      chips: ['疾病教育', '作用机制', '产品培训', '科室会'],
    };
  }
  return {
    html: `可以${taskLabel}。请补充：<strong>${missing.join('、')}</strong>。`,
    chips: missing[0] === 'audience'
      ? ['医生/HCP', '公众', '患者']
      : ['疾病教育', '作用机制', '产品培训'],
  };
}
