import { NavLink } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MOBILE_TABS, NAV_GROUPS, FOOTER_NAV } from './nav';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function MobileTabBar() {
  const [more, setMore] = useState(false);
  const extra = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV].filter((i) => !MOBILE_TABS.some((t) => t.to === i.to));
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-surface-1/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary mobile">
        {MOBILE_TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => cn('flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors', isActive ? 'text-accent' : 'text-fg-subtle')}>
            <t.icon className="size-5" />
            {t.label}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)} className="flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium text-fg-subtle">
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent title="More">
          <div className="grid grid-cols-3 gap-2 p-4">
            {extra.map((i) => (
              <NavLink key={i.to} to={i.to} onClick={() => setMore(false)} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface-2 p-3 text-center text-xs font-medium">
                <i.icon className="size-5 text-accent" />
                {i.label}
              </NavLink>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
