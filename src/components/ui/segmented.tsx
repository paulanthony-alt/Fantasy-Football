import * as React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

/** Pill segmented control with an animated thumb. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, layoutId, 'aria-label': ariaLabel }: { value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; size?: 'sm' | 'md'; className?: string; layoutId?: string; 'aria-label'?: string }) {
  const id = React.useId();
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn('relative inline-flex items-center rounded-md border border-border bg-surface-2 p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            'relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5',
            size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-3 text-sm',
            value === o.value ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={layoutId ?? id} className="absolute inset-0 -z-10 rounded-[5px] border border-border-strong bg-surface-1 shadow-e1" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
          )}
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
