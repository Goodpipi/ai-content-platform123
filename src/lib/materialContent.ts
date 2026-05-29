import type { LibraryItem, MaterialContentType } from '@/types/library';

export type MaterialPreview =
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string; alt: string }
  | { kind: 'pdf'; url: string; title: string };

const MOCK_BY_ID: Record<number, string> = {
  1: `小红书肾脏健康热点观察 | 2026年5月

一、本周热点词
• 慢性肾病早期信号 / 肾功能检查 / 控盐饮食
• 夏季补水与肾脏负担 / 蛋白尿科普
• 可申达相关公众讨论量环比 +18%

二、高互动内容结构
1. 标题：问句式 + 数字（如「3个信号提示你要查肾」）
2. 封面：生活场景 + 医疗可信元素（白大褂/图表）
3. 正文：痛点 → 科普 → 行动建议（检查/随访）

三、合规提示
避免疗效承诺；公众内容不直接对比竞品；引用需可追溯。`,

  2: `公众渠道疾病教育合规手册（节选）

第 3 章 表述边界
3.1 不得使用「治愈」「根治」「最好」等绝对化用语。
3.2 疾病教育内容应基于 approved claims，不得超出适应症表述范围。
3.3 配图需包含品牌审批号或素材来源标识。

第 5 章 小红书渠道补充要求
• 标题不得制造焦虑或恐慌
• 评论区互动需有医学合规监测机制
• 外链跳转仅限已审批落地页

版本：2026-Q2 | 状态：全局生效`,

  3: `肾脏健康疾病教育参考知识包（12条）

K01 慢性肾病（CKD）定义与分期简述
K02 早期CKD常见误区：无症状 ≠ 无风险
K03 血压、血糖、蛋白尿与肾脏保护
K04 饮食管理：限盐、优质蛋白、磷钾注意点
K05 用药依从性与肾脏安全性
K06 检查项目：eGFR、尿常规、尿白蛋白/肌酐比
K07 公众科普话术：如何解释「肾功能」
K08 运动与生活方式建议（低强度有氧）
K09 复诊与随访节奏建议
K10 患者常见问答（FAQ）模板
K11 渠道适配：小红书 vs 公众号语气差异
K12 引用文献与审批声明占位

附：Excel 索引表（知识点 ID | 受众 | 审批状态）`,

  4: `可申达 2026 品牌沟通 Briefing

品牌主张
在公众疾病教育场景中，以「可信赖的肾脏健康伙伴」为核心定位，强调早筛、早知、规范管理。

目标受众
• 一级：CKD 高风险公众（糖尿病、高血压人群）
• 二级：已确诊早期 CKD 患者及家属

核心信息层级
1. 疾病认知与风险意识
2. 规范诊疗与随访重要性
3. 品牌角色：科普与支持（非促销）

2026 重点战役
• Q2 世界肾脏日延续内容
• 夏季「补水与肾脏」主题科普
• 医生共创短视频（公众版剪辑）

交付物：KV、话术库、FAQ、渠道模板`,

  5: `小红书渠道表达与视觉偏好（15个风格案例）

文案语气
• 亲切、短句、第一人称体验感
• 用「你知道吗」「很多人忽略了」切入
• 结尾引导：收藏 / 转发给家人

视觉偏好
• 清爽蓝绿 + 大量留白
• 信息图卡片：3-5 点列表
• 封面人物：真实生活场景，避免过度医疗化

案例标签
#肾脏健康 #慢病管理 #科普打卡 #生活方式

规避
夸张前后对比、暗示药物疗效、未审批品牌露出`,

  6: `Approved Claims Library | 可申达

[C-001] 适用于公众疾病教育
「慢性肾病需要长期规范管理，早期发现有助于延缓进展。」
状态：Approved | 有效期至 2026-12-31

[C-014] 检查与随访
「定期监测肾功能相关指标，有助于医生评估疾病变化。」
状态：Approved

[C-027] 生活方式
「均衡饮食、适量运动、遵医嘱用药是慢病管理的重要组成部分。」
状态：Approved

使用规则
• 仅允许逐字引用或按审批备注微调
• 每条 claim 需记录素材版本号与引用位置`,

  7: `Bayer Blue-Green Visual Kit 2026

主色
• Bayer Blue  #103C8F
• Bayer Green #69BE28
• 辅助渐变：#1d6bff → #00A88E

组件
• 标题区：左对齐，24px/32px 层级
• 图标：线性医疗图标，圆角 8px
• 图表：蓝绿双色，避免高饱和红

模板
• 小红书封面 3:4
• 公众号头图 2.35:1
• PPT 封面 16:9

素材包含：Logo、色板、图标 SVG、示例排版 PSD`,

  8: `患者教育手册：慢性肾病风险认知

第一章 什么是慢性肾病？
肾脏负责过滤代谢废物。当肾功能在数月以上持续下降，称为慢性肾病（CKD）。

第二章 我可能有风险吗？
高血压、糖尿病、家族史、长期用药等人群建议定期检查。

第三章 我能做什么？
• 按医嘱复查 eGFR 与尿蛋白
• 控制血压血糖
• 与医生讨论个性化管理方案

附录：检查单解读示意图（示意图编号 PE-08）`,

  9: `公众平台高互动标题样本（20条）

1. 体检报告这几个字，很多人第一次认真看
2. 夏天喝水多，肾脏就一定安全吗？
3. 医生朋友提醒我的3个习惯，分享给家人
4. 慢病管理不是「等不舒服再说」
5. 一张图看懂：肾功能检查在查什么
…
20. 收藏这份清单，下次复诊前用得上

数据备注：近30天互动率 Top20，已脱敏处理`,
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isMostlyPrintable(text: string): boolean {
  if (!text.length) return false;
  let printable = 0;
  for (let i = 0; i < Math.min(text.length, 2000); i += 1) {
    const code = text.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) printable += 1;
  }
  return printable / Math.min(text.length, 2000) > 0.85;
}

