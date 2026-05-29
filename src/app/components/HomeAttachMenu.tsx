import { useRef, useState } from 'react';
import type { HomeEntryIntent } from './homeGuide';

export const HOME_AGENTS: { intent: HomeEntryIntent; label: string }[] = [
  { intent: 'insight', label: '生成话题洞察' },
  { intent: 'copy', label: '生成文案' },
  { intent: 'visual', label: '生成图片' },
  { intent: 'video', label: '生成视频' },
  { intent: 'ppt', label: '生成 PPT' },
];

export function getHomeAgentLabel(intent: HomeEntryIntent): string {
  return HOME_AGENTS.find((a) => a.intent === intent)?.label ?? '内容创作';
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function InsightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="15" height="14" rx="2" />
      <path d="m22 7-6.5 4.5L22 16V7Z" />
    </svg>
  );
}

function PptIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 8h4" />
      <path d="M7 11h6" />
    </svg>
  );
}

const AGENT_ICONS: Record<HomeEntryIntent, () => JSX.Element> = {
  insight: InsightIcon,
  copy: CopyIcon,
  visual: ImageIcon,
  video: VideoIcon,
  ppt: PptIcon,
  general: InsightIcon,
  'visual-template': ImageIcon,
  'ppt-template': PptIcon,
};

export function HomeAgentIcon({ intent, size = 16 }: { intent: HomeEntryIntent; size?: number }) {
  const Icon = AGENT_ICONS[intent] ?? InsightIcon;
  return (
    <span className="home-agent-icon" style={{ width: size, height: size }} aria-hidden>
      <Icon />
    </span>
  );
}

export function HomeAttachMenu({
  onUpload,
  onSelectAgent,
}: {
  onUpload: () => void;
  onSelectAgent: (intent: HomeEntryIntent) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  };

  const close = () => setOpen(false);

  return (
    <div
      className="home-attach-menu-wrap"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary"
        title="添加附件或选择 Agent"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ＋
      </button>

      {open && (
        <div className="home-attach-menu" role="menu" aria-label="添加附件与选择 Agent">
          <button
            type="button"
            className="home-attach-menu-item"
            role="menuitem"
            onClick={() => {
              close();
              onUpload();
            }}
          >
            <span className="home-attach-menu-item-icon">
              <UploadIcon />
            </span>
            <span>上传文件</span>
          </button>

          <div className="home-attach-menu-divider" role="separator" />

          {HOME_AGENTS.map(({ intent, label }) => {
            const Icon = AGENT_ICONS[intent];
            return (
              <button
                key={intent}
                type="button"
                className="home-attach-menu-item"
                role="menuitem"
                onClick={() => {
                  close();
                  onSelectAgent(intent);
                }}
              >
                <span className="home-attach-menu-item-icon">
                  <Icon />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
