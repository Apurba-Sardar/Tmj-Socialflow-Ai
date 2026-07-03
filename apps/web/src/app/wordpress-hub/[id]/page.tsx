import { redirect } from 'next/navigation';

import { WordPressPostDetail } from '@/components/wordpress/wordpress-post-detail';
import { getCurrentUser } from '@/lib/auth';

export default async function WordPressHubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  return <WordPressPostDetail articleId={id} user={user} />;
}
