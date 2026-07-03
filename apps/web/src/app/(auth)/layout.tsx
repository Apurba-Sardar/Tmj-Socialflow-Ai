import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="sf-app-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10" />
      <div className="pointer-events-none absolute bottom-[-12rem] right-[-8rem] h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <section className="sf-page-enter grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_32rem]">
        <div className="hidden lg:block">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl sf-gradient-icon">
            <span className="text-sm font-semibold tracking-wide">TMJ</span>
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-tight text-slate-950 dark:text-white">
            TMJ SocialFlow AI
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Enterprise publishing operations, WordPress intelligence, campaign generation, and analytics in one secure workspace.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            <div className="rounded-xl border bg-background/50 p-3 backdrop-blur dark:bg-white/[0.035]">
              <div className="text-lg font-semibold">AI</div>
              <div className="text-xs text-muted-foreground">Pipeline</div>
            </div>
            <div className="rounded-xl border bg-background/50 p-3 backdrop-blur dark:bg-white/[0.035]">
              <div className="text-lg font-semibold">WP</div>
              <div className="text-xs text-muted-foreground">Hub</div>
            </div>
            <div className="rounded-xl border bg-background/50 p-3 backdrop-blur dark:bg-white/[0.035]">
              <div className="text-lg font-semibold">RBAC</div>
              <div className="text-xs text-muted-foreground">Secure</div>
            </div>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
