import { redirect } from 'next/navigation';

import { CampaignManagement } from '@/components/campaigns/campaign-management';
import { getCurrentUser } from '@/lib/auth';

export default async function CampaignsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <CampaignManagement user={user} />;
}
