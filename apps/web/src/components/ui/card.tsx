import * as React from 'react';

import { cn } from '@/lib/utils';

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'sf-card rounded-xl border bg-card text-card-foreground shadow-sm',
      className,
    )}
    {...props}
  />
);

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold leading-tight tracking-normal', className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-4 pt-0', className)} {...props} />
);
