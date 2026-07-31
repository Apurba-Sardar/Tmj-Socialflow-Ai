import type { ReactNode } from 'react';

import { BrandIcon } from '@/components/brand/brand-icon';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="sf-app-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10" />
      <div className="pointer-events-none absolute bottom-[-12rem] right-[-8rem] h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <section className="sf-page-enter grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_32rem]">
        <div className="hidden lg:block">
          <div className="mb-7 flex items-center gap-3">
            <BrandIcon className="h-12 w-12" priority />
            <span className="text-sm font-semibold tracking-tight">TMJ SocialFlow AI</span>
          </div>
          <p className="sf-section-kicker">The publishing operating system</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950 dark:text-white">
            Turn your content engine into a calm, connected workflow.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">
            Bring WordPress, AI-assisted campaigns, publishing, and channel health into one focused
            workspace built for teams that ship consistently.
          </p>
          <div className="mt-9 grid max-w-lg gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-background/55 p-4 backdrop-blur dark:bg-white/[0.035]">
              <div className="text-lg font-semibold">01</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                Plan campaigns from real content.
              </div>
            </div>
            <div className="rounded-2xl border bg-background/55 p-4 backdrop-blur dark:bg-white/[0.035]">
              <div className="text-lg font-semibold">02</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                Review every draft with context.
              </div>
            </div>
            <div className="rounded-2xl border bg-background/55 p-4 backdrop-blur dark:bg-white/[0.035]">
              <div className="text-lg font-semibold">03</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                Publish with confidence.
              </div>
            </div>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
