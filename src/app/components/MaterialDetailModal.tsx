import type { LibraryItem } from '@/types/library';
import { formatMaterialAddedTime } from '@/lib/libraryUtils';
import { MaterialContentPreview } from '@/app/components/MaterialContentPreview';

interface MaterialDetailModalProps {
  item: LibraryItem | null;
  onClose: () => void;
}

export function MaterialDetailModal({ item, onClose }: MaterialDetailModalProps) {
  if (!item) return null;

  return (
    <div
      className="modal-bg show material-detail-bg"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('material-detail-bg')) onClose();
      }}
    >
      <div className="modal material-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="material-detail-head">
          <div className={`material-detail-icon ${item.cms ? 'is-cms' : 'is-file'}`}>
            {item.cms ? 'C' : 'F'}
          </div>
          <div className="material-detail-head-text">
            <h3>{item.title}</h3>
            <div className="mat-meta">
              <span className="badge">{item.cat}</span>
              <span className={`badge ${item.cms ? 'green' : ''}`}>{item.cms ? 'CMS' : '上传'}</span>
              {item.def && <span className="badge warn">默认素材</span>}
              {item.fileName && <span className="badge">{item.fileName}</span>}
            </div>
          </div>
          <button type="button" className="material-detail-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="material-detail-preview">
          <div className="material-detail-preview-label">文件内容预览</div>
          <MaterialContentPreview item={item} />
        </div>

        <div className="material-detail-foot">
          <span className="small muted">
            {item.meta} · 添加于 {formatMaterialAddedTime(item.addedAt)}
          </span>
          <button type="button" className="btn primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
