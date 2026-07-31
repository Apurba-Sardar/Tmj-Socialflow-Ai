import * as React from 'react';

import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'sf-focus-ring flex h-11 w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/30 focus:bg-card disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.035] dark:focus:bg-white/[0.06]',
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';
