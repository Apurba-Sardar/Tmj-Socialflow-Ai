import { redirect } from 'next/navigation';

import { WordPressHub } from '@/components/wordpress/wordpress-hub';
import { getCurrentUser } from '@/lib/auth';

export default async function WordPressHubPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <WordPressHub user={user} />;
}
