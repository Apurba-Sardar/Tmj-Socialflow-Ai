import * as React from 'react';

import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'sf-focus-ring flex h-10 w-full rounded-lg border border-input bg-background/80 px-3 py-2 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.035]',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
