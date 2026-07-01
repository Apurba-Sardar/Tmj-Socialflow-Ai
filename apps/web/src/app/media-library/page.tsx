import { redirect } from 'next/navigation';

import { MediaLibrary } from '@/components/media/media-library';
import { getCurrentUser } from '@/lib/auth';

export default async function MediaLibraryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <MediaLibrary user={user} />;
}
