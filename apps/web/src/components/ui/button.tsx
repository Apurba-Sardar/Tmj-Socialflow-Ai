import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'sf-focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-[hsl(var(--brand-from))] to-[hsl(var(--brand-to))] text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25',
        outline:
          'border border-input bg-background/70 shadow-sm backdrop-blur hover:border-primary/40 hover:bg-muted/80 dark:bg-white/[0.035] dark:hover:bg-white/[0.07]',
        ghost: 'hover:bg-muted/80 dark:hover:bg-white/[0.06]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-lg shadow-destructive/15 hover:bg-destructive/90',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';
