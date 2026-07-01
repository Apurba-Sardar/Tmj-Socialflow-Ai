'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Close navigation"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => {
          onOpenChange(false);
        }}
        type="button"
      />
      <aside
        className={cn(
          'absolute inset-y-0 left-0 w-[18rem] border-r bg-card shadow-xl',
          'text-card-foreground',
        )}
      >
        <div className="absolute right-3 top-3">
          <Button
            aria-label="Close navigation"
            onClick={() => {
              onOpenChange(false);
            }}
            size="sm"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}
