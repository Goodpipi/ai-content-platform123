import type { LibraryItem } from '@/types/library';
import { getMaterialPreview } from '@/lib/materialContent';

export function MaterialContentPreview({ item }: { item: LibraryItem }) {
  const preview = getMaterialPreview(item);

  if (preview.kind === 'image') {
    return (
      <div className="material-preview-frame material-preview-frame-image">
        <img src={preview.url} alt={preview.alt} className="material-preview-image" />
      </div>
    );
  }

  if (preview.kind === 'pdf') {
    return (
      <div className="material-preview-frame material-preview-frame-pdf">
        <iframe
          src={preview.url}
          title={preview.title}
          className="material-preview-pdf"
        />
      </div>
    );
  }

  return (
    <div className="material-preview-frame material-preview-frame-text">
      <pre className="material-preview-document">{preview.text}</pre>
    </div>
  );
}
