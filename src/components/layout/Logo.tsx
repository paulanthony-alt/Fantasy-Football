import { cn } from '@/lib/utils';

export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent/25 to-accent/5 ring-1 ring-accent/30">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path d="M6 22 L13 13 L18 18 L26 8" stroke="hsl(var(--accent))" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="26" cy="8" r="2.6" fill="hsl(var(--accent))" />
        </svg>
      </div>
      {!collapsed && (
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight">Gridiron<span className="text-accent">Edge</span></div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">NFL Analytics</div>
        </div>
      )}
    </div>
  );
}
