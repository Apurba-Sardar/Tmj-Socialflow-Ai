import { redirect } from 'next/navigation';

import { WordPressAutomation } from '@/components/wordpress/wordpress-automation';
import { getCurrentUser } from '@/lib/auth';

export default async function AutomationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <main className="sf-app-bg min-h-screen p-6 text-foreground sm:p-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Automation
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Daily publishing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Automatically discover new WordPress posts and publish them to your connected channels.
          </p>
        </div>
        <WordPressAutomation user={user} />
      </div>
    </main>
  );
}
