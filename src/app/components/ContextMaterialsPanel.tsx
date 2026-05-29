import { useMemo } from 'react';
import type { LibraryItem } from '@/types/library';
import { formatMaterialAddedTime, getRecentMaterials } from '@/lib/libraryUtils';
import { BookMarked, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

interface ContextMaterialsPanelProps {
  library: LibraryItem[];
  categories: string[];
  onOpenPicker: (cat: string) => void;
  onPreview: (item: LibraryItem) => void;
}

function toneClasses(item: LibraryItem) {
  if (item.cms) return 'from-[#8AD329] to-[#6FCFC0]';
  return 'from-[#54B9F9] to-[#2E8FD6]';
}

function MaterialSourceRow({
  item,
  onPreview,
  showAddedTime = false,
}: {
  item: LibraryItem;
  onPreview: (item: LibraryItem) => void;
  showAddedTime?: boolean;
}) {
  return (
    <button
      type="button"
      className="group flex w-full items-start gap-2 rounded-xl border border-transparent p-2 text-left transition hover:border-border/60 hover:bg-background/80 hover:shadow-soft"
      onClick={() => onPreview(item)}
      title="点击查看详情"
    >
      <span
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-[0_3px_8px_-2px_rgba(46,143,214,0.4)] ring-1 ring-white/40',
          toneClasses(item)
        )}
      >
        <BookMarked className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-foreground">{item.title}</div>
        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.meta}</div>
        {showAddedTime && (
          <div className="mt-0.5 text-[10px] text-muted-foreground/70">
            {formatMaterialAddedTime(item.addedAt)}
          </div>
        )}
      </div>
      <ChevronRight className="mt-1 h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-60" />
    </button>
  );
}

function AssetSection({
  title,
  badge,
  items,
  addable,
  onOpenPicker,
  onPreview,
  category,
}: {
  title: string;
  badge?: number;
  items: LibraryItem[];
  addable?: boolean;
  onOpenPicker?: (cat: string) => void;
  onPreview: (item: LibraryItem) => void;
  category?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/40 p-2.5">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
          {title}
          {badge !== undefined && badge > 0 && (
            <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-gradient-to-br from-[#54B9F9] to-[#8AD329] px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_-1px_rgba(46,143,214,0.5)]">
              {badge}
            </span>
          )}
        </div>
        {addable && category && onOpenPicker && (
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-primary transition hover:bg-primary/10"
            onClick={() => onOpenPicker(category)}
          >
            <Plus className="h-3 w-3" />
            添加
          </button>
        )}
      </div>
      <div className="space-y-1">
        {items.length > 0 ? (
          items.map((item) => (
            <MaterialSourceRow key={item.id} item={item} onPreview={onPreview} />
          ))
        ) : (
          <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">暂无默认素材</div>
        )}
      </div>
    </div>
  );
}

export function ContextMaterialsPanel({
  library,
  categories,
  onOpenPicker,
  onPreview,
}: ContextMaterialsPanelProps) {
  const recentMaterials = useMemo(() => getRecentMaterials(library), [library]);

  return (
    <div className="space-y-3">
      <AssetSection
        title="最近添加"
        badge={recentMaterials.length}
        items={recentMaterials}
        onPreview={onPreview}
      />

      {categories.map((c) => {
        const arr = library.filter((x) => x.cat === c && x.def);
        return (
          <AssetSection
            key={c}
            title={c}
            items={arr}
            addable
            category={c}
            onOpenPicker={onOpenPicker}
            onPreview={onPreview}
          />
        );
      })}
    </div>
  );
}
