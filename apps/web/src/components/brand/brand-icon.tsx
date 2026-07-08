import Image from 'next/image';

import { cn } from '@/lib/utils';

const appIcon = '/tmj-socialflow-app-icon.png';

export function BrandIcon({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-2xl shadow-lg shadow-cyan-500/20 ring-1 ring-white/10',
        className,
      )}
    >
      <Image
        src={appIcon}
        alt="TMJ SocialFlow AI"
        fill
        className="object-cover"
        sizes="64px"
        priority={priority}
      />
    </span>
  );
}
