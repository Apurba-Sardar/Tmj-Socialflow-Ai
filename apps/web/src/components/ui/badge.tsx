import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gradient-to-br from-[hsl(var(--brand-from))] to-[hsl(var(--brand-to))] text-white',
        secondary: 'border-transparent bg-muted/80 text-foreground dark:bg-white/[0.06]',
        outline: 'border-border/80 bg-background/40 text-foreground dark:bg-white/[0.03]',
        success:
          'border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
        destructive:
          'border-rose-500/20 bg-rose-500/12 text-rose-700 dark:text-rose-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
