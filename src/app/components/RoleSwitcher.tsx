import type { UserRole } from '@/types/review';
import { ROLE_PROFILES } from '@/types/review';
import { cn } from '@/app/components/ui/utils';

interface RoleSwitcherProps {
  role: UserRole;
  onChange: (role: UserRole) => void;
}

export function RoleSwitcher({ role, onChange }: RoleSwitcherProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">当前角色</span>
      <select
        className={cn(
          'rounded-lg border border-border/70 bg-glass px-3 py-1.5 font-medium text-foreground shadow-soft',
          'transition hover:border-primary/40 focus:border-[#54B9F9]/50 focus:outline-none focus:ring-4 focus:ring-[#54B9F9]/10'
        )}
        value={role}
        onChange={(e) => onChange(e.target.value as UserRole)}
        aria-label="切换角色"
      >
        {(Object.keys(ROLE_PROFILES) as UserRole[]).map((id) => (
          <option key={id} value={id}>
            {ROLE_PROFILES[id].name}-{ROLE_PROFILES[id].dept}
          </option>
        ))}
      </select>
    </div>
  );
}
