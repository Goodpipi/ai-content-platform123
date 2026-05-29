import type { LibraryItem } from '@/types/library';

const RECENT_LIMIT = 3;

export function materialAttachmentPill(item: {
  cms: boolean;
  fileName?: string;
  title: string;
}): string {
  return `${item.cms ? 'CMS' : '附件'}:${item.fileName || item.title} ×`;
}

export function getRecentMaterials(library: LibraryItem[], limit = RECENT_LIMIT): LibraryItem[] {
  return [...library].sort((a, b) => b.addedAt - a.addedAt).slice(0, limit);
}

export function formatMaterialAddedTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  const sameDay =
    d.getFullYear() === new Date().getFullYear() &&
    d.getMonth() === new Date().getMonth() &&
    d.getDate() === new Date().getDate();
  if (sameDay) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function materialPreviewSummary(item: LibraryItem): string {
  if (item.cms) {
    return '该素材来自 CMS，已通过合规审批流程，可在内容生成时作为可追溯引用。';
  }
  return '该素材为本地上传文件，系统已解析文本与结构，可在话题洞察、文案与配图生成中引用。';
}

export function materialPreviewBody(item: LibraryItem): string {
  const lines = [
    `分类：${item.cat}`,
    `来源：${item.cms ? 'CMS 已连接素材库' : '本地上传'}`,
    `元信息：${item.meta}`,
    item.def ? '状态：已设为默认素材，新建任务会自动带出' : '状态：候选素材，可在素材库中设为默认',
    `添加时间：${formatMaterialAddedTime(item.addedAt)}`,
  ];
  if (item.fileName) lines.splice(2, 0, `文件名：${item.fileName}`);
  return lines.join('\n');
}
