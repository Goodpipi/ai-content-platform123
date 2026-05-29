import type { LibraryItem } from '@/types/library';
import { formatMaterialAddedTime } from '@/lib/libraryUtils';
import { Check, FileText, Star } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

export function materialFileKind(item: LibraryItem): {
  label: string;
  tone: 'cms' | 'pdf' | 'doc' | 'image' | 'file';
} {
  if (item.cms) return { label: 'CMS', tone: 'cms' };
  const name = (item.fileName || item.title || '').toLowerCase();
  if (item.contentType === 'image' || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
    return { label: 'IMG', tone: 'image' };
  }
  if (item.contentType === 'pdf' || name.endsWith('.pdf')) {
    return { label: 'PDF', tone: 'pdf' };
  }
  if (/\.(docx?|pptx?|xlsx?)$/.test(name)) {
    return { label: 'DOC', tone: 'doc' };
  }
  return { label: 'FILE', tone: 'file' };
}

function toneGradient(tone: 'cms' | 'pdf' | 'doc' | 'image' | 'file') {
  if (tone === 'cms') return 'from-[#8AD329] to-[#6FCFC0]';
  if (tone === 'image') return 'from-[#54B9F9] via-[#6FCFC0] to-[#8AD329]';
  return 'from-[#54B9F9] to-[#2E8FD6]';
}

function sourceBadge(item: LibraryItem) {
  if (item.cms) {
    return { label: 'CMS', className: 'bg-[#8AD329]/15 text-[#4a7a18] border-[#8AD329]/30' };
  }
  return { label: 'FILE', className: 'bg-[#54B9F9]/15 text-[#1f6ea8] border-[#54B9F9]/30' };
}

interface LibraryMaterialCardProps {
  item: LibraryItem;
  selected: boolean;
  onToggleSelect: () => void;
  onToggleDefault: () => void;
  onPreview: () => void;
}

export function LibraryMaterialCard({
  item,
  selected,
  onToggleSelect,
  onToggleDefault,
  onPreview,
}: LibraryMaterialCardProps) {
  const kind = materialFileKind(item);
  const badge = sourceBadge(item);

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white/85 p-3.5 shadow-soft transition',
        'hover:-translate-y-0.5 hover:shadow-glow',
        selected
          ? 'border-[#54B9F9] ring-2 ring-[#54B9F9]/30'
          : 'border-border/60 hover:border-primary/40'
      )}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPreview();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {selected && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#54B9F9]/8 to-[#8AD329]/8" />
      )}

      <div className="relative z-10 mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={cn(
              'grid h-5 w-5 place-items-center rounded-md border transition',
              selected
                ? 'border-[#54B9F9] bg-gradient-to-br from-[#54B9F9] to-[#2E8FD6] text-white shadow-[0_3px_8px_-2px_rgba(46,143,214,0.5)]'
                : 'border-border bg-background hover:border-primary'
            )}
            aria-label={`选择素材 ${item.title}`}
          >
            {selected && <Check className="h-3 w-3" strokeWidth={3.5} />}
          </button>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide',
              badge.className
            )}
          >
            {badge.label}
          </span>
        </div>
        <button
          type="button"
          className={cn(
            'grid h-6 w-6 place-items-center rounded-full transition',
            item.def ? 'text-[#FFB547]' : 'text-muted-foreground/50 hover:text-[#FFB547]'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDefault();
          }}
          title={item.def ? '取消默认' : '设为默认'}
        >
          <Star className="h-3.5 w-3.5" fill={item.def ? '#FFB547' : 'none'} strokeWidth={2.2} />
        </button>
      </div>

      <div className="relative z-10 flex items-start gap-2.5">
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br shadow-[0_4px_10px_-2px_rgba(46,143,214,0.4)] ring-1 ring-white/40',
            toneGradient(kind.tone)
          )}
        >
          <FileText className="h-4 w-4 text-white" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground">{item.title}</h4>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.meta}</p>
        </div>
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-between border-t border-border/40 pt-2.5">
        <div className="flex flex-wrap gap-1">
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
              item.cms
                ? 'border border-[#8AD329]/30 bg-[#8AD329]/10 text-[#4a7a18]'
                : 'border border-[#54B9F9]/30 bg-[#54B9F9]/10 text-[#1f6ea8]'
            )}
          >
            {item.cms ? 'CMS' : '本地上传'}
          </span>
          {item.def && (
            <span className="rounded-md border border-[#FFB547]/30 bg-[#FFB547]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#a16207]">
              默认
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground/80">
          {formatMaterialAddedTime(item.addedAt)}
        </span>
      </div>
    </article>
  );
}
