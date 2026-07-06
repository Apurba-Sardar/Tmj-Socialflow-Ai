import { redirect } from 'next/navigation';

import { ChannelManagement } from '@/components/admin/channel-management';
import { getCurrentUser } from '@/lib/auth';

export default async function AdminChannelsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <ChannelManagement user={user} />;
}
