export type MaterialContentType = 'text' | 'image' | 'pdf';

export interface LibraryItem {
  id: number;
  cat: string;
  title: string;
  meta: string;
  cms: boolean;
  def: boolean;
  addedAt: number;
  fileName?: string;
  contentType?: MaterialContentType;
  /** 文本类文件正文 */
  contentText?: string;
  /** 图片 / PDF 的 data URL */
  contentUrl?: string;
  mimeType?: string;
}