function officePlaceholder(fileName: string): string {
  return `[Office 文档预览]

文件名：${fileName}

系统已完成基础解析。以下为可引用文本摘要（演示）：

本文档包含品牌沟通要点、合规注释与结构化章节标题，可在内容生成时作为引用素材。如需查看完整版式，请下载原文件。`;
}

function cmsDocumentBody(item: LibraryItem): string {
  return `【CMS 原文预览】

文档编号：CMS-${item.id.toString().padStart(5, '0')}
标题：${item.title}
分类：${item.cat}
审批状态：${item.meta.includes('Approved') ? 'Approved' : '已同步'}

—— 正文 ——

${MOCK_BY_ID[item.id] ?? `${item.title}

本素材来自 CMS 已连接内容库，以下为同步至工作台的文档正文。内容已通过合规审批，可在生成话题洞察、文案与 PPT 时作为可追溯引用。

${item.meta}`}`;
}

export function getMockDocumentContent(item: LibraryItem): string {
  if (MOCK_BY_ID[item.id]) {
    return item.cms ? cmsDocumentBody(item) : MOCK_BY_ID[item.id];
  }
  if (item.cms) return cmsDocumentBody(item);
  return `${item.title}

${item.meta}

（本地上传素材：系统已解析文档结构与关键段落，可在对话中引用。）`;
}

export function getMaterialPreview(item: LibraryItem): MaterialPreview {
  if (item.contentType === 'image' && item.contentUrl) {
    return { kind: 'image', url: item.contentUrl, alt: item.title };
  }
  if (item.contentType === 'pdf' && item.contentUrl) {
    return { kind: 'pdf', url: item.contentUrl, title: item.title };
  }
  const text = item.contentText?.trim() || getMockDocumentContent(item);
  return { kind: 'text', text };
}

export async function readFileForPreview(
  file: File
): Promise<Pick<LibraryItem, 'contentType' | 'contentText' | 'contentUrl' | 'mimeType'>> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return {
      contentType: 'image',
      contentUrl: await fileToDataUrl(file),
      mimeType: file.type || `image/${ext}`,
    };
  }

  if (file.type === 'application/pdf' || ext === 'pdf') {
    return {
      contentType: 'pdf',
      contentUrl: await fileToDataUrl(file),
      mimeType: 'application/pdf',
    };
  }

  if (file.type.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'xml', 'html'].includes(ext)) {
    const contentText = await file.text();
    return { contentType: 'text', contentText, mimeType: file.type || 'text/plain' };
  }

  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
    return {
      contentType: 'text',
      contentText: officePlaceholder(file.name),
      mimeType: file.type,
    };
  }

  if (file.size < 500_000) {
    try {
      const contentText = await file.text();
      if (isMostlyPrintable(contentText)) {
        return { contentType: 'text', contentText: contentText.slice(0, 80_000), mimeType: file.type };
      }
    } catch {
      /* binary */
    }
  }

  return {
    contentType: 'text',
    contentText: `无法直接预览该二进制文件格式。\n\n文件名：${file.name}\n类型：${file.type || ext || '未知'}\n大小：${(file.size / 1024).toFixed(1)} KB`,
    mimeType: file.type,
  };
}

export function buildPreviewFieldsFromTitle(
  title: string,
  cms: boolean
): Pick<LibraryItem, 'contentType' | 'contentText'> {
  const pseudo: LibraryItem = {
    id: 0,
    cat: '',
    title,
    meta: cms ? 'CMS · Approved' : '本地上传',
    cms,
    def: false,
    addedAt: Date.now(),
  };
  return { contentType: 'text', contentText: getMockDocumentContent(pseudo) };
}
