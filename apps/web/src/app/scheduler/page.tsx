import { redirect } from 'next/navigation';

import { PostScheduler } from '@/components/scheduler/post-scheduler';
import { getCurrentUser } from '@/lib/auth';

export default async function SchedulerPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <PostScheduler user={user} />;
}
